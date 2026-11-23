/**
 * SIGPA — Capa de Base de Datos SQLite (Modo Mock / Desarrollo Autónomo)
 * 
 * Permite ejecutar todo el backend de SIGPA sin necesidad de instalar
 * Oracle Database ni Oracle Instant Client.
 * 
 * Se activa mediante: USE_MOCK_DB=true en .env
 * Almacena los datos en: sigpa.db (o SQLITE_DB_PATH)
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const bcrypt = require('bcryptjs');

const tutoresDemo = [
    { semestre: 1, nombre: 'Mateo', apellido: 'Gómez', email: 'tutor@sigpa.edu' },
    { semestre: 2, nombre: 'Lucía', apellido: 'Ramírez', email: 'tutor2@sigpa.edu' },
    { semestre: 3, nombre: 'Daniel', apellido: 'Herrera', email: 'tutor3@sigpa.edu' },
];

// Detección de motor SQLite nativo (Node.js 22+) o better-sqlite3
let DatabaseSync;
try {
    DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e1) {
    try {
        DatabaseSync = require('better-sqlite3');
    } catch (e2) {
        DatabaseSync = null;
    }
}

let dbInstance = null;

/**
 * Obtiene la ruta del archivo de base de datos SQLite dinámicamente
 */
function getDbPath() {
    return process.env.SQLITE_DB_PATH
        ? path.resolve(process.cwd(), process.env.SQLITE_DB_PATH)
        : path.resolve(__dirname, '../../sigpa.db');
}

/**
 * Registra funciones personalizadas compatibles con Oracle en SQLite
 */
function registerOracleCompatibilityFunctions(db) {
    // 1. NVL(expr1, expr2) -> Si expr1 no es null/undefined, retorna expr1; de lo contrario expr2
    try {
        db.function('NVL', { varargs: true }, (...args) => {
            const a = args[0];
            const b = args[1];
            return (a !== null && a !== undefined) ? a : b;
        });
    } catch (e) {
        db.function('NVL', (a, b) => (a !== null && a !== undefined ? a : b));
    }

    // 2. TO_CHAR(date_val, format)
    try {
        db.function('TO_CHAR', { varargs: true }, (...args) => {
            const val = args[0];
            const fmt = args[1];
            if (val === null || val === undefined) return '';
            const str = String(val).trim();
            if (!str) return '';
            if (fmt && fmt.includes('HH')) {
                return str.substring(0, 19);
            }
            return str.substring(0, 10);
        });
    } catch (e) {
        db.function('TO_CHAR', (val, fmt) => {
            if (val === null || val === undefined) return '';
            const str = String(val).trim();
            if (!str) return '';
            if (fmt && fmt.includes('HH')) {
                return str.substring(0, 19);
            }
            return str.substring(0, 10);
        });
    }

    // 3. TO_DATE(str_val, format)
    try {
        db.function('TO_DATE', { varargs: true }, (...args) => {
            const val = args[0];
            if (val === null || val === undefined) return null;
            return String(val).trim().substring(0, 10);
        });
    } catch (e) {
        db.function('TO_DATE', (val, fmt) => {
            if (val === null || val === undefined) return null;
            return String(val).trim().substring(0, 10);
        });
    }
}

/**
 * Verifica y agrega una columna si no existe en una tabla SQLite
 */
function ensureColumnExists(db, table, column, colDef) {
    try {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all();
        if (!cols.some(c => c.name.toUpperCase() === column.toUpperCase())) {
            db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${colDef}`);
        }
    } catch (e) {
        // La tabla puede no existir todavía
    }
}

/**
 * Inicializa el esquema DDL y vistas de compatibilidad
 */
function initSchema(db) {
    // Migración segura: si PREGUNTA existe como tabla real, migrar datos y convertir a vista
    try {
        const pregType = db.prepare("SELECT type FROM sqlite_master WHERE name = 'PREGUNTA'").get();
        if (pregType && pregType.type === 'table') {
            db.exec(`
                INSERT OR IGNORE INTO PREGUNTA_GUIA (ID_PREGUNTA, ID_PREGUNTA_GUIA, ID_PRACTICA, ID_MODALIDAD, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN)
                SELECT ID_PREGUNTA, ID_PREGUNTA, ID_PRACTICA, ID_PRACTICA, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN FROM PREGUNTA;
                DROP TABLE PREGUNTA;
            `);
        }
    } catch (eMigration) {}

    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA foreign_keys = ON;

        -- Tabla de versión simulada (v$version)
        CREATE TABLE IF NOT EXISTS V_VERSION (
            BANNER TEXT,
            SYSDATE TEXT
        );
        DELETE FROM V_VERSION;
        INSERT INTO V_VERSION VALUES (
            'Oracle Database 10g Express Edition Release 10.2.0.1.0 (SQLite Mock Emulation)',
            datetime('now', 'localtime')
        );

        -- Vista para USER_TABLES
        DROP VIEW IF EXISTS USER_TABLES;
        CREATE VIEW USER_TABLES AS
        SELECT UPPER(name) AS TABLE_NAME 
        FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'V_VERSION';

        -- 1. Tabla USUARIO
        CREATE TABLE IF NOT EXISTS USUARIO (
            ID_USUARIO INTEGER PRIMARY KEY,
            NOMBRE TEXT NOT NULL,
            APELLIDO TEXT,
            EMAIL TEXT UNIQUE NOT NULL,
            CONTRASENA TEXT NOT NULL,
            ROL TEXT NOT NULL CHECK (ROL IN ('DIRECTOR', 'COORDINADOR', 'ESTUDIANTE', 'TUTOR', 'ASESOR')),
            ACTIVO TEXT DEFAULT 'S' CHECK (ACTIVO IN ('S', 'N'))
        );

        -- 2. Tabla MODALIDAD
        CREATE TABLE IF NOT EXISTS MODALIDAD (
            ID_MODALIDAD INTEGER PRIMARY KEY,
            NOMBRE TEXT NOT NULL,
            SEMESTRE INTEGER NOT NULL DEFAULT 1 CHECK (SEMESTRE IN (1, 2, 3)),
            TIPO TEXT DEFAULT 'OBSERVACION',
            HORAS_REQUERIDAS INTEGER DEFAULT 64,
            ESTADO TEXT DEFAULT 'ABIERTA' CHECK (ESTADO IN ('ABIERTA', 'CERRADA')),
            DESCRIPCION TEXT
        );

        -- 3. Tabla INSTITUCION
        CREATE TABLE IF NOT EXISTS INSTITUCION (
            ID_INSTITUCION INTEGER PRIMARY KEY,
            NOMBRE TEXT NOT NULL,
            DIRECCION TEXT,
            TELEFONO TEXT,
            CONVENIO_ACTIVO TEXT DEFAULT 'S' CHECK (CONVENIO_ACTIVO IN ('S', 'N')),
            CUPOS_DISPONIBLES INTEGER DEFAULT 5,
            FECHA_VENC_CONVENIO TEXT
        );

        -- 4. Tabla PRACTICA
        CREATE TABLE IF NOT EXISTS PRACTICA (
            ID_PRACTICA INTEGER PRIMARY KEY,
            NOMBRE TEXT NOT NULL,
            SEMESTRE INTEGER DEFAULT 1,
            TIPO TEXT DEFAULT 'OBSERVACION',
            ID_MODALIDAD INTEGER,
            HORAS_REQUERIDAS INTEGER DEFAULT 64,
            ESTADO TEXT DEFAULT 'ABIERTA' CHECK (ESTADO IN ('ABIERTA', 'CERRADA')),
            DESCRIPCION TEXT,
            FOREIGN KEY (ID_MODALIDAD) REFERENCES MODALIDAD(ID_MODALIDAD)
        );

        -- 5. Tabla ASIGNACION (Vinculación formal de estudiantes)
        CREATE TABLE IF NOT EXISTS ASIGNACION (
            ID_ASIGNACION INTEGER PRIMARY KEY,
            ID_USUARIO INTEGER,
            ID_ESTUDIANTE INTEGER,
            ID_TUTOR INTEGER,
            ID_PRACTICA INTEGER NOT NULL,
            ID_INSTITUCION INTEGER,
            HORAS_ACUMULADAS REAL DEFAULT 0,
            ESTADO TEXT DEFAULT 'APROBADA',
            ESTADO_APROBACION TEXT DEFAULT 'APROBADA',
            ESTADO_PRACTICA TEXT DEFAULT 'EN_CURSO',
            FECHA_ASIGNACION TEXT,
            FOREIGN KEY (ID_ESTUDIANTE) REFERENCES USUARIO(ID_USUARIO),
            FOREIGN KEY (ID_TUTOR) REFERENCES USUARIO(ID_USUARIO),
            FOREIGN KEY (ID_PRACTICA) REFERENCES PRACTICA(ID_PRACTICA),
            FOREIGN KEY (ID_INSTITUCION) REFERENCES INSTITUCION(ID_INSTITUCION)
        );

        -- 6. Tabla BITACORA
        CREATE TABLE IF NOT EXISTS BITACORA (
            ID_BITACORA INTEGER PRIMARY KEY,
            ID_ASIGNACION INTEGER NOT NULL,
            NUMERO_VISITA INTEGER NOT NULL,
            FECHA_REGISTRO TEXT NOT NULL,
            HORAS_SESION REAL DEFAULT 16,
            ACTIVIDADES TEXT NOT NULL,
            OBSERVACIONES TEXT,
            URL_EVIDENCIA TEXT,
            ESTADO_REVISION TEXT DEFAULT 'PENDIENTE',
            FOREIGN KEY (ID_ASIGNACION) REFERENCES ASIGNACION(ID_ASIGNACION)
        );

        -- 7. Tabla VISITA (Planificación y seguimiento de visitas pedagógicas)
        CREATE TABLE IF NOT EXISTS VISITA (
            ID_VISITA INTEGER PRIMARY KEY,
            ID_ASIGNACION INTEGER,
            ID_PRACTICA INTEGER,
            NUMERO_VISITA INTEGER NOT NULL,
            FECHA_PROGRAMADA TEXT,
            FECHA_REALIZADA TEXT,
            ESTADO TEXT DEFAULT 'PROGRAMADA' CHECK (ESTADO IN ('PROGRAMADA', 'REALIZADA', 'CANCELADA')),
            TIPO_VISITA TEXT DEFAULT 'SEGUIMIENTO',
            OBSERVACIONES TEXT,
            FOREIGN KEY (ID_ASIGNACION) REFERENCES ASIGNACION(ID_ASIGNACION),
            FOREIGN KEY (ID_PRACTICA) REFERENCES PRACTICA(ID_PRACTICA)
        );

        -- 8. Tabla EVALUACION
        CREATE TABLE IF NOT EXISTS EVALUACION (
            ID_EVALUACION INTEGER PRIMARY KEY,
            ID_BITACORA INTEGER NOT NULL,
            ID_EVALUADOR INTEGER NOT NULL,
            TIPO_EVALUADOR TEXT NOT NULL CHECK (TIPO_EVALUADOR IN ('TUTOR', 'ASESOR')),
            NOTA REAL NOT NULL,
            COMENTARIOS TEXT,
            FECHA_EVALUACION TEXT,
            FOREIGN KEY (ID_BITACORA) REFERENCES BITACORA(ID_BITACORA),
            FOREIGN KEY (ID_EVALUADOR) REFERENCES USUARIO(ID_USUARIO)
        );

        -- 9. Tabla EVIDENCIA (Portafolio digital de evidencias didácticas)
        CREATE TABLE IF NOT EXISTS EVIDENCIA (
            ID_EVIDENCIA INTEGER PRIMARY KEY,
            ID_BITACORA INTEGER,
            NUMERO_VISITA INTEGER DEFAULT 1,
            NOMBRE_ARCHIVO TEXT,
            RUTA_ARCHIVO TEXT NOT NULL,
            TIPO_FORMATO TEXT DEFAULT 'PDF',
            FECHA_CARGA TEXT,
            FOREIGN KEY (ID_BITACORA) REFERENCES BITACORA(ID_BITACORA)
        );

        -- 10. Tablas de Preguntas Pedagógicas (PREGUNTA_GUIA y Vista de Compatibilidad PREGUNTA)
        CREATE TABLE IF NOT EXISTS PREGUNTA_GUIA (
            ID_PREGUNTA INTEGER PRIMARY KEY,
            ID_PREGUNTA_GUIA INTEGER,
            ID_PRACTICA INTEGER DEFAULT 1,
            ID_MODALIDAD INTEGER,
            NUMERO_VISITA INTEGER DEFAULT 1,
            TEXTO_PREGUNTA TEXT NOT NULL,
            CATEGORIA TEXT DEFAULT 'PEDAGOGICA',
            ORDEN INTEGER DEFAULT 1,
            FOREIGN KEY (ID_PRACTICA) REFERENCES PRACTICA(ID_PRACTICA),
            FOREIGN KEY (ID_MODALIDAD) REFERENCES MODALIDAD(ID_MODALIDAD)
        );

        -- Vista de compatibilidad para evitar redundancia y garantizar sincronía total
        DROP VIEW IF EXISTS PREGUNTA;
        CREATE VIEW IF NOT EXISTS PREGUNTA AS
        SELECT ID_PREGUNTA, ID_PRACTICA, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN
        FROM PREGUNTA_GUIA;

        -- 11. Tabla ASISTENCIA (Validación presencial en tiempo real por Código QR)
        CREATE TABLE IF NOT EXISTS ASISTENCIA (
            ID_ASISTENCIA INTEGER PRIMARY KEY,
            ID_ASIGNACION INTEGER NOT NULL,
            ID_ESTUDIANTE INTEGER NOT NULL,
            ID_INSTITUCION INTEGER NOT NULL,
            ID_ASESOR INTEGER,
            FECHA_ASISTENCIA TEXT NOT NULL,
            HORA_LLEGADA TEXT NOT NULL,
            HORAS_VALIDADAS REAL DEFAULT 4,
            ESTADO_VALIDACION TEXT DEFAULT 'VALIDADA' CHECK (ESTADO_VALIDACION IN ('VALIDADA', 'PENDIENTE', 'RECHAZADA')),
            TOKEN_QR TEXT,
            FOREIGN KEY (ID_ASIGNACION) REFERENCES ASIGNACION(ID_ASIGNACION),
            FOREIGN KEY (ID_ESTUDIANTE) REFERENCES USUARIO(ID_USUARIO),
            FOREIGN KEY (ID_INSTITUCION) REFERENCES INSTITUCION(ID_INSTITUCION)
        );
    `);

    // Migraciones seguras para bases de datos existentes
    ensureColumnExists(db, 'USUARIO', 'ID_INSTITUCION', "INTEGER");
    ensureColumnExists(db, 'BITACORA', 'ID_VISITA', "INTEGER");
    ensureColumnExists(db, 'PREGUNTA_GUIA', 'CATEGORIA', "TEXT DEFAULT 'PEDAGOGICA'");
    ensureColumnExists(db, 'PREGUNTA_GUIA', 'ID_PREGUNTA_GUIA', "INTEGER");
    ensureColumnExists(db, 'PREGUNTA_GUIA', 'ID_MODALIDAD', "INTEGER");
    ensureColumnExists(db, 'PRACTICA', 'ID_MODALIDAD', "INTEGER");
    ensureColumnExists(db, 'PRACTICA', 'ID_TUTOR', "INTEGER");

    // Sincronizar vista PREGUNTA si PREGUNTA no es una vista sino tabla antigua
    try {
        const tableCheck = db.prepare("SELECT type FROM sqlite_master WHERE name = 'PREGUNTA'").get();
        if (tableCheck && tableCheck.type === 'table') {
            db.exec(`
                INSERT OR IGNORE INTO PREGUNTA_GUIA (ID_PREGUNTA, ID_PREGUNTA_GUIA, ID_PRACTICA, ID_MODALIDAD, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN)
                SELECT ID_PREGUNTA, ID_PREGUNTA, ID_PRACTICA, ID_PRACTICA, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN FROM PREGUNTA;
                DROP TABLE PREGUNTA;
                CREATE VIEW PREGUNTA AS SELECT ID_PREGUNTA, ID_PRACTICA, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN FROM PREGUNTA_GUIA;
            `);
        }
    } catch (e) {}
}

/**
 * Inserta datos de prueba realistas para que el equipo pueda probar
 * todos los roles, pantallas y flujos inmediatamente.
 */
function seedInitialData(db) {
    console.log('[MOCK-DB] Verificando y sembrando datos iniciales en SQLite...');

    // Contraseña estándar '1234' cifrada con bcrypt
    const passHash = bcrypt.hashSync('1234', 10);

    // 1. Usuarios canónicos (Día Cero)
    const userCount = db.prepare('SELECT COUNT(*) AS CNT FROM USUARIO').get().CNT;
    if (userCount === 0) {
        const insertUsuario = db.prepare(`
            INSERT INTO USUARIO (ID_USUARIO, NOMBRE, APELLIDO, EMAIL, CONTRASENA, ROL, SEMESTRE, ACTIVO)
            VALUES (:id, :nombre, :apellido, :email, :contrasena, :rol, :semestre, 'S')
        `);

        const usuarios = [
            { id: 1, nombre: 'Carmen Rosa', apellido: 'Delgado (Directora)', email: 'director@sigpa.edu', contrasena: passHash, rol: 'DIRECTOR', semestre: null },
            { id: 2, nombre: 'Carlos Andrés', apellido: 'Mendoza (Tutor)', email: 'tutor@sigpa.edu', contrasena: passHash, rol: 'TUTOR', semestre: null },
            { id: 3, nombre: 'Santiago', apellido: 'Acevedo (Estudiante)', email: 'estudiante@sigpa.edu', contrasena: passHash, rol: 'ESTUDIANTE', semestre: 1 },
            { id: 4, nombre: 'Martha Helena', apellido: 'Gómez (Asesora)', email: 'asesor@sigpa.edu', contrasena: passHash, rol: 'ASESOR', semestre: null },
        ];

        for (const u of usuarios) {
            insertUsuario.run(u);
        }
    }

    // 2. Instituciones Educativas Oficiales con Convenio
    const instCount = db.prepare('SELECT COUNT(*) AS CNT FROM INSTITUCION').get().CNT;
    if (instCount === 0) {
        const insertInstitucion = db.prepare(`
            INSERT INTO INSTITUCION (ID_INSTITUCION, NOMBRE, DIRECCION, TELEFONO, CONVENIO_ACTIVO, CUPOS_DISPONIBLES, FECHA_VENC_CONVENIO)
            VALUES (:id, :nombre, :direccion, :telefono, 'S', :cupos, :vencimiento)
        `);

        const instituciones = [
            { id: 1, nombre: 'Colegio Fernando Aragón', direccion: 'Cra 27 # 34-12', telefono: '6076345678', cupos: 3, vencimiento: '2028-12-31' },
            { id: 2, nombre: 'Colegio Cooperativo Comfenalco', direccion: 'Calle 45 # 18-20', telefono: '6076789012', cupos: 5, vencimiento: '2028-12-31' },
            { id: 3, nombre: 'Colegio La Salle', direccion: 'Cra 33 # 48-01', telefono: '6076432109', cupos: 5, vencimiento: '2028-12-31' },
        ];

        for (const inst of instituciones) {
            insertInstitucion.run(inst);
        }
    }

    // 7. Preguntas Guía y Preguntas Pedagógicas
    const insertPreguntaGuia = db.prepare(`
        INSERT OR IGNORE INTO PREGUNTA_GUIA (ID_PREGUNTA, ID_PREGUNTA_GUIA, ID_PRACTICA, ID_MODALIDAD, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN)
        VALUES (:id, :id, :idPractica, :idMod, :visita, :texto, :categoria, :orden)
    `);

    const bancoPreguntas = [
        // Visita 1
        { id: 1, idPractica: 1, idMod: 1, visita: 1, texto: '¿Cómo caracterizarías el ambiente socioemocional del aula en esta primera visita?', categoria: 'CONTEXTO', orden: 1 },
        { id: 2, idPractica: 1, idMod: 1, visita: 1, texto: '¿Qué estrategias utilizó la docente para captar la atención de los infantes y fomentar la participación?', categoria: 'DIDACTICA', orden: 2 },
        { id: 3, idPractica: 1, idMod: 1, visita: 1, texto: '¿Qué acuerdos pedagógicos de convivencia facilitaron el desarrollo armónico de la jornada?', categoria: 'CONVIVENCIA', orden: 3 },
        // Visita 2
        { id: 4, idPractica: 1, idMod: 1, visita: 2, texto: '¿Qué recursos didácticos y lúdicos facilitaron el aprendizaje activo en la sesión?', categoria: 'RECURSOS', orden: 1 },
        { id: 5, idPractica: 1, idMod: 1, visita: 2, texto: '¿Cómo se integraron las actividades motrices y de expresión corporal en el plan curricular?', categoria: 'CURRICULO', orden: 2 },
        { id: 6, idPractica: 1, idMod: 1, visita: 2, texto: '¿De qué manera se retroalimentó el trabajo cooperativo de los niños durante el cierre formativo?', categoria: 'EVALUACION', orden: 3 },
        // Visita 3
        { id: 7, idPractica: 1, idMod: 1, visita: 3, texto: '¿Cómo se articularon los tres momentos pedagógicos (inicio, desarrollo y cierre) con el objetivo de aprendizaje?', categoria: 'PLANEACION', orden: 1 },
        { id: 8, idPractica: 1, idMod: 1, visita: 3, texto: '¿Qué adaptaciones o mediaciones se implementaron para atender la diversidad y necesidades individuales?', categoria: 'INCLUSION', orden: 2 },
        // Visita 4
        { id: 9, idPractica: 1, idMod: 1, visita: 4, texto: '¿Qué impacto formativo y transformador tuvo la intervención pedagógica en el grupo de infantes?', categoria: 'IMPACTO', orden: 1 },
        { id: 10, idPractica: 1, idMod: 1, visita: 4, texto: '¿Cuáles son las reflexiones docentes y oportunidades de mejora para la futura labor profesional?', categoria: 'SISTEMATIZACION', orden: 2 },
    ];

        for (const q of bancoPreguntas) {
            insertPreguntaGuia.run({
                id: q.id,
                idPractica: q.idPractica,
                idMod: q.idMod,
                visita: q.visita,
                texto: q.texto,
                categoria: q.categoria,
                orden: q.orden,
            });
        }

        try {
            db.exec('UPDATE PREGUNTA_GUIA SET ID_PREGUNTA_GUIA = ID_PREGUNTA WHERE ID_PREGUNTA_GUIA IS NULL');
            db.exec('UPDATE PREGUNTA_GUIA SET ID_MODALIDAD = ID_PRACTICA WHERE ID_MODALIDAD IS NULL');
        } catch (e) {}

    console.log('[MOCK-DB] ✔ Datos iniciales de prueba y 10 tablas normalizadas sincronizadas.');
}

function configureSemesters(db) {
    const practices = db.prepare('PRAGMA table_info(PRACTICA)').all();
    if (!practices.some(column => column.name === 'ID_INSTITUCION')) {
        db.exec(`
            ALTER TABLE PRACTICA ADD ID_INSTITUCION INTEGER REFERENCES INSTITUCION(ID_INSTITUCION);
            UPDATE PRACTICA SET ID_INSTITUCION = (
                SELECT MIN(a.ID_INSTITUCION) FROM ASIGNACION a
                WHERE a.ID_PRACTICA = PRACTICA.ID_PRACTICA
                HAVING COUNT(DISTINCT a.ID_INSTITUCION) = 1
            );
            UPDATE PRACTICA SET ID_INSTITUCION = SEMESTRE
            WHERE ID_INSTITUCION IS NULL AND SEMESTRE IN (2, 3)
              AND EXISTS (SELECT 1 FROM INSTITUCION i WHERE i.ID_INSTITUCION = PRACTICA.SEMESTRE)
              AND NOMBRE IN ('Práctica de Contextualización e Intervención Inicial', 'Práctica Pedagógica y Didáctica Docente');
        `);
    }

    const columns = db.prepare('PRAGMA table_info(USUARIO)').all();
    if (!columns.some(column => column.name === 'SEMESTRE')) {
        db.exec('ALTER TABLE USUARIO ADD SEMESTRE INTEGER CHECK (SEMESTRE IN (1, 2, 3))');
    }

    db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS UQ_TUTOR_SEMESTRE
        ON USUARIO (SEMESTRE) WHERE ROL = 'TUTOR';

        UPDATE USUARIO SET SEMESTRE = CASE EMAIL
            WHEN 'estudiante@sigpa.edu' THEN 1
            WHEN 'estudiante2@sigpa.edu' THEN 2
        END
        WHERE ROL = 'ESTUDIANTE' AND SEMESTRE IS NULL
          AND EMAIL IN ('estudiante@sigpa.edu', 'estudiante2@sigpa.edu');
    `);

    const findTutor = db.prepare(`
        SELECT ID_USUARIO FROM USUARIO WHERE ROL = 'TUTOR' AND SEMESTRE = ?
    `);
    const linkTutor = db.prepare(`
        UPDATE USUARIO SET SEMESTRE = :semestre
        WHERE EMAIL = :email AND ROL = 'TUTOR' AND SEMESTRE IS NULL
    `);
    const insertTutor = db.prepare(`
        INSERT INTO USUARIO (NOMBRE, APELLIDO, EMAIL, CONTRASENA, ROL, SEMESTRE)
        VALUES (:nombre, :apellido, :email, :contrasena, 'TUTOR', :semestre)
        ON CONFLICT (EMAIL) DO NOTHING
    `);
    const demoTutor = db.prepare("SELECT ID_USUARIO FROM USUARIO WHERE EMAIL = 'tutor@sigpa.edu' AND ROL = 'TUTOR'").get();
    if (!demoTutor) return;

    let demoPasswordHash;
    for (const tutor of tutoresDemo) {
        if (findTutor.get(tutor.semestre)) continue;
        const linked = linkTutor.run({ semestre: tutor.semestre, email: tutor.email });
        if (linked.changes === 0) {
            demoPasswordHash ??= bcrypt.hashSync('1234', 10);
            insertTutor.run({ ...tutor, contrasena: demoPasswordHash });
        }
    }
}

/**
 * Traduce sentencias SQL de Oracle a dialecto SQLite
 */
function translateSql(sql) {
    let s = sql;

    // 1. v$version -> V_VERSION
    s = s.replace(/v\$version/gi, () => 'V_VERSION');

    // 2. SYSDATE con operaciones de fecha: SYSDATE - N
    s = s.replace(/\bSYSDATE\s*-\s*(\d+)\b/gi, (match, days) => `datetime('now', '-${days} days')`);

    // 3. SYSDATE simple
    s = s.replace(/\bSYSDATE\b/gi, "datetime('now', 'localtime')");

    // 4. ) WHERE ROWNUM = 1  -->  ) LIMIT 1
    s = s.replace(/\)\s*WHERE\s+ROWNUM\s*=\s*1/gi, ') LIMIT 1');

    // 5. WHERE ROWNUM = 1  -->  LIMIT 1
    s = s.replace(/WHERE\s+ROWNUM\s*=\s*1/gi, 'LIMIT 1');

    // 6. ROWNUM <= N  -->  LIMIT N
    s = s.replace(/WHERE\s+ROWNUM\s*<=\s*(\d+)/gi, (match, n) => `LIMIT ${n}`);

    return s;
}

/**
 * Filtra los parámetros con nombre para incluir únicamente los que
 * están presentes en la consulta SQL (evita error 'Unknown named parameter' en SQLite)
 */
function filterBindsForSql(sql, binds) {
    if (!binds || typeof binds !== 'object' || Array.isArray(binds)) {
        return binds || {};
    }

    const matches = sql.match(/:[a-zA-Z0-9_]+/g) || [];
    const needed = new Set(matches.map(m => m.slice(1)));
    const filtered = {};

    for (const key of Object.keys(binds)) {
        const cleanKey = key.startsWith(':') ? key.slice(1) : key;
        if (needed.has(cleanKey)) {
            filtered[cleanKey] = binds[key];
        }
    }

    return filtered;
}

/**
 * Inicializa la conexión a la base de datos SQLite
 */
async function initSqlite() {
    if (dbInstance) return dbInstance;

    if (!DatabaseSync) {
        throw new Error(
            'No se encontró soporte de SQLite en Node.js. ' +
            'Por favor asegúrate de ejecutar con Node.js v22+ (nativo) o instalar better-sqlite3.'
        );
    }

    const activeDbPath = getDbPath();
    const dir = path.dirname(activeDbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    console.log('====================================================');
    console.log('  SIGPA — Modo Mock / Base de Datos SQLite Activa');
    console.log('====================================================');
    console.log(`[MOCK-DB] Archivo local: ${activeDbPath}`);

    const isEphemeralTestDb = path.basename(activeDbPath).startsWith('sigpa_test_');
    if (isEphemeralTestDb && fs.existsSync(activeDbPath)) {
        try {
            fs.unlinkSync(activeDbPath);
            if (fs.existsSync(`${activeDbPath}-wal`)) fs.unlinkSync(`${activeDbPath}-wal`);
            if (fs.existsSync(`${activeDbPath}-shm`)) fs.unlinkSync(`${activeDbPath}-shm`);
        } catch (e) {
            // Ignorar si el archivo está temporalmente en uso
        }
    }

    dbInstance = new DatabaseSync(activeDbPath);
    try {
        dbInstance.exec('PRAGMA journal_mode = WAL;');
        dbInstance.exec('PRAGMA busy_timeout = 5000;');
    } catch (e) {
        // Ignorar si en memoria
    }
    registerOracleCompatibilityFunctions(dbInstance);
    initSchema(dbInstance);
    dbInstance.exec('BEGIN IMMEDIATE');
    try {
        seedInitialData(dbInstance);
        configureSemesters(dbInstance);
        dbInstance.exec('COMMIT');
    } catch (error) {
        dbInstance.exec('ROLLBACK');
        dbInstance.close();
        dbInstance = null;
        throw error;
    }

    console.log('[MOCK-DB] ✔ Base de datos SQLite lista para peticiones.');
    console.log('====================================================');
    return dbInstance;
}

/**
 * Cierra la base de datos SQLite
 */
async function closeSqlite() {
    if (dbInstance) {
        try {
            if (typeof dbInstance.close === 'function') {
                dbInstance.close();
            }
            dbInstance = null;
            console.log('[MOCK-DB] Conexión SQLite cerrada.');
        } catch (e) {
            console.error('[MOCK-DB] Error al cerrar SQLite:', e.message);
        }
    }
}

/**
 * Ejecuta una consulta SQL en SQLite retornando formato compatible con Oracle
 */
let operationQueue = Promise.resolve();

function enqueueSqliteOperation(callback) {
    const operation = operationQueue.then(callback);
    operationQueue = operation.catch(() => {});
    return operation;
}

function executeSqliteQuery(sql, binds = {}) {
    return enqueueSqliteOperation(async () => {
        if (!dbInstance) await initSqlite();
        return runSqliteQuery(sql, binds);
    });
}

function runSqliteQuery(sql, binds = {}) {
    const translatedSql = translateSql(sql);
    const filteredBinds = filterBindsForSql(translatedSql, binds);

    try {
        const stmt = dbInstance.prepare(translatedSql);
        const isSelect = /^\s*(SELECT|WITH|PRAGMA)/i.test(translatedSql);

        if (isSelect) {
            const rows = stmt.all(filteredBinds);
            return {
                rows: rows || [],
                rowsAffected: 0,
            };
        } else {
            const info = stmt.run(filteredBinds);
            return {
                rows: [],
                rowsAffected: (info && info.changes) || 0,
                lastInsertRowid: info && info.lastInsertRowid,
            };
        }
    } catch (err) {
        console.error(`[MOCK-DB-ERROR] ${err.message}\nSQL original: ${sql}\nSQL traducido: ${translatedSql}`);
        throw err;
    }
}

/**
 * Crea una conexión simulada para transacciones
 */
function createConnectionAdapter() {
    return {
        async execute(sql, binds = {}) {
            return runSqliteQuery(sql, binds);
        },
        async commit() {},
        async rollback() {},
        async close() {},
    };
}

/**
 * Ejecuta transacciones dentro de SQLite
 */
function executeSqliteTransaction(callback) {
    return enqueueSqliteOperation(() => runSqliteTransaction(callback));
}

async function runSqliteTransaction(callback) {
    if (!dbInstance) {
        await initSqlite();
    }

    dbInstance.exec('BEGIN IMMEDIATE');
    const connAdapter = createConnectionAdapter();

    try {
        const result = await callback(connAdapter);
        dbInstance.exec('COMMIT;');
        return result;
    } catch (err) {
        try {
            dbInstance.exec('ROLLBACK;');
        } catch (rbErr) {
            console.error('[MOCK-DB] Error en rollback:', rbErr.message);
        }
        throw err;
    }
}

module.exports = {
    initSqlite,
    closeSqlite,
    executeSqliteQuery,
    executeSqliteTransaction,
    getDbPath,
    translateSql,
    filterBindsForSql,
};
