/**
 * SIGPA — Suite de Pruebas de Integración con Oracle 10g
 */
'use strict';

const app = require('./src/app');
const http = require('http');
const { initPool, closePool } = require('./src/config/database');

const PORT = 8099;

async function runTests() {
    console.log('====================================================');
    console.log('  SIGPA — Tests de Endpoints con Oracle 10g');
    console.log('====================================================');

    try {
        await initPool();
    } catch (e) {
        console.error('No se puede ejecutar test_api.js sin conexión activa a Oracle 10g.');
        process.exit(1);
    }

    const server = app.listen(PORT, async () => {
        console.log(`[TEST] Servidor iniciado en http://localhost:${PORT}`);
        let passed = 0;
        let failed = 0;

        async function req(method, path, body = null) {
            return new Promise((resolve, reject) => {
                const url = `http://localhost:${PORT}${path}`;
                const opts = {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                };
                const r = http.request(url, opts, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            resolve({ status: res.statusCode, data: JSON.parse(data) });
                        } catch (e) {
                            resolve({ status: res.statusCode, data });
                        }
                    });
                });
                r.on('error', reject);
                if (body) r.write(JSON.stringify(body));
                r.end();
            });
        }

        async function test(name, fn) {
            try {
                await fn();
                console.log(`  ✔ PASS: ${name}`);
                passed++;
            } catch (e) {
                console.error(`  ❌ FAIL: ${name} -> ${e.message}`);
                failed++;
            }
        }

        console.log('\n--- Ejecutando Pruebas Generales ---');

        await test('GET /api/test-db', async () => {
            const res = await req('GET', '/api/test-db');
            if (res.status !== 200 || !res.data.success) throw new Error('Test DB falló');
        });

        await test('POST /api/login (Director)', async () => {
            const res = await req('POST', '/api/login', { email: 'director@sigpa.edu', contrasena: '1234' });
            if (res.status !== 200 || res.data.usuario.rol !== 'DIRECTOR') throw new Error('Login director falló');
        });

        await test('POST /api/login (Estudiante)', async () => {
            const res = await req('POST', '/api/login', { email: 'estudiante@sigpa.edu', contrasena: '1234' });
            if (res.status !== 200 || res.data.usuario.rol !== 'ESTUDIANTE') throw new Error('Login estudiante falló');
        });

        console.log('\n--- Módulo Director ---');

        await test('GET /api/director/kpis', async () => {
            const res = await req('GET', '/api/director/kpis');
            if (res.status !== 200 || typeof res.data.data.totalEstudiantes !== 'number') throw new Error('KPIs falló');
        });

        await test('GET /api/director/estado', async () => {
            const res = await req('GET', '/api/director/estado');
            if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error('Prácticas falló');
        });

        await test('GET /api/director/instituciones', async () => {
            const res = await req('GET', '/api/director/instituciones');
            if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error('Instituciones falló');
        });

        await test('GET /api/director/asignaciones', async () => {
            const res = await req('GET', '/api/director/asignaciones');
            if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error('Asignaciones falló');
        });

        console.log('\n--- Módulo Estudiante (4 Funcionalidades Pedagógicas) ---');

        let idAsignacionEstudiante = 1;

        await test('1. GET /api/estudiante/asignacion', async () => {
            const res = await req('GET', '/api/estudiante/asignacion?id_estudiante=3');
            if (res.status !== 200 || !res.data.success) throw new Error('Asignación falló: ' + JSON.stringify(res.data));
            if (res.data.data && res.data.data.idAsignacion) idAsignacionEstudiante = res.data.data.idAsignacion;
        });

        await test('2. GET /api/estudiante/progreso (Medidor Predictivo / Semáforo)', async () => {
            const res = await req('GET', '/api/estudiante/progreso?id_estudiante=3');
            if (res.status !== 200 || !res.data.success) throw new Error('Progreso falló');
            const d = res.data.data;
            if (!['VERDE', 'AMARILLO', 'ROJO'].includes(d.semaforo)) throw new Error('Semáforo inválido: ' + d.semaforo);
            if (typeof d.porcentaje !== 'number') throw new Error('Porcentaje inválido');
            if (!d.fechaEstimadaCulminacion) throw new Error('Fecha estimada no generada');
        });

        await test('3. GET /api/estudiante/preguntas-guia/:id_practica/:visita (Reflexión Docente)', async () => {
            const res = await req('GET', '/api/estudiante/preguntas-guia/1/1');
            if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.data)) throw new Error('Preguntas guía falló');
            if (res.data.data.length === 0) throw new Error('No se retornaron preguntas guía');
        });

        await test('4. GET /api/estudiante/timeline (Línea de Tiempo Pedagógica)', async () => {
            const res = await req('GET', '/api/estudiante/timeline?id_estudiante=3');
            if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.data)) throw new Error('Timeline falló');
        });

        await test('5. GET /api/estudiante/evidencias (Portafolio Digital)', async () => {
            const res = await req('GET', '/api/estudiante/evidencias?id_estudiante=3');
            if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.data)) throw new Error('Evidencias falló');
        });

        await test('6. POST /api/estudiante/bitacora (Asistente Guiado por Momentos)', async () => {
            const payload = {
                id_asignacion: idAsignacionEstudiante,
                visita: 2,
                horas: 8,
                inicio_motivacion: 'Dinámica de rompehielos con títeres y contextualización de la sesión.',
                desarrollo: 'Taller de lectura compartida y actividades de estimulación del lenguaje.',
                cierre_evaluacion: 'Ronda de preguntas formativas y dibujo colectivo de los aprendizajes.',
                reflexion_docente: 'Los niños mostraron alta receptividad; se requiere reforzar tiempos en la transición.',
                evidencia: 'https://drive.google.com/drive/folders/ejemplo_evidencia_visita2'
            };
            const res = await req('POST', '/api/estudiante/bitacora', payload);
            if (res.status !== 200 || !res.data.success) throw new Error('Registro estructurado falló: ' + JSON.stringify(res.data));
        });

        console.log(`\n====================================================`);
        console.log(`  Resultado Final: ${passed} pasadas, ${failed} fallidas.`);
        console.log(`====================================================`);

        server.close(async () => {
            await closePool();
            process.exit(failed > 0 ? 1 : 0);
        });
    });
}

runTests();

