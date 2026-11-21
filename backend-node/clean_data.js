/**
 * SIGPA — Script para limpiar datos de prueba
 * Borra todos los datos excepto los usuarios de la tabla USUARIO.
 * Funciona tanto en Oracle como en SQLite según la configuración de .env
 */
'use strict';

require('dotenv').config();
const { initPool, closePool, executeQuery, isMockMode } = require('./src/config/database');

async function cleanData() {
    console.log('====================================================');
    console.log('  SIGPA — Limpieza de Datos de Prueba');
    console.log(`  Motor: ${isMockMode ? 'SQLite Mock' : 'Oracle 10g'}`);
    console.log('====================================================\n');

    try {
        await initPool();
        console.log('[OK] Conexión establecida.\n');

        // Orden de borrado respetando dependencias de FK (hijos primero)
        const tablesToClean = [
            'PREGUNTA_GUIA',
            'PREGUNTA',
            'EVIDENCIA',
            'EVALUACION',
            'VISITA',
            'BITACORA',
            'ASIGNACION',
            'PRACTICA',
            'INSTITUCION',
            'MODALIDAD',
        ];

        for (const table of tablesToClean) {
            try {
                const countBefore = await executeQuery(`SELECT COUNT(*) AS CNT FROM ${table}`);
                const before = countBefore.rows[0].CNT;

                await executeQuery(`DELETE FROM ${table}`);

                console.log(`[LIMPIO] ${table}: ${before} registros eliminados.`);
            } catch (err) {
                if (err.message && err.message.includes('does not exist')) {
                    console.log(`[SKIP]  ${table}: Tabla no existe, saltando.`);
                } else {
                    console.error(`[ERROR] ${table}: ${err.message}`);
                }
            }
        }

        // Verificar que los usuarios siguen intactos
        console.log('\n--- Verificación de Usuarios (intactos) ---');
        const users = await executeQuery('SELECT ID_USUARIO, NOMBRE, APELLIDO, EMAIL, ROL FROM USUARIO ORDER BY ID_USUARIO');
        for (const u of users.rows) {
            console.log(`  [USER] ID=${u.ID_USUARIO} | ${u.NOMBRE} ${u.APELLIDO} | ${u.EMAIL} | ROL=${u.ROL}`);
        }
        console.log(`\n[OK] Total de usuarios preservados: ${users.rows.length}`);

        // Resetear secuencias en Oracle (no aplica para SQLite)
        if (!isMockMode) {
            console.log('\n--- Reseteando secuencias Oracle ---');
            const sequences = [
                { name: 'SEQ_MODALIDAD', start: 1 },
                { name: 'SEQ_INSTITUCION', start: 1 },
                { name: 'SEQ_PRACTICA', start: 1 },
                { name: 'SEQ_ASIGNACION', start: 1 },
                { name: 'SEQ_BITACORA', start: 1 },
                { name: 'SEQ_VISITA', start: 1 },
                { name: 'SEQ_EVALUACION', start: 1 },
                { name: 'SEQ_EVIDENCIA', start: 1 },
                { name: 'SEQ_PREGUNTA', start: 1 },
                { name: 'SEQ_PREGUNTA_GUIA', start: 1 },
            ];
            for (const seq of sequences) {
                try {
                    await executeQuery(`DROP SEQUENCE ${seq.name}`);
                    await executeQuery(`CREATE SEQUENCE ${seq.name} START WITH ${seq.start} INCREMENT BY 1 NOCACHE`);
                    console.log(`  [SEQ] ${seq.name} reseteada a ${seq.start}.`);
                } catch (err) {
                    console.error(`  [SEQ ERROR] ${seq.name}: ${err.message}`);
                }
            }
        }

        console.log('\n====================================================');
        console.log('  LIMPIEZA COMPLETADA');
        console.log('  Los usuarios de prueba siguen intactos.');
        console.log('  Todas las demás tablas están vacías.');
        console.log('====================================================');

    } catch (err) {
        console.error('[FATAL] Error durante la limpieza:', err.message);
    } finally {
        await closePool();
        process.exit(0);
    }
}

cleanData();
