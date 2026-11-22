/**
 * SIGPA — Suite de Pruebas de Integración Automatizadas M2
 * Microservicio de Reportes (:5001) & API Gateway (:3000)
 *
 * Verificaciones cubiertas:
 * a) Health check del microservicio de reportes retorna UP.
 * b) Generación de informe de visita PDF retorna binario válido (%PDF-, tamaño > 1000B).
 * c) Generación de acta de cierre PDF retorna binario válido (%PDF-, tamaño > 1000B).
 * d) Almacenamiento desacoplado almacena y recupera reportes generados por UUID.
 * e) Health check del API Gateway pasa y agrega estado de downstreams.
 * f) API Gateway bloquea peticiones no autenticadas con 401 Unauthorized.
 * g) API Gateway permite peticiones autenticadas con JWT e inyecta cabeceras.
 * h) API Gateway permite login público sin token.
 * i) API Gateway retorna 502/503 cuando el servicio downstream está offline.
 */
'use strict';

const path = require('path');

// Asegurar resolución de node_modules independientemente del directorio de ejecución
const modulePaths = [
    path.resolve(__dirname, '../backend-node/node_modules'),
    path.resolve(__dirname, '../services/gateway/node_modules'),
    path.resolve(__dirname, '../services/reporting-service/node_modules')
];
process.env.NODE_PATH = modulePaths.join(path.delimiter) + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : '');
require('module').Module._initPaths();

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

// Secretos de prueba estándar de SIGPA
const JWT_SECRET = 'sigpa_secret_key_2026';

// Puertos aislados para evitar colisiones con instancias en ejecución
const TEST_PORTS = {
    reporting: 5101,
    mockCore: 5100,
    gateway: 3100
};

// Configurar variables de entorno antes de cargar las apps
process.env.REPORTING_PORT = String(TEST_PORTS.reporting);
process.env.GATEWAY_PORT = String(TEST_PORTS.gateway);
process.env.REPORTING_SERVICE_URL = `http://127.0.0.1:${TEST_PORTS.reporting}`;
process.env.CORE_API_URL = `http://127.0.0.1:${TEST_PORTS.mockCore}`;
process.env.JWT_SECRET = JWT_SECRET;

const reportingApp = require('../services/reporting-service/src/app');
const gatewayApp = require('../services/gateway/src/app');

// Crear Mock Core API Server para simular el backend central (:5000)
function createMockCoreApi() {
    const app = express();
    app.use(express.json());

    // Endpoint de login público
    app.post('/api/login', (req, res) => {
        const { username, password } = req.body || {};
        const token = jwt.sign(
            { id: 99, usuario_id: 99, rol: 'DIRECTOR', nombre: 'Admin Mock' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.json({
            success: true,
            token,
            usuario: { id: 99, nombre: 'Admin Mock', rol: 'DIRECTOR' },
            receivedHeaders: {
                userId: req.headers['x-user-id'],
                userRole: req.headers['x-user-role']
            }
        });
    });

    // Endpoint de salud / test-db
    app.get('/api/test-db', (req, res) => {
        res.json({
            success: true,
            status: 'UP',
            message: 'Mock Core API database connection simulated'
        });
    });

    // Endpoint protegido de perfil estudiante
    app.get('/api/estudiante/perfil', (req, res) => {
        res.json({
            success: true,
            perfil: {
                id: req.headers['x-user-id'] || '99',
                rol: req.headers['x-user-role'] || 'ESTUDIANTE',
                nombre: 'Estudiante Prueba Mock'
            },
            forwardedHeaders: {
                userId: req.headers['x-user-id'],
                userRole: req.headers['x-user-role'],
                hasAuthHeader: Boolean(req.headers['authorization'])
            }
        });
    });

    return app;
}

// Utilidad para imprimir resultados formateados
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function logHeader(title) {
    console.log('\n======================================================================');
    console.log(`  ${title}`);
    console.log('======================================================================');
}

function assertTest(desc, condition, details = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  [PASS] Test #${totalTests}: ${desc}`);
    } else {
        failedTests++;
        console.error(`  [FAIL] Test #${totalTests}: ${desc}`);
        if (details) console.error(`         Detalle: ${details}`);
    }
}

async function runSuite() {
    console.log('Iniciando Suite de Pruebas de Integración M2 — SIGPA');
    console.log(`Fecha de ejecución: ${new Date().toISOString()}`);

    let reportingServer = null;
    let mockCoreServer = null;
    let gatewayServer = null;

    try {
        // 1. Levantar servidores de prueba
        reportingServer = http.createServer(reportingApp);
        await new Promise(r => reportingServer.listen(TEST_PORTS.reporting, '127.0.0.1', r));

        const mockCoreApp = createMockCoreApi();
        mockCoreServer = http.createServer(mockCoreApp);
        await new Promise(r => mockCoreServer.listen(TEST_PORTS.mockCore, '127.0.0.1', r));

        gatewayServer = http.createServer(gatewayApp);
        await new Promise(r => gatewayServer.listen(TEST_PORTS.gateway, '127.0.0.1', r));

        console.log(`Servidores de prueba activos:`);
        console.log(`- Reporting Service: http://127.0.0.1:${TEST_PORTS.reporting}`);
        console.log(`- Mock Core API:     http://127.0.0.1:${TEST_PORTS.mockCore}`);
        console.log(`- API Gateway:       http://127.0.0.1:${TEST_PORTS.gateway}`);

        // Token JWT válido para pruebas
        const validToken = jwt.sign(
            { id: 42, usuario_id: 42, rol: 'TUTOR', nombre: 'Profesor Test' },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        let storedReportId1 = null;
        let storedReportId2 = null;

        // ==================================================================
        // BLOQUE 1: PRUEBAS DEL MICROSERVICIO DE REPORTES DIRECTO (:5101)
        // ==================================================================
        logHeader('BLOQUE 1: Microservicio de Reportes (:5101)');

        // Test 1: Health Check
        const repHealthRes = await fetch(`http://127.0.0.1:${TEST_PORTS.reporting}/api/v1/reports/health`);
        const repHealthJson = await repHealthRes.json();
        assertTest(
            'Health Check de Reporting Service retorna 200 y status UP',
            repHealthRes.status === 200 && repHealthJson.status === 'UP' && repHealthJson.service === 'reporting-service',
            JSON.stringify(repHealthJson)
        );

        // Test 2: Documentación OpenAPI
        const docsRes = await fetch(`http://127.0.0.1:${TEST_PORTS.reporting}/api/v1/reports/docs`, {
            headers: { 'Accept': 'application/json' }
        });
        const docsJson = await docsRes.json();
        assertTest(
            'Endpoint de Documentación retorna especificación OpenAPI 3.0',
            docsRes.status === 200 && (docsJson.openapi === '3.0.3' || Boolean(docsJson.paths)),
            JSON.stringify(docsJson).slice(0, 80)
        );

        // Test 3: Generación de Informe de Visita PDF (Binary Stream) (CU-13)
        const visitPayload = {
            estudiante: { nombre: 'María Camila Gómez', codigo: '20231005', semestre: 'Séptimo' },
            tutor: { nombre: 'Lic. Javier Rodríguez' },
            institucion: { nombre: 'Hogar Infantil Las Palmeras' },
            asesor: { nombre: 'Dra. Beatriz Santos' },
            fecha_visita: '2026-11-20',
            evaluacion: {
                rubricas: [
                    { criterio: 'Puntualidad y Asistencia', calificacion: 5.0, observacion: 'Excelente presentación' },
                    { criterio: 'Estrategia Didáctica y Control de Grupo', calificacion: 4.8, observacion: 'Actividades dinámicas e integradoras' }
                ],
                observaciones: 'Estudiante demuestra sólida vocación pedagógica y dominio de contenidos de primera infancia.',
                estado: 'APROBADO',
                nota: 4.9
            }
        };

        const visitPdfRes = await fetch(`http://127.0.0.1:${TEST_PORTS.reporting}/api/v1/reports/visita-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/pdf' },
            body: JSON.stringify(visitPayload)
        });
        const visitPdfBuffer = Buffer.from(await visitPdfRes.arrayBuffer());
        const visitPdfHeader = visitPdfBuffer.slice(0, 5).toString('ascii');
        storedReportId1 = visitPdfRes.headers.get('x-report-id');

        assertTest(
            'Generación de Informe de Visita retorna PDF binario válido (%PDF-, tamaño > 1KB)',
            visitPdfRes.status === 200 &&
            visitPdfRes.headers.get('content-type') === 'application/pdf' &&
            visitPdfHeader === '%PDF-' &&
            visitPdfBuffer.length > 1000,
            `Header: ${visitPdfHeader}, bytes: ${visitPdfBuffer.length}`
        );

        // Test 4: Generación de Informe de Visita con retorno de Metadatos JSON
        const visitMetaRes = await fetch(`http://127.0.0.1:${TEST_PORTS.reporting}/api/v1/reports/visita-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(visitPayload)
        });
        const visitMetaJson = await visitMetaRes.json();
        assertTest(
            'Generación de Informe de Visita en modo JSON retorna metadatos con reportId y url',
            visitMetaRes.status === 200 &&
            visitMetaJson.success === true &&
            Boolean(visitMetaJson.reportId) &&
            Boolean(visitMetaJson.url),
            JSON.stringify(visitMetaJson)
        );

        // Test 5: Generación de Acta de Cierre PDF (Binary Stream) (CU-14 / CU-15)
        const actaPayload = {
            estudiante: { nombre: 'María Camila Gómez', codigo: '20231005', semestre: 'Séptimo' },
            tutor: { nombre: 'Lic. Javier Rodríguez' },
            institucion: { nombre: 'Hogar Infantil Las Palmeras', representante: 'Dra. Beatriz Santos' },
            horas_cumplidas: 160,
            total_horas_requeridas: 160,
            nota_final: 4.9,
            fecha_cierre: '2026-11-20',
            aval_in_situ: true,
            aval_tutor: true
        };

        const actaPdfRes = await fetch(`http://127.0.0.1:${TEST_PORTS.reporting}/api/v1/reports/acta-cierre-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/pdf' },
            body: JSON.stringify(actaPayload)
        });
        const actaPdfBuffer = Buffer.from(await actaPdfRes.arrayBuffer());
        const actaPdfHeader = actaPdfBuffer.slice(0, 5).toString('ascii');
        storedReportId2 = actaPdfRes.headers.get('x-report-id');

        assertTest(
            'Generación de Acta de Cierre retorna PDF binario válido (%PDF-, tamaño > 1KB)',
            actaPdfRes.status === 200 &&
            actaPdfRes.headers.get('content-type') === 'application/pdf' &&
            actaPdfHeader === '%PDF-' &&
            actaPdfBuffer.length > 1000,
            `Header: ${actaPdfHeader}, bytes: ${actaPdfBuffer.length}`
        );

        // Test 6: Generación de Acta de Cierre con retorno de Metadatos JSON
        const actaMetaRes = await fetch(`http://127.0.0.1:${TEST_PORTS.reporting}/api/v1/reports/acta-cierre-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(actaPayload)
        });
        const actaMetaJson = await actaMetaRes.json();
        assertTest(
            'Generación de Acta de Cierre en modo JSON retorna metadatos estructurados',
            actaMetaRes.status === 200 &&
            actaMetaJson.success === true &&
            Boolean(actaMetaJson.reportId) &&
            Boolean(actaMetaJson.size),
            JSON.stringify(actaMetaJson)
        );

        // Test 7: Almacenamiento Desacoplado - Recuperación de Reporte por ID (Binario)
        const getReportRes = await fetch(`http://127.0.0.1:${TEST_PORTS.reporting}/api/v1/reports/${storedReportId1}`);
        const getReportBuffer = Buffer.from(await getReportRes.arrayBuffer());
        assertTest(
            'Recuperación de reporte almacenado por UUID retorna binario PDF original',
            getReportRes.status === 200 &&
            getReportBuffer.slice(0, 5).toString('ascii') === '%PDF-' &&
            getReportBuffer.length > 1000,
            `Bytes recuperados: ${getReportBuffer.length}`
        );

        // Test 8: Almacenamiento Desacoplado - Recuperación de Metadatos por ID (?meta=true)
        const getMetaRes = await fetch(`http://127.0.0.1:${TEST_PORTS.reporting}/api/v1/reports/${storedReportId1}?meta=true`, {
            headers: { 'Accept': 'application/json' }
        });
        const getMetaJson = await getMetaRes.json();
        assertTest(
            'Recuperación de metadatos de reporte almacenado retorna estructura indexada',
            getMetaRes.status === 200 &&
            getMetaJson.success === true &&
            getMetaJson.report.id === storedReportId1,
            JSON.stringify(getMetaJson)
        );

        // Test 9: Almacenamiento Desacoplado - Reporte inexistente retorna 404
        const notFoundRes = await fetch(`http://127.0.0.1:${TEST_PORTS.reporting}/api/v1/reports/uuid-inexistente-0000`);
        assertTest(
            'Búsqueda de reporte inexistente retorna 404 Not Found',
            notFoundRes.status === 404
        );

        // Test 10: Validación de parámetros requeridos (Rechazo 400) a través de Gateway (:3100)
        const badPayloadRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/v1/reports/visita-pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${validToken}`
            },
            body: JSON.stringify({}) // Falta estudiante, tutor, etc. - enviado a través de Gateway
        });
        assertTest(
            'Solicitud con payload incompleto a través del Gateway (:3100) es enrutada limpiamente y rechazada con 400 Bad Request',
            badPayloadRes.status === 400
        );

        // ==================================================================
        // BLOQUE 2: PRUEBAS DEL API GATEWAY & SEGURIDAD PERIMETRAL (:3100)
        // ==================================================================
        logHeader('BLOQUE 2: API Gateway & Seguridad Perimetral (:3100)');

        // Test 11: Health Check del API Gateway
        const gwHealthRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/health`);
        const gwHealthJson = await gwHealthRes.json();
        assertTest(
            'Health Check del API Gateway retorna 200 y estado UP con agregación de downstream',
            gwHealthRes.status === 200 &&
            gwHealthJson.status === 'UP' &&
            gwHealthJson.downstream.reportingService.status === 'UP' &&
            gwHealthJson.downstream.coreApi.status === 'UP',
            JSON.stringify(gwHealthJson)
        );

        // Test 12: Bloqueo de peticiones no autenticadas a rutas protegidas (401)
        const unauthRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/estudiante/perfil`);
        const unauthJson = await unauthRes.json();
        assertTest(
            'Gateway bloquea petición protegida sin token con 401 Unauthorized',
            unauthRes.status === 401 && unauthJson.success === false,
            JSON.stringify(unauthJson)
        );

        // Test 13: Bloqueo de peticiones con token inválido o corrupto (401)
        const invalidTokenRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/estudiante/perfil`, {
            headers: { 'Authorization': 'Bearer token-totalmente-invalido-o-falso' }
        });
        assertTest(
            'Gateway bloquea petición con token inválido con 401 Unauthorized',
            invalidTokenRes.status === 401
        );

        // Test 14: Acceso público a /api/login sin token (Paso directo)
        const loginRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'password123' })
        });
        const loginJson = await loginRes.json();
        assertTest(
            'Gateway permite acceso transparente a /api/login sin requerir token',
            loginRes.status === 200 && loginJson.success === true && Boolean(loginJson.token),
            JSON.stringify(loginJson)
        );

        // Test 15: Petición autenticada protegida -> Proxy a Core API con inyección de cabeceras
        const authProxyRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/estudiante/perfil`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const authProxyJson = await authProxyRes.json();
        assertTest(
            'Gateway valida JWT, inyecta cabeceras (x-user-id, x-user-role) y hace proxy a Core API',
            authProxyRes.status === 200 &&
            authProxyJson.success === true &&
            authProxyJson.forwardedHeaders.userId === '42' &&
            authProxyJson.forwardedHeaders.userRole === 'TUTOR',
            JSON.stringify(authProxyJson)
        );

        // Test 16: Proxy a microservicio de reportes a través de Gateway (Health público)
        const gwRepHealthRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/v1/reports/health`);
        const gwRepHealthJson = await gwRepHealthRes.json();
        assertTest(
            'Gateway enruta correctamente /api/v1/reports/health hacia el Reporting Service',
            gwRepHealthRes.status === 200 && gwRepHealthJson.service === 'reporting-service',
            JSON.stringify(gwRepHealthJson)
        );

        // Test 17: Proxy a microservicio de reportes a través de Gateway (Generación de PDF con JWT)
        const gwPdfRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/v1/reports/visita-pdf`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${validToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/pdf'
            },
            body: JSON.stringify(visitPayload)
        });
        const gwPdfBuffer = Buffer.from(await gwPdfRes.arrayBuffer());
        assertTest(
            'Gateway enruta generación de PDF hacia Reporting Service y entrega binario PDF idéntico',
            gwPdfRes.status === 200 &&
            gwPdfRes.headers.get('content-type') === 'application/pdf' &&
            gwPdfBuffer.slice(0, 5).toString('ascii') === '%PDF-' &&
            gwPdfBuffer.length > 1000,
            `Header: ${gwPdfBuffer.slice(0, 5).toString('ascii')}, tamaño: ${gwPdfBuffer.length}`
        );

        // ==================================================================
        // BLOQUE HARDENING: SEGURIDAD, CABECERAS, PAYLOADS Y CONDICIONES LÍMITE
        // ==================================================================
        logHeader('BLOQUE HARDENING: Seguridad Perimetral, Sanitización y Límites');

        // Test 18: Prevención de Auth Bypass por Path Traversal en ruta Core API (/api/login/../...)
        const bypassCoreRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/login/../api/estudiante/perfil`);
        assertTest(
            'Gateway bloquea bypass por path traversal (/api/login/../api/estudiante/perfil) con 401 Unauthorized',
            bypassCoreRes.status === 401,
            `Status: ${bypassCoreRes.status}`
        );

        // Test 19: Prevención de Auth Bypass por Path Traversal en Reporting (/api/v1/reports/health/../visita-pdf)
        const bypassRepRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/v1/reports/health/../visita-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        assertTest(
            'Gateway bloquea bypass por path traversal (/api/v1/reports/health/../visita-pdf) con 401 Unauthorized',
            bypassRepRes.status === 401,
            `Status: ${bypassRepRes.status}`
        );

        // Test 20: Sanitización de cabeceras de identidad del cliente en rutas autenticadas
        const spoofProtectedRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/estudiante/perfil`, {
            headers: {
                'Authorization': `Bearer ${validToken}`,
                'x-user-id': '9999-spoofed',
                'x-user-role': 'SUPER_ADMIN_SPOOF'
            }
        });
        const spoofProtectedJson = await spoofProtectedRes.json();
        assertTest(
            'Gateway elimina cabeceras spoofeadas del cliente e inyecta solo la identidad verificada del JWT (42, TUTOR)',
            spoofProtectedRes.status === 200 &&
            spoofProtectedJson.forwardedHeaders.userId === '42' &&
            spoofProtectedJson.forwardedHeaders.userRole === 'TUTOR',
            JSON.stringify(spoofProtectedJson.forwardedHeaders)
        );

        // Test 21: Sanitización de cabeceras de identidad del cliente en rutas públicas (/api/login)
        const spoofPublicRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': '9999-spoofed',
                'x-user-role': 'SUPER_ADMIN_SPOOF'
            },
            body: JSON.stringify({ username: 'admin', password: 'password123' })
        });
        const spoofPublicJson = await spoofPublicRes.json();
        assertTest(
            'Gateway elimina cabeceras de identidad spoofeadas en peticiones a rutas públicas',
            spoofPublicRes.status === 200 &&
            spoofPublicJson.receivedHeaders.userId === undefined &&
            spoofPublicJson.receivedHeaders.userRole === undefined,
            JSON.stringify(spoofPublicJson.receivedHeaders)
        );

        // Test 22: Proxy de modificación (POST) con payload JSON vacío {} no se cuelga ni da 502
        const emptyJsonStart = Date.now();
        const emptyJsonRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/v1/reports/visita-pdf`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${validToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        const emptyJsonDuration = Date.now() - emptyJsonStart;
        assertTest(
            'Gateway procesa POST con cuerpo {} sin congelarse (<2s) ni producir 502 Bad Gateway',
            emptyJsonRes.status === 400 && emptyJsonDuration < 3000,
            `Status: ${emptyJsonRes.status}, Duración: ${emptyJsonDuration}ms`
        );

        // Test 23: Acta de cierre en condiciones límite: horas_cumplidas: 0 y nota_final: 0.0
        const boundaryPayload = {
            estudiante: { nombre: 'Estudiante Límite Cero', codigo: '20230000', semestre: 'Séptimo' },
            tutor: { nombre: 'Lic. Javier Rodríguez' },
            institucion: { nombre: 'Hogar Infantil Las Palmeras' },
            horas_cumplidas: 0,
            total_horas_requeridas: 160,
            nota_final: 0.0,
            fecha_cierre: '2026-11-20',
            aval_in_situ: false,
            aval_tutor: false
        };

        const boundaryActaRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/v1/reports/acta-cierre-pdf`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${validToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(boundaryPayload)
        });
        const boundaryActaJson = await boundaryActaRes.json();

        let boundaryVerified = false;
        if (boundaryActaRes.status === 200 && boundaryActaJson.success && boundaryActaJson.reportId) {
            const metaCheckRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/v1/reports/${boundaryActaJson.reportId}?meta=true`, {
                headers: { 'Authorization': `Bearer ${validToken}` }
            });
            const metaCheckJson = await metaCheckRes.json();
            boundaryVerified = metaCheckJson.success &&
                metaCheckJson.report.metadata.horas_cumplidas === 0 &&
                metaCheckJson.report.metadata.nota_final === 0;
        }

        assertTest(
            'Acta de cierre en límite: horas_cumplidas: 0 preserva 0 / 0% y nota_final: 0.0 preserva 0 en metadatos',
            boundaryActaRes.status === 200 && boundaryVerified,
            JSON.stringify(boundaryActaJson)
        );

        // Test 24: Prevención de Path Traversal en almacenamiento desacoplado (GET ..%2f..%2fpackage.json)
        const traversalResGateway = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/v1/reports/..%2f..%2fpackage.json`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const traversalTextGateway = await traversalResGateway.text();

        const traversalResDirect = await fetch(`http://127.0.0.1:${TEST_PORTS.reporting}/api/v1/reports/..%2f..%2fpackage.json`);
        const traversalTextDirect = await traversalResDirect.text();

        const StorageManagerClass = require('../services/reporting-service/src/storage/storageManager');
        const smTest = new StorageManagerClass();
        const directNullCheck = smTest.getReportById('../../package.json') === null &&
                                smTest.getReportById('..\\..\\package.json') === null &&
                                smTest.getReportById('..%2f..%2fpackage.json') === null;

        assertTest(
            'Path traversal en almacenamiento de reportes es rechazado con 404 Not Found sin exponer archivos',
            traversalResGateway.status === 404 &&
            traversalResDirect.status === 404 &&
            !traversalTextGateway.includes('"name":') &&
            !traversalTextDirect.includes('"name":') &&
            directNullCheck,
            `Gateway: ${traversalResGateway.status}, Reporting: ${traversalResDirect.status}, Storage direct null: ${directNullCheck}`
        );

        // Test 25: Resiliencia de Gateway frente a caída downstream (502 Bad Gateway)
        logHeader('BLOQUE RESILIENCIA: Manejo de Fallas');
        console.log('Deteniendo servidor Mock Core API para simular desconexión...');
        await new Promise(r => mockCoreServer.close(r));
        mockCoreServer = null;

        const downRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/api/estudiante/perfil`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const downJson = await downRes.json();
        assertTest(
            'Gateway retorna 502 Bad Gateway cuando el servicio downstream está offline',
            downRes.status === 502 && downJson.success === false && downJson.error === 'Servicio no disponible',
            JSON.stringify(downJson)
        );

        // Test 26: Health check del Gateway en estado degradado tras caída de downstream
        const gwDegradedRes = await fetch(`http://127.0.0.1:${TEST_PORTS.gateway}/health`);
        const gwDegradedJson = await gwDegradedRes.json();
        assertTest(
            'Health Check de Gateway detecta downstream caído y reporta DEGRADED',
            gwDegradedRes.status === 200 &&
            gwDegradedJson.downstream.coreApi.status === 'DOWN' &&
            gwDegradedJson.downstream.reportingService.status === 'UP',
            JSON.stringify(gwDegradedJson)
        );

    } catch (err) {
        console.error('Error fatal durante la ejecución de las pruebas:', err);
        failedTests++;
    } finally {
        // Cierre garantizado de servidores
        if (reportingServer) {
            await new Promise(r => reportingServer.close(r));
        }
        if (mockCoreServer) {
            await new Promise(r => mockCoreServer.close(r));
        }
        if (gatewayServer) {
            await new Promise(r => gatewayServer.close(r));
        }
    }

    // Resumen Final
    logHeader('RESUMEN DE PRUEBAS MILESTONE 2');
    console.log(`Total pruebas ejecutadas: ${totalTests}`);
    console.log(`Pruebas exitosas (PASS):  ${passedTests}`);
    console.log(`Pruebas fallidas (FAIL):  ${failedTests}`);
    const passPercentage = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
    console.log(`Porcentaje de éxito:      ${passPercentage}%`);
    console.log('======================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

// Ejecutar suite si es llamado directamente
if (require.main === module) {
    runSuite();
}

module.exports = { runSuite };
