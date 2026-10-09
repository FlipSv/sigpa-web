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
const dbFilePath = process.env.SQLITE_DB_PATH
    ? path.resolve(process.cwd(), process.env.SQLITE_DB_PATH)
    : path.resolve(__dirname, '../../sigpa.db');

/**
 * Obtiene la ruta del archivo de base de datos SQLite
 */
function getDbPath() {
    return dbFilePath;
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
 * Inicializa el esquema DDL y vistas de compatibilidad
 */
function initSchema(db) {
    db.exec(`
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

        -- 2. Tabla PRACTICA
        CREATE TABLE IF NOT EXISTS PRACTICA (
            ID_PRACTICA INTEGER PRIMARY KEY,
            NOMBRE TEXT NOT NULL,
            SEMESTRE INTEGER DEFAULT 1,
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

        -- 4. Tabla ASIGNACION
        CREATE TABLE IF NOT EXISTS ASIGNACION (
            ID_ASIGNACION INTEGER PRIMARY KEY,
            ID_USUARIO INTEGER,
            ID_ESTUDIANTE INTEGER,
            ID_TUTOR INTEGER,
            ID_PRACTICA INTEGER,
            ID_INSTITUCION INTEGER,
            HORAS_ACUMULADAS REAL DEFAULT 0,
            ESTADO TEXT DEFAULT 'APROBADA',
            ESTADO_APROBACION TEXT DEFAULT 'APROBADA',
            ESTADO_PRACTICA TEXT DEFAULT 'EN_CURSO',
            FECHA_ASIGNACION TEXT,
            FOREIGN KEY (ID_ESTUDIANTE) REFERENCES USUARIO(ID_USUARIO),
            FOREIGN KEY (ID_PRACTICA) REFERENCES PRACTICA(ID_PRACTICA),
            FOREIGN KEY (ID_INSTITUCION) REFERENCES INSTITUCION(ID_INSTITUCION)
        );

        -- 5. Tabla BITACORA
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

        -- 6. Tabla EVALUACION
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

        -- 7. Tablas de Preguntas Pedagógicas
        CREATE TABLE IF NOT EXISTS PREGUNTA (
            ID_PREGUNTA INTEGER PRIMARY KEY,
            ID_PRACTICA INTEGER DEFAULT 1,
            NUMERO_VISITA INTEGER DEFAULT 1,
            TEXTO_PREGUNTA TEXT NOT NULL,
            ORDEN INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS PREGUNTA_GUIA (
            ID_PREGUNTA INTEGER PRIMARY KEY,
            ID_PRACTICA INTEGER DEFAULT 1,
            NUMERO_VISITA INTEGER DEFAULT 1,
            TEXTO_PREGUNTA TEXT NOT NULL,
            ORDEN INTEGER DEFAULT 1
        );
    `);
}

/**
 * Inserta datos de prueba realistas para que el equipo pueda probar
 * todos los roles, pantallas y flujos inmediatamente.
 */
function seedInitialData(db) {
    const userCount = db.prepare('SELECT COUNT(*) AS CNT FROM USUARIO').get().CNT;
    if (userCount > 0) {
        return; // Ya contiene datos
    }

    console.log('[MOCK-DB] Sembrando datos iniciales de prueba en SQLite...');

    // Contraseña estándar '1234' cifrada con bcrypt
    const passHash = bcrypt.hashSync('1234', 10);

    // 1. Usuarios
    const insertUsuario = db.prepare(`
        INSERT INTO USUARIO (ID_USUARIO, NOMBRE, APELLIDO, EMAIL, CONTRASENA, ROL, ACTIVO)
        VALUES (:id, :nombre, :apellido, :email, :contrasena, :rol, 'S')
    `);

    const usuarios = [
        { id: 1, nombre: 'Ana', apellido: 'Martínez (Directora)', email: 'director@sigpa.edu', contrasena: passHash, rol: 'DIRECTOR' },
        { id: 2, nombre: 'Carlos', apellido: 'Coordinador (Tutor)', email: 'coord@sigpa.edu', contrasena: passHash, rol: 'COORDINADOR' },
        { id: 3, nombre: 'Laura', apellido: 'Pérez (Estudiante)', email: 'estudiante@sigpa.edu', contrasena: passHash, rol: 'ESTUDIANTE' },
        { id: 4, nombre: 'Mateo', apellido: 'Gómez (Tutor)', email: 'tutor@sigpa.edu', contrasena: passHash, rol: 'TUTOR' },
        { id: 5, nombre: 'Clara', apellido: 'Rojas (Asesora In Situ)', email: 'asesor@sigpa.edu', contrasena: passHash, rol: 'ASESOR' },
        { id: 6, nombre: 'Andrés', apellido: 'Silva (Estudiante)', email: 'estudiante2@sigpa.edu', contrasena: passHash, rol: 'ESTUDIANTE' },
    ];

    for (const u of usuarios) {
        insertUsuario.run(u);
    }

    // 2. Prácticas Académicas
    const insertPractica = db.prepare(`
        INSERT INTO PRACTICA (ID_PRACTICA, NOMBRE, SEMESTRE, TIPO, HORAS_REQUERIDAS, ESTADO, DESCRIPCION)
        VALUES (:id, :nombre, :semestre, :tipo, :horas, 'ABIERTA', :descripcion)
    `);

    const practicas = [
        { id: 1, nombre: 'Práctica de Observación en Infancia', semestre: 1, tipo: 'OBSERVACION', horas: 64, descripcion: 'Observación diagnóstica en centros infantiles y jardines.' },
        { id: 2, nombre: 'Práctica de Contextualización e Intervención Inicial', semestre: 2, tipo: 'INTERVENCION', horas: 64, descripcion: 'Acompañamiento pedagógico formativo en aula.' },
        { id: 3, nombre: 'Práctica Pedagógica y Didáctica Docente', semestre: 3, tipo: 'DOCENTE', horas: 64, descripcion: 'Planificación de unidades didácticas y proyectos lúdicos.' },
        { id: 4, nombre: 'Práctica de Investigación en Primera Infancia', semestre: 4, tipo: 'INVESTIGATIVA', horas: 64, descripcion: 'Sistematización de experiencias y diario de campo.' },
        { id: 5, nombre: 'Práctica Integral Comunitaria (Formato P5)', semestre: 5, tipo: 'INTERVENCION', horas: 80, descripcion: 'Proyectos educativos comunitarios y familiares.' },
        { id: 6, nombre: 'Práctica de Grado y Liderazgo Infantil (Formato P6)', semestre: 6, tipo: 'PROFESIONAL', horas: 96, descripcion: 'Gestión integral pedagógica en instituciones oficiales y privadas.' },
    ];

    for (const p of practicas) {
        insertPractica.run(p);
    }

    // 3. Instituciones Educativas con Convenio
    const insertInstitucion = db.prepare(`
        INSERT INTO INSTITUCION (ID_INSTITUCION, NOMBRE, DIRECCION, TELEFONO, CONVENIO_ACTIVO, CUPOS_DISPONIBLES, FECHA_VENC_CONVENIO)
        VALUES (:id, :nombre, :direccion, :telefono, 'S', :cupos, :vencimiento)
    `);

    const instituciones = [
        { id: 1, nombre: 'Colegio Integrado UDI Kids', direccion: 'Calle 9 # 23-45 Bucaramanga', telefono: '6076987654', cupos: 10, vencimiento: '2028-12-31' },
        { id: 2, nombre: 'Jardín Infantil Pequeños Sabios', direccion: 'Carrera 27 # 45-12 Bucaramanga', telefono: '6076451234', cupos: 6, vencimiento: '2027-11-30' },
        { id: 3, nombre: 'Centro Educativo San Francisco', direccion: 'Calle 34 # 19-20 Floridablanca', telefono: '6076328901', cupos: 8, vencimiento: '2028-06-15' },
        { id: 4, nombre: 'Liceo Pedagógico El Prado', direccion: 'Carrera 33 # 52-10 Cabecera', telefono: '6076572211', cupos: 4, vencimiento: '2027-09-20' },
    ];

    for (const inst of instituciones) {
        insertInstitucion.run(inst);
    }

    // 4. Asignaciones
    const insertAsignacion = db.prepare(`
        INSERT INTO ASIGNACION (ID_ASIGNACION, ID_USUARIO, ID_ESTUDIANTE, ID_TUTOR, ID_PRACTICA, ID_INSTITUCION, HORAS_ACUMULADAS, ESTADO, ESTADO_APROBACION, ESTADO_PRACTICA, FECHA_ASIGNACION)
        VALUES (:id, :idUsuario, :idEstudiante, :idTutor, :idPractica, :idInstitucion, :horas, 'APROBADA', 'APROBADA', 'EN_CURSO', :fecha)
    `);

    insertAsignacion.run({
        id: 1,
        idUsuario: 3,
        idEstudiante: 3,
        idTutor: 2,
        idPractica: 1,
        idInstitucion: 1,
        horas: 16.0,
        fecha: '2026-08-01',
    });

    // 5. Bitácoras
    const insertBitacora = db.prepare(`
        INSERT INTO BITACORA (ID_BITACORA, ID_ASIGNACION, NUMERO_VISITA, FECHA_REGISTRO, HORAS_SESION, ACTIVIDADES, OBSERVACIONES, URL_EVIDENCIA, ESTADO_REVISION)
        VALUES (:id, :idAsignacion, :visita, :fecha, :horas, :actividades, :observaciones, :evidencia, :estado)
    `);

    insertBitacora.run({
        id: 1,
        idAsignacion: 1,
        visita: 1,
        fecha: '2026-08-15',
        horas: 16.0,
        actividades: '[FASE 1 - INICIO / MOTIVACIÓN]:\nPresentación ante el grupo con dinámica de títeres y bienvenida afectiva.\n\n[FASE 2 - DESARROLLO EN AULA]:\nObservación y registro de dinámicas de interacción grupal, motricidad y juego libre.\n\n[FASE 3 - CIERRE Y EVALUACIÓN FORMATIVA]:\nRonda de preguntas formativas y dibujo colectivo de los aprendizajes alcanzados.',
        observaciones: '[REFLEXIÓN PEDAGÓGICA DOCENTE]:\nLos niños mostraron alta motivación; se requiere reforzar tiempos en la transición de actividades.',
        evidencia: 'https://drive.google.com/drive/folders/evidencia_visita_1_udi',
        estado: 'CALIFICADA',
    });

    // 6. Evaluaciones
    const insertEvaluacion = db.prepare(`
        INSERT INTO EVALUACION (ID_EVALUACION, ID_BITACORA, ID_EVALUADOR, TIPO_EVALUADOR, NOTA, COMENTARIOS, FECHA_EVALUACION)
        VALUES (:id, :idBitacora, :idEvaluador, :tipo, :nota, :comentarios, :fecha)
    `);

    insertEvaluacion.run({
        id: 1,
        idBitacora: 1,
        idEvaluador: 2,
        tipo: 'TUTOR',
        nota: 4.8,
        comentarios: 'Excelente registro pedagógico y análisis reflexivo de la primera sesión.',
        fecha: '2026-08-16 10:00:00',
    });

    insertEvaluacion.run({
        id: 2,
        idBitacora: 1,
        idEvaluador: 5,
        tipo: 'ASESOR',
        nota: 4.6,
        comentarios: 'Acompañamiento pedagógico presencial verificado y acorde con el plan de práctica.',
        fecha: '2026-08-17 11:30:00',
    });

    // 7. Preguntas Guía
    const insertPregunta = db.prepare(`
        INSERT INTO PREGUNTA (ID_PREGUNTA, ID_PRACTICA, NUMERO_VISITA, TEXTO_PREGUNTA, ORDEN)
        VALUES (:id, :idPractica, :visita, :texto, :orden)
    `);

    const preguntas = [
        { id: 1, idPractica: 1, visita: 1, texto: '¿Cómo caracterizarías el ambiente socioemocional del aula en esta primera visita?', orden: 1 },
        { id: 2, idPractica: 1, visita: 1, texto: '¿Qué estrategias utilizó la docente para captar la atención de los infantes?', orden: 2 },
        { id: 3, idPractica: 1, visita: 2, texto: '¿Qué recursos didácticos facilitaron el aprendizaje activo en la sesión?', orden: 1 },
        { id: 4, idPractica: 1, visita: 2, texto: '¿Cómo se integraron las actividades motrices en el plan curricular?', orden: 2 },
    ];

    for (const q of preguntas) {
        insertPregunta.run(q);
        db.prepare('INSERT INTO PREGUNTA_GUIA (ID_PREGUNTA, ID_PRACTICA, NUMERO_VISITA, TEXTO_PREGUNTA, ORDEN) VALUES (:id, :idPractica, :visita, :texto, :orden)').run(q);
    }

    console.log('[MOCK-DB] ✔ Datos iniciales de prueba sembrados correctamente.');
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

    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    console.log('====================================================');
    console.log('  SIGPA — Modo Mock / Base de Datos SQLite Activa');
    console.log('====================================================');
    console.log(`[MOCK-DB] Archivo local: ${dbFilePath}`);

    dbInstance = new DatabaseSync(dbFilePath);
    registerOracleCompatibilityFunctions(dbInstance);
    initSchema(dbInstance);
    seedInitialData(dbInstance);

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
async function executeSqliteQuery(sql, binds = {}, options = {}) {
    if (!dbInstance) {
        await initSqlite();
    }

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
        async execute(sql, binds = {}, options = {}) {
            return executeSqliteQuery(sql, binds, options);
        },
        async commit() {},
        async rollback() {},
        async close() {},
    };
}

/**
 * Ejecuta transacciones dentro de SQLite
 */
async function executeSqliteTransaction(callback) {
    if (!dbInstance) {
        await initSqlite();
    }

    dbInstance.exec('BEGIN TRANSACTION;');
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
};
