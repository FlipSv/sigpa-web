/**
 * Tier 2 — Boundary & Corner Cases Test Suite (≥75 tests, ≥5 per feature across 15 features)
 * 
 * Systematic Boundary Value Analysis (BVA), limit testing, security guards,
 * negative validation, and corner case verification across all 15 features.
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('../../backend-node/node_modules/jsonwebtoken');
const { setupTestDb, teardownTestDb } = require('../helpers/testDb');
const { startTestServer } = require('../helpers/testServer');
const { createApiClient } = require('../helpers/apiClient');

describe('Tier 2: Boundary & Corner Cases (≥75 Tests across 15 Features)', () => {
    let serverClose;
    let client;
    let directorToken;
    let tutorToken;
    let estudianteToken;
    let asesorToken;

    before(async () => {
        await setupTestDb('tier2_boundaries');
        const { baseUrl, close } = await startTestServer();
        serverClose = close;
        client = createApiClient(baseUrl);

        // Pre-fetch tokens
        const dirRes = await client.login('director@sigpa.edu', '1234');
        directorToken = dirRes.data.token;

        const tutRes = await client.login('tutor@sigpa.edu', '1234');
        tutorToken = tutRes.data.token;

        const estRes = await client.login('estudiante@sigpa.edu', '1234');
        estudianteToken = estRes.data.token;

        const aseRes = await client.login('asesor@sigpa.edu', '1234');
        asesorToken = aseRes.data.token;
    });

    after(async () => {
        if (serverClose) await serverClose();
        await teardownTestDb();
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 1: Autenticación RBAC (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 1: Autenticación RBAC (Boundaries & Edge Cases)', () => {
        it('1.1 Login con cuerpo vacío {} retorna HTTP 400', async () => {
            client.clearToken();
            const res = await client.post('/api/login', {});
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('correo y contraseña'));
        });

        it('1.2 Login sin contraseña { email } retorna HTTP 400', async () => {
            client.clearToken();
            const res = await client.post('/api/login', { email: 'director@sigpa.edu' });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
        });

        it('1.3 Login con correo inexistente retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.login('noexiste@sigpa.edu', '1234');
            assert.equal(res.status, 401);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('Credenciales'));
        });

        it('1.4 Login con contraseña incorrecta retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.login('director@sigpa.edu', 'clave_erronea_999');
            assert.equal(res.status, 401);
            assert.equal(res.data.success, false);
        });

        it('1.5 GET /api/perfil con token malformado retorna HTTP 401', async () => {
            client.setToken('token.completamente.invalido_xyz123');
            const res = await client.get('/api/perfil');
            assert.equal(res.status, 401);
            assert.equal(res.data.success, false);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 2: Cambio de Contraseña Seguro (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 2: Cambio de Contraseña Seguro (Boundaries & Edge Cases)', () => {
        it('2.1 Petición de cambio de contraseña sin token retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.post('/api/perfil/cambiar-contrasena', {
                contrasena_actual: '1234',
                nueva_contrasena: 'nueva_clave_678',
            });
            assert.equal(res.status, 401);
        });

        it('2.2 Nueva contraseña con longitud menor a 6 caracteres retorna HTTP 400', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/perfil/cambiar-contrasena', {
                contrasena_actual: '1234',
                nueva_contrasena: '12345', // 5 caracteres (<6)
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('al menos 6 caracteres'));
        });

        it('2.3 Nueva contraseña idéntica a la actual retorna HTTP 400', async () => {
            client.setToken(estudianteToken);
            // Primero aseguramos que tenga una clave válida de >= 6 caracteres
            await client.post('/api/perfil/cambiar-contrasena', {
                contrasena_actual: '1234',
                nueva_contrasena: 'clave_valida_1234',
            });
            // Ahora intentamos cambiar a la misma contraseña
            const res = await client.post('/api/perfil/cambiar-contrasena', {
                contrasena_actual: 'clave_valida_1234',
                nueva_contrasena: 'clave_valida_1234', // idéntica
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('diferente a la contraseña actual'));

            // Restaurar clave
            await client.post('/api/perfil/cambiar-contrasena', {
                contrasena_actual: 'clave_valida_1234',
                nueva_contrasena: 'clave_segura_final',
            });
        });

        it('2.4 Contraseña actual incorrecta retorna HTTP 400', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/perfil/cambiar-contrasena', {
                contrasena_actual: 'clave_incorrecta_xyz',
                nueva_contrasena: 'nueva_clave_segura_123',
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('actual ingresada es incorrecta'));
        });

        it('2.5 Petición con cuerpo vacío {} retorna HTTP 400', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/perfil/cambiar-contrasena', {});
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 3: Habilitación de Instituciones y Convenios (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 3: Habilitación de Instituciones y Convenios (Boundaries & Edge Cases)', () => {
        it('3.1 Registro de institución sin autenticación retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.post('/api/director/nueva_institucion', { nombre: 'Colegio Demo' });
            assert.equal(res.status, 401);
        });

        it('3.2 Registro de institución por rol Estudiante retorna HTTP 403 Forbidden', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/director/nueva_institucion', { nombre: 'Colegio Demo' });
            assert.equal(res.status, 403);
            assert.equal(res.data.success, false);
        });

        it('3.3 Registro de institución sin nombre retorna HTTP 400', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nueva_institucion', { cupos: 5 });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('nombre'));
        });

        it('3.4 Registro de institución con nombre vacío retorna HTTP 400', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nueva_institucion', { nombre: '', cupos: 5 });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('nombre'));
        });

        it('3.5 Consulta de catálogo de instituciones por rol Estudiante retorna HTTP 403', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/director/instituciones');
            assert.equal(res.status, 403);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 4: Parametrización de Prácticas Pedagógicas (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 4: Parametrización de Prácticas Pedagógicas (Boundaries & Edge Cases)', () => {
        it('4.1 Creación de práctica por rol Estudiante retorna HTTP 403 Forbidden', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/director/nueva_practica', { nombre: 'Práctica Hack', horas: 64, semestre: 1 });
            assert.equal(res.status, 403);
        });

        it('4.2 Creación de práctica sin token retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.post('/api/director/nueva_practica', { nombre: 'Práctica Demo' });
            assert.equal(res.status, 401);
        });

        it('4.3 Creación de práctica sin nombre ni horas retorna HTTP 400', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nueva_practica', {});
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
        });

        it('4.4 Cambio de estado con valor inválido (diferente de ABIERTA/CERRADA) retorna HTTP 400', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/cambiar_estado', {
                id: 1,
                estado: 'ESTADO_INVALIDO_XYZ',
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
        });

        it('4.5 Cambio de estado sin ID de práctica retorna HTTP 400', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/cambiar_estado', {
                estado: 'CERRADA',
            });
            assert.equal(res.status, 400);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 5: Asignación Tripartita de Plazas (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 5: Asignación Tripartita de Plazas (Boundaries & Edge Cases)', () => {
        it('5.1 Asignación de plazas sin token retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.post('/api/director/asignar', { id_estudiante: 3 });
            assert.equal(res.status, 401);
        });

        it('5.2 Intento de asignación por rol Tutor retorna HTTP 403 Forbidden', async () => {
            client.setToken(tutorToken);
            const res = await client.post('/api/director/asignar', {
                id_estudiante: 3,
                id_practica: 1,
                id_institucion: 1,
            });
            assert.equal(res.status, 403);
        });

        it('5.3 Asignación con campos obligatorios vacíos retorna HTTP 400', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/asignar', {});
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('obligatorios'));
        });

        it('5.4 Asignación con institución inexistente retorna HTTP 400', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/asignar', {
                id_estudiante: 3,
                id_practica: 1,
                id_institucion: 99999, // Inexistente
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('no existe'));
        });

        it('5.5 Asignación sin práctica obligatoria retorna HTTP 400', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/asignar', {
                id_estudiante: 3,
                id_institucion: 1,
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('obligatorios'));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 6: Diligenciamiento de Bitácora y Momentos Pedagógicos (Límites)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 6: Diligenciamiento de Bitácora y Momentos Pedagógicos (Boundaries)', () => {
        it('6.1 Rechaza sesión con 0 horas con HTTP 400 (límite inferior estricto)', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: 1,
                visita: 5,
                horas: 0,
                fecha: '2026-09-01',
                actividades: 'Sesión nula',
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
        });

        it('6.2 Rechaza sesión con horas negativas (-2h) con HTTP 400', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: 1,
                visita: 5,
                horas: -2,
                fecha: '2026-09-01',
                actividades: 'Sesión negativa',
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
        });

        it('6.3 Rechaza sesión con horas superiores a 8 (ej. 10 horas) con HTTP 400', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: 1,
                visita: 5,
                horas: 10,
                fecha: '2026-09-01',
                actividades: 'Sesión excesiva',
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('entre 1 y 8 horas'));
        });

        it('6.4 Rechaza sesión con fecha en el futuro ("2099-12-31") con HTTP 400', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: 1,
                visita: 5,
                horas: 4,
                fecha: '2099-12-31',
                actividades: 'Sesión del futuro',
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('fecha futura'));
        });

        it('6.5 Rechaza sesión con momentos pedagógicos y actividades en blanco con HTTP 400', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: 1,
                visita: 5,
                horas: 4,
                fecha: '2026-09-01',
                actividades: '   ',
                inicio_motivacion: '',
                desarrollo: '',
                cierre_evaluacion: '',
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('momentos pedagógicos'));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 7: Validación Formatos P5 y P6 con Evidencias (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 7: Validación Formatos P5 y P6 con Evidencias (Boundaries & Edge Cases)', () => {
        let asigP5Id = 0;
        let asigP6Id = 0;

        before(async () => {
            // Asignar estudiante 6 a práctica 5 y práctica 6 para pruebas de rechazo
            client.setToken(directorToken);
            await client.post('/api/director/asignar', {
                id_estudiante: 6,
                id_practica: 5,
                id_institucion: 1,
                id_tutor: 4,
            });
            await client.post('/api/director/asignar', {
                id_estudiante: 6,
                id_practica: 6,
                id_institucion: 1,
                id_tutor: 4,
            });

            const res = await client.get('/api/director/asignaciones');
            const p5 = res.data.data.find(a => (a.practica && a.practica.includes('5')) || a.id_practica === 5);
            const p6 = res.data.data.find(a => (a.practica && a.practica.includes('6')) || a.id_practica === 6);
            asigP5Id = p5 ? p5.id : 2;
            asigP6Id = p6 ? p6.id : 3;
        });

        it('7.1 Rechaza bitácora de práctica Semestre 5 sin evidencia con HTTP 400 (normativo P5)', async () => {
            const est2 = await client.login('estudiante2@sigpa.edu', '1234');
            client.setToken(est2.data.token);

            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: asigP5Id,
                visita: 2,
                horas: 6,
                fecha: '2026-09-01',
                actividades: 'Intervención comunitaria sin evidencia adjunta',
                // evidencia omitida intencionalmente
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('Formatos P5/P6'));
        });

        it('7.2 Rechaza bitácora de práctica Semestre 6 sin evidencia con HTTP 400 (normativo P6)', async () => {
            const est2 = await client.login('estudiante2@sigpa.edu', '1234');
            client.setToken(est2.data.token);

            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: asigP6Id,
                visita: 1,
                horas: 8,
                fecha: '2026-09-01',
                actividades: 'Práctica de grado sin adjunto',
                evidencia: '', // Cadena vacía
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('Formatos P5/P6'));
        });

        it('7.3 Rechaza evidencia que solo contenga espacios en blanco en Semestre 5', async () => {
            const est2 = await client.login('estudiante2@sigpa.edu', '1234');
            client.setToken(est2.data.token);

            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: asigP5Id,
                visita: 2,
                horas: 6,
                fecha: '2026-09-01',
                actividades: 'Intervención comunitaria con espacios',
                evidencia: '     ',
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
        });

        it('7.4 GET /api/estudiante/evidencias sin token retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.get('/api/estudiante/evidencias');
            assert.equal(res.status, 401);
        });

        it('7.5 Estudiante consultando evidencias de otro estudiante retorna HTTP 403 Forbidden', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/evidencias', { query: { id_estudiante: 6 } });
            assert.equal(res.status, 403);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('No tienes permiso'));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 8: Aval Presencial In Situ (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 8: Aval Presencial In Situ (Boundaries & Edge Cases)', () => {
        it('8.1 Evaluación in situ sin autenticación retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.post('/api/asesor/evaluar', { id_bitacora: 1, comentarios: 'Observación' });
            assert.equal(res.status, 401);
        });

        it('8.2 Evaluación in situ por rol Estudiante retorna HTTP 403 Forbidden', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/asesor/evaluar', { id_bitacora: 1, comentarios: 'Auto-evaluación' });
            assert.equal(res.status, 403);
        });

        it('8.3 Evaluación in situ sin id_bitacora retorna HTTP 400', async () => {
            client.setToken(asesorToken);
            const res = await client.post('/api/asesor/evaluar', { comentarios: 'Comentario sin id' });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('id_bitacora'));
        });

        it('8.4 Evaluación in situ sin comentarios u observaciones retorna HTTP 400', async () => {
            client.setToken(asesorToken);
            const res = await client.post('/api/asesor/evaluar', { id_bitacora: 1, comentarios: '' });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
        });

        it('8.5 Consulta de estudiantes del asesor por rol Estudiante retorna HTTP 403', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/asesor/estudiantes');
            assert.equal(res.status, 403);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 9: Calificación Tutor UDI y Acumulación Atómica (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 9: Calificación Tutor UDI y Acumulación Atómica (Boundaries)', () => {
        it('9.1 Calificación por Tutor sin autenticación retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.post('/api/tutor/calificar', { id_bitacora: 1, nota: 4.0 });
            assert.equal(res.status, 401);
        });

        it('9.2 Calificación de bitácora por rol Estudiante retorna HTTP 403 Forbidden', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/tutor/calificar', { id_bitacora: 1, nota: 5.0 });
            assert.equal(res.status, 403);
        });

        it('9.3 Calificación sin campo numérico de nota retorna HTTP 400', async () => {
            client.setToken(tutorToken);
            const res = await client.post('/api/tutor/calificar', { id_bitacora: 1 });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('nota'));
        });

        it('9.4 Nota reprobatoria (< 3.0, ej. 2.2) NO incrementa horas acumuladas', async () => {
            // Obtener horas actuales del estudiante Laura
            client.setToken(estudianteToken);
            const asigBefore = await client.get('/api/estudiante/asignacion');
            const horasAntes = Number(asigBefore.data.data.horasAcumuladas);

            // Radicar nueva bitácora de 5 horas
            const bitRes = await client.post('/api/estudiante/bitacora', {
                id_asignacion: 1,
                visita: 6,
                horas: 5,
                fecha: '2026-09-25',
                actividades: 'Sesión evaluada negativamente por inasistencia parcial',
            });
            assert.equal(bitRes.status, 200);

            // Consultar id de la bitácora recién creada
            const bits = await client.get('/api/estudiante/bitacoras');
            const b6 = bits.data.data.find(b => b.visita === 6);
            assert.ok(b6);

            // Tutor califica con nota deficiente 2.2 (< 3.0)
            client.setToken(tutorToken);
            const calRes = await client.post('/api/tutor/calificar', {
                id_bitacora: b6.id,
                nota: 2.2,
                comentarios: 'No se cumplió la planeación ni se justificó la retirada temprana.',
            });
            assert.equal(calRes.status, 200);

            // Verificar que las horas acumuladas permanezcan IDÉNTICAS (sin incremento)
            client.setToken(estudianteToken);
            const asigAfter = await client.get('/api/estudiante/asignacion');
            const horasDespues = Number(asigAfter.data.data.horasAcumuladas);
            assert.equal(horasDespues, horasAntes, 'Horas acumuladas no deben variar ante nota reprobatoria');
        });

        it('9.5 Aprobación de asignación con cuerpo vacío retorna HTTP 400', async () => {
            client.setToken(tutorToken);
            const res = await client.post('/api/tutor/aprobar_asignacion', {});
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 10: Dashboard de KPIs y Semáforo de Progreso (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 10: Dashboard de KPIs y Semáforo de Progreso (Boundaries)', () => {
        it('10.1 GET /api/director/kpis sin autenticación retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.get('/api/director/kpis');
            assert.equal(res.status, 401);
        });

        it('10.2 GET /api/director/kpis por rol Estudiante retorna HTTP 403 Forbidden', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/director/kpis');
            assert.equal(res.status, 403);
        });

        it('10.3 GET /api/estudiante/progreso sin token retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.get('/api/estudiante/progreso');
            assert.equal(res.status, 401);
        });

        it('10.4 GET /api/estudiante/progreso con estudiante inexistente (?id_estudiante=99999) retorna aviso de asignación no encontrada', async () => {
            client.setToken(tutorToken);
            const res = await client.get('/api/estudiante/progreso', { query: { id_estudiante: 99999 } });
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('No se encontró asignación'));
        });

        it('10.5 GET /api/director/estado por rol Asesor retorna HTTP 403 Forbidden', async () => {
            client.setToken(asesorToken);
            const res = await client.get('/api/director/estado');
            assert.equal(res.status, 403);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 11: Banco de Preguntas Guía Curriculares (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 11: Banco de Preguntas Guía Curriculares (Boundaries)', () => {
        it('11.1 Consulta de preguntas guía sin autenticación retorna HTTP 401', async () => {
            client.clearToken();
            const res = await client.get('/api/estudiante/preguntas_guia');
            assert.equal(res.status, 401);
        });

        it('11.2 Práctica y visita no registradas (ej. 999/999) activa fallback sin colapsar (retorna HTTP 200)', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/preguntas-guia/999/999');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
            assert.ok(res.data.data.length >= 1, 'Fallback debe proveer preguntas por defecto');
        });

        it('11.3 Valores cero en ruta (/0/0) responden limpiamente sin error 500', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/preguntas-guia/0/0');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('11.4 Parámetros de ruta no numéricos (/abc/xyz) son tolerados con fallback', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/preguntas-guia/abc/xyz');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('11.5 Consulta sin query params a /preguntas_guia retorna HTTP 400 por parámetros faltantes', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/preguntas_guia');
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('obligatorio'));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 12: Microservicio de Reportes (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 12: Microservicio de Reportes (Boundaries & Edge Cases)', () => {
        it('12.1 Generación de informe con cuerpo vacío retorna HTTP 400', async () => {
            const res = await client.post('/api/v1/reports/visita-pdf', {});
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.error.includes('parámetros obligatorios'));
        });

        it('12.2 Generación de Acta de Cierre sin id_asignacion retorna HTTP 400', async () => {
            const res = await client.post('/api/v1/reports/acta-cierre-pdf', {
                horas_acumuladas: 64,
                horas_requeridas: 64,
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
        });

        it('12.3 Generación de Acta de Cierre con horas acumuladas insuficientes (<100%) retorna HTTP 400', async () => {
            const res = await client.post('/api/v1/reports/acta-cierre-pdf', {
                id_asignacion: 1,
                horas_acumuladas: 32, // 32 de 64 (50%)
                horas_requeridas: 64,
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.error.includes('Requisito no cumplido'));
            assert.ok(res.data.error.includes('100%'));
        });

        it('12.4 Generación de Acta de Cierre con bitácoras pendientes de evaluación retorna HTTP 400', async () => {
            const res = await client.post('/api/v1/reports/acta-cierre-pdf', {
                id_asignacion: 1,
                horas_acumuladas: 64,
                horas_requeridas: 64,
                bitacoras_pendientes: 2, // 2 pendientes
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.error.includes('pendientes de evaluación'));
        });

        it('12.5 Envoltorio de error cumple con estructura estándar JSON { success: false, error: string }', async () => {
            const res = await client.post('/api/v1/reports/acta-cierre-pdf', {});
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.equal(typeof res.data.error, 'string');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 13: API Gateway & Enrutamiento Perimetral (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 13: API Gateway & Enrutamiento Perimetral (Boundaries)', () => {
        it('13.1 Cabecera de autenticación con esquema Basic en lugar de Bearer retorna HTTP 401', async () => {
            const res = await client.get('/api/director/kpis', {
                headers: { Authorization: 'Basic dXNlcjpwYXNz' },
            });
            assert.equal(res.status, 401);
            assert.equal(res.data.success, false);
        });

        it('13.2 Token manipulado / firma forjada retorna HTTP 401', async () => {
            // Forjar token firmado con otra clave secreta
            const fakeToken = jwt.sign({ id: 1, email: 'fake@sigpa.edu', rol: 'DIRECTOR' }, 'clave_falsa_secreta_999');
            const res = await client.get('/api/director/kpis', {
                headers: { Authorization: `Bearer ${fakeToken}` },
            });
            assert.equal(res.status, 401);
            assert.equal(res.data.success, false);
        });

        it('13.3 Ruta inexistente bajo /api/ no encontrada retorna 404 o es manejada limpiamente', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/ruta_completamente_inexistente_xyz_123');
            assert.ok([404, 200].includes(res.status)); // SPA o 404
        });

        it('13.4 Cabecera Bearer vacía ("Bearer ") retorna HTTP 401', async () => {
            const res = await client.get('/api/director/kpis', {
                headers: { Authorization: 'Bearer ' },
            });
            assert.equal(res.status, 401);
        });

        it('13.5 Token expirado es detectado y bloqueado con HTTP 401', async () => {
            const secret = process.env.JWT_SECRET || 'sigpa_udi_secret_key_2026_super_segura';
            const expiredToken = jwt.sign(
                { id: 1, email: 'director@sigpa.edu', rol: 'DIRECTOR' },
                secret,
                { expiresIn: '-10s' } // Expirado hace 10 segundos
            );
            const res = await client.get('/api/director/kpis', {
                headers: { Authorization: `Bearer ${expiredToken}` },
            });
            assert.equal(res.status, 401);
            assert.ok(res.data.message.includes('expirado') || res.data.message.includes('inválido'));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 14: Persistencia Dual: Oracle 10g Express (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 14: Persistencia Dual: Oracle 10g Express (Boundaries)', () => {
        it('14.1 Intento de inserción con correo duplicado es bloqueado con HTTP 400 amigable', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nuevo_usuario', {
                nombre: 'Duplicado Prueba',
                email: 'tutor@sigpa.edu',
                contrasena: '123456',
                rol: 'TUTOR',
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('ya se encuentra registrado'));
        });

        it('14.2 Intento de inyección SQL en parámetro de texto no altera la sintaxis', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nueva_institucion', {
                nombre: "Colegio O'Reilly'; DROP TABLE USUARIO; --",
                cupos: 3,
            });
            assert.equal(res.status, 200);

            // Confirmar que la tabla USUARIO sigue intacta
            const check = await client.get('/api/test-db');
            assert.ok(check.data.tables.includes('USUARIO'));
        });

        it('14.3 Intento de login con cuenta desactivada (ACTIVO = N) retorna HTTP 401', async () => {
            // Desactivar usuario estudiante 6 (Andrés)
            client.setToken(directorToken);
            const desRes = await client.post('/api/director/cambiar_estado_usuario', {
                id: 6,
                activo: 'N',
            });
            assert.equal(desRes.status, 200);

            // Intentar login con la cuenta suspendida
            client.clearToken();
            const logRes = await client.login('estudiante2@sigpa.edu', '1234');
            assert.equal(logRes.status, 401);
            assert.equal(logRes.data.success, false);
            assert.ok(logRes.data.message.includes('inactivo') || logRes.data.message.includes('contacte a la dirección'));

            // Reactivar cuenta
            client.setToken(directorToken);
            await client.post('/api/director/cambiar_estado_usuario', { id: 6, activo: 'S' });
        });

        it('14.4 Errores no exponen stack traces internos de Oracle al cliente', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nuevo_usuario', {
                nombre: 'Demo',
                email: 'tutor@sigpa.edu', // Duplicado
                contrasena: '123456',
                rol: 'TUTOR',
            });
            assert.equal(res.data.stack, undefined);
        });

        it('14.5 Respuestas de error contienen siempre atributo message limpio', async () => {
            client.clearToken();
            const res = await client.get('/api/perfil');
            assert.equal(typeof res.data.message, 'string');
            assert.ok(res.data.message.length > 0);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 15: Persistencia Dual: SQLite Native Mock (Límites y Negativas)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 15: Persistencia Dual: SQLite Native Mock (Boundaries)', () => {
        it('15.1 Filtrado de binds descarta parámetros excedentes previniendo error Unknown parameter', async () => {
            const { filterBindsForSql } = require('../../backend-node/src/config/sqlite');
            const sql = 'SELECT * FROM USUARIO WHERE ID_USUARIO = :id';
            const extraBinds = { id: 1, extraParam1: 'hola', extraParam2: 12345 };
            const filtered = filterBindsForSql(sql, extraBinds);
            assert.equal(filtered.id, 1);
            assert.equal(filtered.extraParam1, undefined);
            assert.equal(filtered.extraParam2, undefined);
        });

        it('15.2 Traductor SQL sustituye ROWNUM <= N por LIMIT N correctamente', async () => {
            const { translateSql } = require('../../backend-node/src/config/sqlite');
            const sql = 'SELECT * FROM PRACTICA WHERE ROWNUM <= 5';
            const translated = translateSql(sql);
            assert.ok(translated.includes('LIMIT 5'));
            assert.ok(!translated.includes('ROWNUM'));
        });

        it('15.3 Función NVL maneja null y undefined retornando valor de contingencia', async () => {
            const { executeSqliteQuery } = require('../../backend-node/src/config/sqlite');
            const res = await executeSqliteQuery('SELECT NVL(NULL, 100) AS RESULTADO');
            assert.equal(res.rows[0].RESULTADO, 100);
        });

        it('15.4 Función TO_CHAR maneja fechas formateadas sin lanzar excepción', async () => {
            const { executeSqliteQuery } = require('../../backend-node/src/config/sqlite');
            const res = await executeSqliteQuery("SELECT TO_CHAR(datetime('now'), 'YYYY-MM-DD') AS FECHA_FMT");
            assert.ok(res.rows[0].FECHA_FMT !== undefined);
        });

        it('15.5 Transacción abortada en SQLite revierte cambios ante error controlado', async () => {
            const { executeSqliteTransaction, executeSqliteQuery } = require('../../backend-node/src/config/sqlite');
            const beforeCount = (await executeSqliteQuery('SELECT COUNT(*) AS CNT FROM MODALIDAD')).rows[0].CNT;

            try {
                await executeSqliteTransaction(async (conn) => {
                    await conn.execute("INSERT INTO MODALIDAD (ID_MODALIDAD, NOMBRE) VALUES (9999, 'Modalidad Fallida')");
                    throw new Error('Forzar Rollback intencional');
                });
            } catch (err) {
                assert.equal(err.message, 'Forzar Rollback intencional');
            }

            const afterCount = (await executeSqliteQuery('SELECT COUNT(*) AS CNT FROM MODALIDAD')).rows[0].CNT;
            assert.equal(afterCount, beforeCount, 'La transacción abortada debió hacer rollback total');
        });
    });
});
