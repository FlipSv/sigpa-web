/**
 * SIGPA — Script CLI para inicializar y verificar Base de Datos Oracle 10g
 * Ejecutable mediante: npm run setup-db
 */
'use strict';

require('dotenv').config();
const { initPool, closePool, executeQuery } = require('./database');

async function runSetup() {
    console.log('====================================================');
    console.log('  SIGPA — Inicialización DDL Base de Datos (Oracle 10g)');
    console.log('====================================================');

    try {
        await initPool();

        // Obtener versión de Oracle
        const versionRes = await executeQuery('SELECT BANNER FROM v$version WHERE ROWNUM = 1');
        console.log(`[ORACLE] Motor: ${versionRes.rows[0].BANNER || 'Oracle 10g'}`);

        // Alter tables para sincronizar columnas si faltan
        const alterStatements = [
            `ALTER TABLE USUARIO MODIFY (CONTRASENA VARCHAR2(255))`,
            `ALTER TABLE PRACTICA ADD (DESCRIPCION VARCHAR2(500))`,
            `ALTER TABLE INSTITUCION ADD (FECHA_VENC_CONVENIO DATE)`,
            `ALTER TABLE ASIGNACION MODIFY (ID_USUARIO NULL)`,
            `ALTER TABLE ASIGNACION ADD (ID_ESTUDIANTE NUMBER(10))`,
            `ALTER TABLE ASIGNACION ADD (ID_TUTOR NUMBER(10))`,
            `ALTER TABLE ASIGNACION ADD (ESTADO_PRACTICA VARCHAR2(20) DEFAULT 'EN_CURSO')`,
            `ALTER TABLE ASIGNACION ADD (FECHA_ASIGNACION DATE)`,
            `ALTER TABLE BITACORA ADD (HORAS_SESION NUMBER(5,2) DEFAULT 16)`,
            `ALTER TABLE BITACORA ADD (URL_EVIDENCIA VARCHAR2(200))`,
            `ALTER TABLE BITACORA ADD (ESTADO_REVISION VARCHAR2(20) DEFAULT 'PENDIENTE')`,
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

        // Sincronizar bidireccionalmente ID_ESTUDIANTE e ID_USUARIO
        try {
            await executeQuery(`UPDATE ASIGNACION SET ID_ESTUDIANTE = ID_USUARIO WHERE ID_ESTUDIANTE IS NULL`);
            await executeQuery(`UPDATE ASIGNACION SET ID_USUARIO = ID_ESTUDIANTE WHERE ID_USUARIO IS NULL`);
        } catch (e) {}

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
