/**
 * SIGPA — Reporting Service Standalone Integration Test
 */
'use strict';

const http = require('http');
const assert = require('assert');
const app = require('../src/app');

function makeRequest(server, options, bodyData = null) {
    return new Promise((resolve, reject) => {
        const addr = server.address();
        const reqOptions = {
            hostname: '127.0.0.1',
            port: addr.port,
            path: options.path,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(reqOptions, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                let json = null;
                try {
                    json = JSON.parse(buffer.toString('utf8'));
                } catch (e) {
                    // Not JSON
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    buffer,
                    json
                });
            });
        });

        req.on('error', reject);

        if (bodyData) {
            const str = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
            req.write(str);
        }
        req.end();
    });
}

async function runTests() {
    console.log('====================================================');
    console.log('  SIGPA — Tests Unitarios/Integración Reporting Service');
    console.log('====================================================');

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`  ✔ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
            failed++;
        }
    }

    try {
        await test('Health check retorna 200 y status UP', async () => {
            const res = await makeRequest(server, { path: '/api/v1/reports/health' });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.json.status, 'UP');
            assert.strictEqual(res.json.service, 'reporting-service');
        });

        await test('Docs endpoint retorna OpenAPI spec', async () => {
            const res = await makeRequest(server, { path: '/api/v1/reports/docs' });
            assert.strictEqual(res.status, 200);
            assert.ok(res.json.openapi && res.json.openapi.startsWith('3.0'));
        });

        const dummyPayload = {
            id_asignacion: 1,
            estudiante: {
                id_usuario: 3,
                nombre: 'Laura Pérez',
                email: 'estudiante@sigpa.edu'
            },
            practica: {
                id_practica: 1,
                nombre: 'Práctica de Observación en Infancia',
                horas_requeridas: 64
            },
            institucion: {
                id_institucion: 1,
                nombre: 'Colegio Integrado UDI Kids'
            },
            tutor: {
                nombre: 'Mateo Gómez'
            },
            asesor: {
                nombre: 'Clara Rojas'
            },
            bitacora: {
                numero_visita: 1,
                fecha_registro: '2026-08-15',
                horas_sesion: 8,
                actividades: 'Actividades de observación pedagógica en aula infantil',
                observaciones: 'Excelente desempeño formativo'
            },
            evaluaciones: [
                { tipo_evaluador: 'TUTOR', nota: 4.8, comentarios: 'Buen trabajo' },
                { tipo_evaluador: 'ASESOR', nota: 4.5, comentarios: 'Puntual' }
            ]
        };

        let generatedReportId = null;

        await test('Generación de informe de visita en PDF binario', async () => {
            const res = await makeRequest(server, {
                path: '/api/v1/reports/visita-pdf',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/pdf' }
            }, dummyPayload);
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.headers['content-type'], 'application/pdf');
            assert.ok(res.buffer.toString('binary', 0, 4).startsWith('%PDF'));
        });

        await test('Generación de informe de visita en JSON mode con reportId', async () => {
            const res = await makeRequest(server, {
                path: '/api/v1/reports/visita-pdf',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            }, dummyPayload);
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.json.success, true);
            assert.ok(res.json.reportId);
            generatedReportId = res.json.reportId;
        });

        const actaPayload = {
            id_asignacion: 1,
            estudiante: { id_usuario: 3, nombre: 'Laura Pérez', email: 'estudiante@sigpa.edu' },
            practica: { id_practica: 1, nombre: 'Práctica de Observación', horas_requeridas: 64 },
            institucion: { id_institucion: 1, nombre: 'Colegio Integrado UDI Kids' },
            tutor: { nombre: 'Mateo Gómez' },
            asesor: { nombre: 'Clara Rojas' },
            horas_cumplidas: 64,
            horas_requeridas: 64,
            porcentaje_cumplimiento: 100,
            nota_final: 4.7
        };

        await test('Generación de Acta de Cierre en PDF binario', async () => {
            const res = await makeRequest(server, {
                path: '/api/v1/reports/acta-cierre-pdf',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/pdf' }
            }, actaPayload);
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.headers['content-type'], 'application/pdf');
            assert.ok(res.buffer.toString('binary', 0, 4).startsWith('%PDF'));
        });

        await test('Recuperación de reporte almacenado por UUID', async () => {
            assert.ok(generatedReportId, 'Debe existir un reportId generado previamente');
            const res = await makeRequest(server, { path: `/api/v1/reports/${generatedReportId}` });
            assert.strictEqual(res.status, 200);
            assert.ok(res.buffer.toString('binary', 0, 4).startsWith('%PDF'));
        });

        await test('Búsqueda de reporte inexistente retorna 404', async () => {
            const res = await makeRequest(server, { path: '/api/v1/reports/00000000-0000-0000-0000-000000000000' });
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.json.success, false);
        });

    } finally {
        await new Promise(resolve => server.close(resolve));
    }

    console.log('====================================================');
    console.log(`  Resultado Reporting Service: ${passed} pasadas, ${failed} fallidas.`);
    console.log('====================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Error no capturado en tests de reporting-service:', err);
    process.exit(1);
});
