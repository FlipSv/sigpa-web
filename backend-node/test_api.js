/**
 * SIGPA — Suite de Pruebas de Integración con Oracle 10g
 * Incluye pruebas de seguridad: JWT, Roles y validación de contraseñas
 */
'use strict';

const app = require('./src/app');
const http = require('http');
const { initPool, closePool } = require('./src/config/database');

const PORT = 8099;

async function runTests() {
    console.log('====================================================');
    console.log('  SIGPA — Tests de Endpoints y Seguridad (JWT + Roles)');
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

        let directorToken = null;
        let estudianteToken = null;

        async function req(method, path, body = null, token = null) {
            return new Promise((resolve, reject) => {
                const url = `http://localhost:${PORT}${path}`;
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const opts = { method, headers };
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

        console.log('\n--- Ejecutando Pruebas de Conexión y Autenticación ---');

        await test('GET /api/test-db', async () => {
            const res = await req('GET', '/api/test-db');
            if (res.status !== 200 || !res.data.success) throw new Error('Test DB falló');
        });

        await test('POST /api/login (Director) -> Genera JWT', async () => {
            const res = await req('POST', '/api/login', { email: 'director@sigpa.edu', contrasena: '1234' });
            if (res.status !== 200 || res.data.usuario.rol !== 'DIRECTOR') throw new Error('Login director falló');
            if (!res.data.token) throw new Error('No se generó token JWT para el director');
            directorToken = res.data.token;
        });

        await test('POST /api/login (Estudiante) -> Genera JWT', async () => {
            const res = await req('POST', '/api/login', { email: 'estudiante@sigpa.edu', contrasena: '1234' });
            if (res.status !== 200 || res.data.usuario.rol !== 'ESTUDIANTE') throw new Error('Login estudiante falló');
            if (!res.data.token) throw new Error('No se generó token JWT para el estudiante');
            estudianteToken = res.data.token;
        });

        await test('POST /api/login (Credenciales inválidas) -> Retorna 401', async () => {
            const res = await req('POST', '/api/login', { email: 'director@sigpa.edu', contrasena: 'clave_incorrecta_99' });
            if (res.status !== 401) throw new Error(`Se esperaba 401 y se obtuvo ${res.status}`);
        });

        console.log('\n--- Pruebas de Seguridad y Control de Acceso (Middlewares) ---');

        await test('Seguridad 1: GET /api/director/kpis sin Token -> Retorna 401 Unauthorized', async () => {
            const res = await req('GET', '/api/director/kpis');
            if (res.status !== 401) throw new Error(`Se esperaba 401 y se obtuvo ${res.status}`);
        });

        await test('Seguridad 2: GET /api/director/kpis con Token Estudiante -> Retorna 403 Forbidden', async () => {
            const res = await req('GET', '/api/director/kpis', null, estudianteToken);
            if (res.status !== 403) throw new Error(`Se esperaba 403 y se obtuvo ${res.status}`);
        });

        await test('Seguridad 3: GET /api/director/kpis con Token Director -> Retorna 200 OK', async () => {
            const res = await req('GET', '/api/director/kpis', null, directorToken);
            if (res.status !== 200) throw new Error(`Se esperaba 200 y se obtuvo ${res.status}`);
        });

        console.log('\n--- Módulo Director (Con Token Autorizado) ---');

        await test('GET /api/director/kpis', async () => {
            const res = await req('GET', '/api/director/kpis', null, directorToken);
            if (res.status !== 200 || typeof res.data.data.totalEstudiantes !== 'number') throw new Error('KPIs falló');
        });

        await test('GET /api/director/estado', async () => {
            const res = await req('GET', '/api/director/estado', null, directorToken);
            if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error('Prácticas falló');
        });

        let testInstitucionId = 1;
        await test('GET /api/director/instituciones', async () => {
            const res = await req('GET', '/api/director/instituciones', null, directorToken);
            if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error('Instituciones falló');
            const instValida = res.data.data.find(i => i.convenioActivo && i.ocupados < i.cupos);
            if (instValida) testInstitucionId = instValida.id;
        });

        await test('GET /api/director/asignaciones', async () => {
            const res = await req('GET', '/api/director/asignaciones', null, directorToken);
            if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error('Asignaciones falló');
        });

        await test('POST /api/director/asignar (Asignación Institucional Formal)', async () => {
            const res = await req('POST', '/api/director/asignar', {
                id_estudiante: 3,
                id_practica: 1,
                id_institucion: testInstitucionId,
                id_tutor: 2
            }, directorToken);
            if (res.status !== 200 || !res.data.success) throw new Error('Asignación institucional falló: ' + JSON.stringify(res.data));
        });

        console.log('\n--- Módulo Estudiante (Con Token Autorizado) ---');

        let idAsignacionEstudiante = 1;

        await test('1. GET /api/estudiante/asignacion', async () => {
            const res = await req('GET', '/api/estudiante/asignacion?id_estudiante=3', null, estudianteToken);
            if (res.status !== 200 || !res.data.success) throw new Error('Asignación falló: ' + JSON.stringify(res.data));
            if (res.data.data && res.data.data.idAsignacion) idAsignacionEstudiante = res.data.data.idAsignacion;
        });

        await test('2. GET /api/estudiante/progreso (Medidor Predictivo / Semáforo)', async () => {
            const res = await req('GET', '/api/estudiante/progreso?id_estudiante=3', null, estudianteToken);
            if (res.status !== 200 || !res.data.success) throw new Error('Progreso falló');
            const d = res.data.data;
            if (!['VERDE', 'AMARILLO', 'ROJO'].includes(d.semaforo)) throw new Error('Semáforo inválido: ' + d.semaforo);
            if (typeof d.porcentaje !== 'number') throw new Error('Porcentaje inválido');
            if (!d.fechaEstimadaCulminacion) throw new Error('Fecha estimada no generada');
        });

        await test('3. GET /api/estudiante/preguntas-guia/:id_practica/:visita (Reflexión Docente)', async () => {
            const res = await req('GET', '/api/estudiante/preguntas-guia/1/1', null, estudianteToken);
            if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.data)) throw new Error('Preguntas guía falló');
            if (res.data.data.length === 0) throw new Error('No se retornaron preguntas guía');
        });

        await test('4. GET /api/estudiante/timeline (Línea de Tiempo Pedagógica)', async () => {
            const res = await req('GET', '/api/estudiante/timeline?id_estudiante=3', null, estudianteToken);
            if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.data)) throw new Error('Timeline falló');
        });

        await test('5. GET /api/estudiante/evidencias (Portafolio Digital)', async () => {
            const res = await req('GET', '/api/estudiante/evidencias?id_estudiante=3', null, estudianteToken);
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
            const res = await req('POST', '/api/estudiante/bitacora', payload, estudianteToken);
            if (res.status !== 200 || !res.data.success) throw new Error('Registro estructurado falló: ' + JSON.stringify(res.data));
        });

        await test('7. POST /api/estudiante/bitacora (Rechazar si excede 8 horas)', async () => {
            const payload = {
                id_asignacion: idAsignacionEstudiante,
                visita: 3,
                horas: 10, // Excede el máximo permitido de 8
                inicio_motivacion: 'Inicio de sesión.',
                desarrollo: 'Desarrollo en aula.',
                cierre_evaluacion: 'Cierre formativo.'
            };
            const res = await req('POST', '/api/estudiante/bitacora', payload, estudianteToken);
            if (res.status !== 400) throw new Error(`Se esperaba 400 pero se obtuvo ${res.status}`);
        });

        await test('8. POST /api/estudiante/bitacora (Rechazar si fecha es futura)', async () => {
            const payload = {
                id_asignacion: idAsignacionEstudiante,
                visita: 3,
                horas: 4,
                fecha: '2099-12-31', // Fecha en el futuro
                inicio_motivacion: 'Inicio de sesión.',
                desarrollo: 'Desarrollo en aula.',
                cierre_evaluacion: 'Cierre formativo.'
            };
            const res = await req('POST', '/api/estudiante/bitacora', payload, estudianteToken);
            if (res.status !== 400) throw new Error(`Se esperaba 400 pero se obtuvo ${res.status}`);
        });

        await test('9. POST /api/estudiante/bitacora (Aceptar fecha válida y horas <= 8)', async () => {
            const payload = {
                id_asignacion: idAsignacionEstudiante,
                visita: 3,
                horas: 6,
                fecha: '2026-09-15', // Fecha pasada válida
                inicio_motivacion: 'Inicio con dinámicas lúdicas.',
                desarrollo: 'Talleres colaborativos en el aula.',
                cierre_evaluacion: 'Evaluación formativa y retroalimentación.'
            };
            const res = await req('POST', '/api/estudiante/bitacora', payload, estudianteToken);
            if (res.status !== 200 || !res.data.success) throw new Error('Falló registro con fecha válida: ' + JSON.stringify(res.data));
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
