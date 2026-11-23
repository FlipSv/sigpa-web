/**
 * SIGPA — Script CLI para inicializar y verificar Base de Datos Oracle 10g
 * Ejecutable mediante: npm run setup-db
 */
'use strict';

require('dotenv').config();
const { initPool, closePool, executeQuery, isMockMode } = require('./database');

async function runSetup() {
    console.log('====================================================');
    console.log(`  SIGPA — Inicialización DDL Base de Datos (${isMockMode ? 'SQLite Mock' : 'Oracle 10g'})`);
    console.log('====================================================');

    try {
        if (isMockMode) {
            console.log('[MOCK-DB] Modo Mock activo: Inicializando y verificando SQLite (sigpa.db)...');
            await initPool();
            const tablesRes = await executeQuery('SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME');
            console.log('\nTablas disponibles en SQLite (sigpa.db):');
            tablesRes.rows.forEach(t => console.log(`  • ${t.TABLE_NAME}`));
            const userCount = await executeQuery('SELECT COUNT(*) AS CNT FROM USUARIO');
            console.log(`\n✔ Base de datos SQLite inicializada exitosamente con ${userCount.rows[0].CNT} usuarios sembrados.`);
            await closePool();
            process.exit(0);
        }

        await initPool();

        // Obtener versión de Oracle
        const versionRes = await executeQuery('SELECT BANNER FROM v$version WHERE ROWNUM = 1');
        console.log(`[ORACLE] Motor: ${versionRes.rows[0].BANNER || 'Oracle 10g'}`);

        // Alter tables para sincronizar columnas si faltan
        const alterStatements = [
            `ALTER TABLE USUARIO MODIFY (CONTRASENA VARCHAR2(255))`,
            `ALTER TABLE USUARIO ADD (SEMESTRE NUMBER CHECK (SEMESTRE IN (1, 2, 3)))`,
            `ALTER TABLE PRACTICA ADD (DESCRIPCION VARCHAR2(500))`,
            `ALTER TABLE PRACTICA ADD (ID_MODALIDAD NUMBER(10))`,
            `ALTER TABLE PRACTICA ADD (SEMESTRE NUMBER(2) DEFAULT 1)`,
            `ALTER TABLE PRACTICA ADD (TIPO VARCHAR2(30) DEFAULT 'OBSERVACION')`,
            `ALTER TABLE PRACTICA ADD (HORAS_REQUERIDAS NUMBER(4) DEFAULT 64)`,
            `ALTER TABLE INSTITUCION ADD (FECHA_VENC_CONVENIO DATE)`,
            `ALTER TABLE PRACTICA ADD (ID_INSTITUCION NUMBER(10) REFERENCES INSTITUCION(ID_INSTITUCION))`,
            `ALTER TABLE PRACTICA ADD (ID_TUTOR NUMBER(10) REFERENCES USUARIO(ID_USUARIO))`,
            `ALTER TABLE ASIGNACION MODIFY (ID_USUARIO NULL)`,
            `ALTER TABLE ASIGNACION ADD (ID_ESTUDIANTE NUMBER(10))`,
            `ALTER TABLE ASIGNACION ADD (ID_TUTOR NUMBER(10))`,
            `ALTER TABLE ASIGNACION ADD (ESTADO_PRACTICA VARCHAR2(20) DEFAULT 'EN_CURSO')`,
            `ALTER TABLE ASIGNACION ADD (ESTADO_APROBACION VARCHAR2(20) DEFAULT 'APROBADA')`,
            `ALTER TABLE ASIGNACION ADD (FECHA_ASIGNACION DATE)`,
            `ALTER TABLE BITACORA ADD (HORAS_SESION NUMBER(5,2) DEFAULT 16)`,
            `ALTER TABLE BITACORA ADD (URL_EVIDENCIA VARCHAR2(200))`,
            `ALTER TABLE BITACORA ADD (ESTADO_REVISION VARCHAR2(20) DEFAULT 'PENDIENTE')`,
            `ALTER TABLE BITACORA ADD (ID_VISITA NUMBER(10))`,
            `ALTER TABLE USUARIO ADD (ID_INSTITUCION NUMBER(10))`,
            `ALTER TABLE VISITA ADD (ID_ASIGNACION NUMBER(10))`,
            `ALTER TABLE VISITA ADD (ID_PRACTICA NUMBER(10))`,
            `ALTER TABLE PREGUNTA_GUIA ADD (CATEGORIA VARCHAR2(100) DEFAULT 'PEDAGOGICA')`,
            `ALTER TABLE PREGUNTA_GUIA ADD (ORDEN NUMBER(4) DEFAULT 1)`,
            `ALTER TABLE PREGUNTA_GUIA ADD (ID_MODALIDAD NUMBER(10))`,
            `ALTER TABLE PREGUNTA_GUIA ADD (ID_PREGUNTA_GUIA NUMBER(10))`,
        ];

        console.log('\nSincronizando columnas del esquema en Oracle...');
        for (const sql of alterStatements) {
            try {
                await executeQuery(sql);
                console.log(`  ✔ Modificación/Columna aplicada: ${sql}`);
            } catch (err) {
                // ORA-01430: column already exists
                // ORA-01451: column to be modified to NULL is already NULL
                // ORA-01442: column to be modified to NOT NULL is already NOT NULL
                if (err.message.includes('ORA-01430') || err.message.includes('ORA-01451') || err.message.includes('ORA-01442')) {
                    // Columna o restricción ya en el estado deseado
                } else {
                    console.warn(`  ℹ️  Aviso: ${err.message}`);
                }
            }
        }

        try {
            await executeQuery(`CREATE UNIQUE INDEX UQ_TUTOR_SEMESTRE ON USUARIO (
                CASE WHEN ROL = 'TUTOR' THEN SEMESTRE END
            )`);
        } catch (err) {
            if (!err.message.includes('ORA-00955') && !err.message.includes('ORA-01408')) throw err;
        }

        // Vincular prácticas históricas cuando todas sus asignaciones apuntan a la misma institución.
        await executeQuery(`
            UPDATE PRACTICA p SET ID_INSTITUCION = (
                SELECT MIN(a.ID_INSTITUCION) FROM ASIGNACION a WHERE a.ID_PRACTICA = p.ID_PRACTICA
            )
            WHERE p.ID_INSTITUCION IS NULL AND 1 = (
                SELECT COUNT(DISTINCT a.ID_INSTITUCION) FROM ASIGNACION a WHERE a.ID_PRACTICA = p.ID_PRACTICA
            )
        `);

        // Sincronizar bidireccionalmente ID_ESTUDIANTE e ID_USUARIO
        try {
            await executeQuery(`UPDATE ASIGNACION SET ID_ESTUDIANTE = ID_USUARIO WHERE ID_ESTUDIANTE IS NULL`);
            await executeQuery(`UPDATE ASIGNACION SET ID_USUARIO = ID_ESTUDIANTE WHERE ID_USUARIO IS NULL`);
        } catch (e) {}

        // Asegurar vista de compatibilidad PREGUNTA sobre PREGUNTA_GUIA
        try {
            // Verificar si PREGUNTA es una tabla en lugar de una vista
            const objRes = await executeQuery(`SELECT OBJECT_TYPE FROM USER_OBJECTS WHERE OBJECT_NAME = 'PREGUNTA'`);
            if (objRes.rows && objRes.rows.length > 0 && objRes.rows[0].OBJECT_TYPE === 'TABLE') {
                // Migrar cualquier pregunta huérfana de PREGUNTA a PREGUNTA_GUIA antes de reemplazarla por la vista
                await executeQuery(`
                    MERGE INTO PREGUNTA_GUIA g
                    USING PREGUNTA p
                    ON (g.ID_PREGUNTA = p.ID_PREGUNTA)
                    WHEN NOT MATCHED THEN
                        INSERT (ID_PREGUNTA, ID_PREGUNTA_GUIA, ID_PRACTICA, ID_MODALIDAD, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN)
                        VALUES (p.ID_PREGUNTA, p.ID_PREGUNTA, p.ID_PRACTICA, p.ID_PRACTICA, p.NUMERO_VISITA, p.TEXTO_PREGUNTA, NVL(p.CATEGORIA, 'PEDAGOGICA'), NVL(p.ORDEN, 1))
                `);
                await executeQuery(`DROP TABLE PREGUNTA CASCADE CONSTRAINTS`);
                console.log('  ✔ Tabla antigua PREGUNTA migrada a PREGUNTA_GUIA.');
            }
            await executeQuery(`
                CREATE OR REPLACE VIEW PREGUNTA AS
                SELECT ID_PREGUNTA, ID_PRACTICA, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN
                FROM PREGUNTA_GUIA
            `);
            console.log('  ✔ Vista de compatibilidad PREGUNTA sincronizada con éxito.');
        } catch (vErr) {
            console.warn('  ℹ️  Aviso al sincronizar vista PREGUNTA:', vErr.message);
        }

        // Listar tablas y columnas
        const tablesRes = await executeQuery('SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME');
        console.log('\nTablas en el esquema Oracle:');
        tablesRes.rows.forEach(t => console.log(`  • ${t.TABLE_NAME}`));

        console.log('\n✔ Inicialización de Oracle 10g finalizada con éxito.');
        await closePool();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en setup Oracle:', err.message);
        process.exit(1);
    }
}

runSetup();
