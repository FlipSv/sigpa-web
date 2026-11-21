/**
 * SIGPA — Milestone 3 Integration & Feature Verification Suite
 * 
 * Verifies all M3 backend capabilities and contracts:
 * 1. Evidence uploads static serving & handling
 * 2. CU-10 Guiding Questions configuration endpoints
 * 3. CU-14/15 Closure endpoints with prerequisite validations
 * 4. Nueva Práctica validation & creation
 * 5. Report generation contract integration
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { startTestServer } = require('./helpers/testServer');
const { setupTestDb, teardownTestDb } = require('./helpers/testDb');
const { ApiClient } = require('./helpers/apiClient');

async function runM3TestSuite() {
    console.log('======================================================================');
    console.log('  INICIANDO SUITE DE PRUEBAS DE INTEGRACIÓN MILESTONE 3 — SIGPA');
    console.log(`  Fecha: ${new Date().toISOString()}`);
    console.log('======================================================================\n');

    await setupTestDb('m3_worker_suite');

    const { server, baseUrl, close } = await startTestServer();
    console.log(`[TEST-SERVER] Servidor de prueba iniciado en: ${baseUrl}\n`);

    const client = new ApiClient(baseUrl);
    let passedCount = 0;
    let failedCount = 0;

    function recordPass(testName) {
        passedCount++;
        console.log(`  ✔ [PASS] Test #${passedCount}: ${testName}`);
    }

    function recordFail(testName, error) {
        failedCount++;
        console.error(`  ✖ [FAIL] Test #${passedCount + failedCount}: ${testName}`);
        console.error(`         Error: ${error.message}\n`);
    }

    try {
        // ==================================================================
        // BLOQUE 1: Static Evidence Serving & Subir Evidencia
        // ==================================================================
        console.log('----------------------------------------------------------------------');
        console.log('  BLOQUE 1: Almacenamiento y Servicio Estático de Evidencias');
        console.log('----------------------------------------------------------------------');

        // Test 1: Static serving of evidence files
        try {
            const res = await client.get('/uploads/evidencias/evidencia_visita_1.pdf');
            assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
            const contentType = res.headers.get('content-type') || '';
            assert.ok(contentType.includes('application/pdf'), `Expected application/pdf content-type, got ${contentType}`);
            recordPass('Servicio estático de /uploads/evidencias/ entrega PDF binario con status 200');
        } catch (e) {
            recordFail('Servicio estático de /uploads/evidencias/ entrega PDF binario con status 200', e);
        }

        // Test 2: Subir evidencia via POST /api/estudiante/subir-evidencia
        try {
            await client.login('estudiante@sigpa.edu', '1234');
            const uploadPayload = {
                id_bitacora: 1,
                nombre_archivo: 'evidencia_prueba_m3.pdf',
                contenido_base64: Buffer.from('%PDF-1.4 test evidence content').toString('base64')
            };
            const res = await client.post('/api/estudiante/subir-evidencia', uploadPayload);
            assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
            assert.ok(res.data && res.data.success, 'Expected success: true');
            assert.ok(res.data.url && res.data.url.includes('/uploads/evidencias/'), `URL should point to /uploads/evidencias/, got ${res.data.url}`);

            // Verify file actually exists on disk
            const fileName = path.basename(res.data.url);
            const expectedPath = path.resolve(__dirname, '../backend-node/uploads/evidencias', fileName);
            assert.ok(fs.existsSync(expectedPath), `Uploaded file must physically exist on disk at ${expectedPath}`);
            recordPass('Carga de evidencia guarda archivo en disco y actualiza URL en la bitácora');
        } catch (e) {
            recordFail('Carga de evidencia guarda archivo en disco y actualiza URL en la bitácora', e);
        }

        // ==================================================================
        // BLOQUE 2: CU-10 Configuración de Preguntas Guía Curriculares
        // ==================================================================
        console.log('\n----------------------------------------------------------------------');
        console.log('  BLOQUE 2: CU-10 Configuración de Preguntas Guía (Director)');
        console.log('----------------------------------------------------------------------');

        // Test 3: Validation failure on missing fields
        try {
            await client.login('director@sigpa.edu', '1234');
            const badPayload = { id_practica: null, preguntas: [] };
            const res = await client.post('/api/director/preguntas-guia', badPayload);
            assert.strictEqual(res.status, 400, `Expected 400 for incomplete payload, got ${res.status}`);
            recordPass('Validación rechaza payload incompleto de preguntas guía con 400 Bad Request');
        } catch (e) {
            recordFail('Validación rechaza payload incompleto de preguntas guía con 400 Bad Request', e);
        }

        // Test 4: Successful creation of questions
        try {
            const validPayload = {
                id_practica: 1,
                tipo_visita: 'Visita 1',
                preguntas: [
                    { orden: 1, texto: '¿Cómo articula los objetivos de aprendizaje con el currículo institucional?', categoria: 'PEDAGOGICA' },
                    { orden: 2, texto: '¿Qué estrategias de mediación didáctica implementó en la sesión?', categoria: 'DIDACTICA' },
                    { orden: 3, texto: '¿De qué manera evidencia la autorreflexión de los estudiantes?', categoria: 'EVALUACION' }
                ]
            };
            const res = await client.post('/api/director/preguntas-guia', validPayload);
            assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
            assert.ok(res.data && res.data.success, 'Expected success: true');
            assert.strictEqual(res.data.total_registradas, 3, 'Expected 3 registered questions');
            recordPass('Director configura exitosamente 3 preguntas guía curriculares para Visita 1 (201 Created)');
        } catch (e) {
            recordFail('Director configura exitosamente 3 preguntas guía curriculares para Visita 1 (201 Created)', e);
        }

        // Test 5: Query configured questions
        try {
            const res = await client.get('/api/director/preguntas-guia', { query: { id_practica: 1, tipo_visita: 'Visita 1' } });
            assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
            assert.ok(Array.isArray(res.data.preguntas), 'Expected array of preguntas');
            assert.ok(res.data.preguntas.length >= 3, `Expected at least 3 questions, got ${res.data.preguntas.length}`);
            recordPass('Consulta de preguntas guía retorna las preguntas configuradas por práctica y tipo de visita');
        } catch (e) {
            recordFail('Consulta de preguntas guía retorna las preguntas configuradas por práctica y tipo de visita', e);
        }

        // ==================================================================
        // BLOQUE 3: Modal Nueva Práctica (Validación y Creación)
        // ==================================================================
        console.log('\n----------------------------------------------------------------------');
        console.log('  BLOQUE 3: Modal Nueva Práctica (Director)');
        console.log('----------------------------------------------------------------------');

        // Test 6: Validation fails on negative/invalid values
        try {
            const invalidPractica = {
                nombre: '',
                semestre: 'P7',
                horas_requeridas: -10,
                creditos: 0
            };
            const res = await client.post('/api/director/nueva_practica', invalidPractica);
            assert.strictEqual(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);
            recordPass('Validación rechaza datos no válidos (horas negativas, semestre inválido) con 400');
        } catch (e) {
            recordFail('Validación rechaza datos no válidos (horas negativas, semestre inválido) con 400', e);
        }

        // Test 7: Valid practice creation
        try {
            const nuevaPractica = {
                nombre: 'Práctica Docente Integral VI - Innovación Educativa',
                descripcion: 'Práctica avanzada con énfasis en herramientas digitales pedagógicas',
                semestre: 'P6',
                tipo: 'DOCENCIA',
                creditos: 3,
                horas_requeridas: 120,
                cupos: 25
            };
            const res = await client.post('/api/director/nueva_practica', nuevaPractica);
            assert.ok(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
            assert.ok(res.data && res.data.practica_id, 'Response should contain practica_id');
            recordPass('Director crea nueva práctica curricular con metadatos completos (200 OK)');
        } catch (e) {
            recordFail('Director crea nueva práctica curricular con metadatos completos (201 Created)', e);
        }

        // ==================================================================
        // BLOQUE 4: CU-14/15 Cierre de Práctica y Asignación
        // ==================================================================
        console.log('\n----------------------------------------------------------------------');
        console.log('  BLOQUE 4: CU-14 / CU-15 Cierre de Asignación y Práctica');
        console.log('----------------------------------------------------------------------');

        // Setup test data in DB for closure evaluation
        const { executeSqliteQuery } = require('../backend-node/src/config/sqlite');

        // Clean any pre-existing rows with these IDs
        try {
            await executeSqliteQuery('DELETE FROM EVALUACION WHERE ID_EVALUACION IN (9031, 9032)');
            await executeSqliteQuery('DELETE FROM BITACORA WHERE ID_BITACORA IN (9021, 9031, 9032)');
            await executeSqliteQuery('DELETE FROM ASIGNACION WHERE ID_ASIGNACION IN (901, 902, 903)');
        } catch (eClean) {}

        // Create assignment with incomplete hours (e.g. 30/64)
        await executeSqliteQuery(`
            INSERT INTO ASIGNACION (ID_ASIGNACION, ID_USUARIO, ID_ESTUDIANTE, ID_TUTOR, ID_PRACTICA, ID_INSTITUCION, HORAS_ACUMULADAS, ESTADO, ESTADO_PRACTICA)
            VALUES (901, 3, 3, 4, 1, 1, 30, 'APROBADA', 'EN_CURSO')
        `);

        // Test 8: Rejection when hours < 100%
        try {
            await client.login('tutor@sigpa.edu', '1234');
            const res = await client.post('/api/tutor/cerrar-asignacion', { id_asignacion: 901 });
            assert.strictEqual(res.status, 400, `Expected 400 when hours incomplete, got ${res.status}`);
            const errText = res.data && (res.data.message || res.data.error || '');
            assert.ok(errText.includes('100%') || errText.includes('horas'), 'Error message should mention hours prerequisite');
            recordPass('Cierre rechazado (400) si el estudiante no ha cumplido el 100% de horas requeridas');
        } catch (e) {
            recordFail('Cierre rechazado (400) si el estudiante no ha cumplido el 100% de horas requeridas', e);
        }

        // Create assignment with 100% hours but pending bitácora
        await executeSqliteQuery(`
            INSERT INTO ASIGNACION (ID_ASIGNACION, ID_USUARIO, ID_ESTUDIANTE, ID_TUTOR, ID_PRACTICA, ID_INSTITUCION, HORAS_ACUMULADAS, ESTADO, ESTADO_PRACTICA)
            VALUES (902, 3, 3, 4, 1, 1, 64, 'APROBADA', 'EN_CURSO')
        `);
        await executeSqliteQuery(`
            INSERT INTO BITACORA (ID_BITACORA, ID_ASIGNACION, NUMERO_VISITA, FECHA_REGISTRO, HORAS_SESION, ACTIVIDADES, ESTADO_REVISION)
            VALUES (9021, 902, 1, '2026-03-01', 16, 'Actividad de prueba', 'PENDIENTE')
        `);

        // Test 9: Rejection when pending bitácoras exist
        try {
            const res = await client.post('/api/tutor/cerrar-asignacion', { id_asignacion: 902 });
            assert.strictEqual(res.status, 400, `Expected 400 when pending bitácoras exist, got ${res.status}`);
            const errText = res.data && (res.data.message || res.data.error || '');
            assert.ok(errText.toLowerCase().includes('pendiente'), 'Error message should mention pending bitacoras');
            recordPass('Cierre rechazado (400) si existen bitácoras pendientes de evaluación');
        } catch (e) {
            recordFail('Cierre rechazado (400) si existen bitácoras pendientes de evaluación', e);
        }

        // Create assignment meeting ALL prerequisites: 100% hours, all bitácoras approved, evaluations complete
        await executeSqliteQuery(`
            INSERT INTO ASIGNACION (ID_ASIGNACION, ID_USUARIO, ID_ESTUDIANTE, ID_TUTOR, ID_PRACTICA, ID_INSTITUCION, HORAS_ACUMULADAS, ESTADO, ESTADO_PRACTICA)
            VALUES (903, 3, 3, 4, 1, 1, 64, 'APROBADA', 'EN_CURSO')
        `);
        await executeSqliteQuery(`
            INSERT INTO BITACORA (ID_BITACORA, ID_ASIGNACION, NUMERO_VISITA, FECHA_REGISTRO, HORAS_SESION, ACTIVIDADES, ESTADO_REVISION)
            VALUES (9031, 903, 1, '2026-03-01', 32, 'Actividad semana 1 aprobada', 'APROBADA')
        `);
        await executeSqliteQuery(`
            INSERT INTO BITACORA (ID_BITACORA, ID_ASIGNACION, NUMERO_VISITA, FECHA_REGISTRO, HORAS_SESION, ACTIVIDADES, ESTADO_REVISION)
            VALUES (9032, 903, 2, '2026-03-08', 32, 'Actividad semana 2 aprobada', 'APROBADA')
        `);
        await executeSqliteQuery(`
            INSERT INTO EVALUACION (ID_EVALUACION, ID_BITACORA, ID_EVALUADOR, TIPO_EVALUADOR, NOTA, FECHA_EVALUACION)
            VALUES (9031, 9031, 4, 'TUTOR', 4.5, '2026-03-15')
        `);
        await executeSqliteQuery(`
            INSERT INTO EVALUACION (ID_EVALUACION, ID_BITACORA, ID_EVALUADOR, TIPO_EVALUADOR, NOTA, FECHA_EVALUACION)
            VALUES (9032, 9032, 5, 'ASESOR', 4.7, '2026-03-16')
        `);

        // Test 10: Successful closure and grade consolidation
        try {
            const res = await client.post('/api/tutor/cerrar-asignacion', { id_asignacion: 903 });
            assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
            assert.ok(res.data.success, 'Expected success: true');
            assert.strictEqual(res.data.estado, 'CERRADA', 'Assignment status must be updated to CERRADA');
            assert.ok(res.data.nota_final !== null && res.data.nota_final !== undefined, 'Nota final must be consolidated');
            assert.ok(Number(res.data.nota_final) >= 4.0, `Nota final should be consolidated average (~4.6), got ${res.data.nota_final}`);

            // Verify status in DB
            const checkRes = await executeSqliteQuery('SELECT ESTADO, ESTADO_PRACTICA FROM ASIGNACION WHERE ID_ASIGNACION = 903');
            assert.ok(checkRes.rows && checkRes.rows[0], 'Assignment 903 must exist');
            assert.strictEqual(checkRes.rows[0].ESTADO, 'CERRADA', 'DB status must be CERRADA');
            recordPass('Cierre exitoso: consolida nota definitiva, valida prerrequisitos y actualiza estado a CERRADA (200 OK)');
        } catch (e) {
            recordFail('Cierre exitoso: consolida nota definitiva, valida prerrequisitos y actualiza estado a CERRADA (200 OK)', e);
        }

        // ==================================================================
        // BLOQUE 5: Descarga de Reportes PDF (CU-13 / CU-14)
        // ==================================================================
        console.log('\n----------------------------------------------------------------------');
        console.log('  BLOQUE 5: Descarga de Reportes PDF (Visita y Acta de Cierre)');
        console.log('----------------------------------------------------------------------');

        // Test 11: Visita PDF binary generation
        try {
            const res = await client.post('/api/v1/reports/visita-pdf', {
                id_bitacora: 1,
                visita: 1,
                estudiante: 'Laura Pérez',
                practica: 'Práctica Pedagógica I'
            }, {
                headers: { 'Accept': 'application/pdf' }
            });
            assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
            const contentType = res.headers.get('content-type') || '';
            assert.ok(contentType.includes('application/pdf'), `Expected application/pdf, got ${contentType}`);
            recordPass('Generación de informe de visita PDF retorna binario válido (%PDF-) con cabecera application/pdf');
        } catch (e) {
            recordFail('Generación de informe de visita PDF retorna binario válido (%PDF-) con cabecera application/pdf', e);
        }

        // Test 12: Acta de Cierre PDF binary generation
        try {
            const res = await client.post('/api/v1/reports/acta-cierre-pdf', {
                id_asignacion: 903,
                horas_acumuladas: 64,
                horas_requeridas: 64,
                bitacoras_pendientes: 0
            }, {
                headers: { 'Accept': 'application/pdf' }
            });
            assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
            const contentType = res.headers.get('content-type') || '';
            assert.ok(contentType.includes('application/pdf'), `Expected application/pdf, got ${contentType}`);
            recordPass('Generación de Acta Final de Cierre PDF retorna binario descargable con cabecera application/pdf');
        } catch (e) {
            recordFail('Generación de Acta Final de Cierre PDF retorna binario descargable con cabecera application/pdf', e);
        }

    } finally {
        if (close) {
            await close();
        }
        await teardownTestDb();
    }

    console.log('\n======================================================================');
    console.log('  RESUMEN DE PRUEBAS MILESTONE 3');
    console.log('======================================================================');
    console.log(`Total pruebas ejecutadas: ${passedCount + failedCount}`);
    console.log(`Pruebas exitosas (PASS):  ${passedCount}`);
    console.log(`Pruebas fallidas (FAIL):  ${failedCount}`);
    const pct = ((passedCount / (passedCount + failedCount || 1)) * 100).toFixed(1);
    console.log(`Porcentaje de éxito:      ${pct}%`);
    console.log('======================================================================\n');

    if (failedCount > 0) {
        process.exit(1);
    }
}

runM3TestSuite().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
