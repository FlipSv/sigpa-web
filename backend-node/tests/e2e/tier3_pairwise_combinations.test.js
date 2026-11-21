/**
 * Tier 3 — Cross-Feature Pairwise Combinations Test Suite (≥16 tests)
 * 
 * Pairwise interaction testing covering multi-role data flow,
 * state machine transitions, and cross-feature operational contracts.
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDb, teardownTestDb } = require('../helpers/testDb');
const { startTestServer } = require('../helpers/testServer');
const { createApiClient } = require('../helpers/apiClient');

describe('Tier 3: Cross-Feature Pairwise Combinations (≥16 Tests)', () => {
    let serverClose;
    let client;
    let directorToken;
    let tutorToken;
    let estudianteToken;
    let asesorToken;

    before(async () => {
        await setupTestDb('tier3_pairwise');
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
    // Pairwise 1 & 2: Director ↔ Catálogos ↔ Asignaciones
    // ──────────────────────────────────────────────────────────────────────────
    describe('Par 1 & 2: Director crea Práctica e Institución -> Vinculación Formal', () => {
        it('3.01 Director crea nueva Práctica -> Práctica queda catalogada y disponible', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nueva_practica', {
                nombre: 'Práctica Pairwise Experimental III',
                semestre: 3,
                horas: 64,
                tipo: 'DOCENTE',
                descripcion: 'Práctica pedagógica para verificación pairwise',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);

            const cat = await client.get('/api/director/estado');
            assert.ok(cat.data.data.some(p => p.nombre.includes('Pairwise Experimental')));
        });

        it('3.02 Director crea Institución con cupos -> Institución queda disponible para asignación', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nueva_institucion', {
                nombre: 'Colegio Pairwise Integrado',
                direccion: 'Calle 50 # 15-20',
                telefono: '6076112233',
                cupos: 4,
                vencimiento: '2028-12-31',
            });
            assert.equal(res.status, 200);

            const insts = await client.get('/api/director/instituciones');
            const found = insts.data.data.find(i => i.nombre.includes('Pairwise Integrado'));
            assert.ok(found);
            assert.equal(found.cupos, 4);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Pairwise 3, 4, 5: Director Asigna -> Tutor, Asesor y Estudiante observan
    // ──────────────────────────────────────────────────────────────────────────
    describe('Pares 3, 4, 5: Director Asigna Estudiante -> Efectos Multirrol Tripartitos', () => {
        let newAsigId = 0;

        it('3.03 Director asigna estudiante Andrés Silva -> Asignación tripartita exitosa', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/asignar', {
                id_estudiante: 6, // Andrés Silva
                id_practica: 1,
                id_institucion: 1,
                id_tutor: 4,      // Mateo Gómez
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);

            const asigs = await client.get('/api/director/asignaciones');
            const asig = asigs.data.data.find(a => a.estudiante.includes('Andrés'));
            assert.ok(asig);
            newAsigId = asig.id;
        });

        it('3.04 Tutor asignado observa al estudiante Andrés en su lista de estudiantes', async () => {
            client.setToken(tutorToken);
            const res = await client.get('/api/tutor/asignaciones', { query: { id_tutor: 4 } });
            assert.equal(res.status, 200);
            assert.ok(res.data.data.some(a => a.estudiante.includes('Andrés')));
        });

        it('3.05 Asesor In Situ observa al estudiante Andrés vinculado a su centro de práctica', async () => {
            client.setToken(asesorToken);
            const res = await client.get('/api/asesor/estudiantes');
            assert.equal(res.status, 200);
            assert.ok(res.data.data.some(a => a.estudiante.includes('Andrés')));
        });

        it('3.06 Estudiante Andrés observa su asignación activa con 0 horas iniciales', async () => {
            const andresLog = await client.login('estudiante2@sigpa.edu', '1234');
            client.setToken(andresLog.data.token);

            const res = await client.get('/api/estudiante/asignacion');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.equal(Number(res.data.data.horasAcumuladas), 0);
            assert.ok(res.data.data.estado === 'EN_CURSO' || res.data.data.estado === 'APROBADA');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Pairwise 6, 7: Estudiante Radica Bitácora -> Tutor y Asesor visualizan
    // ──────────────────────────────────────────────────────────────────────────
    describe('Pares 6, 7: Estudiante Radica Bitácora -> Colas de Tutor y Asesor', () => {
        let bitacoraId = 0;

        it('3.07 Estudiante Laura radica bitácora estructurada con 3 momentos pedagógicos', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: 1,
                visita: 2,
                horas: 6,
                fecha: '2026-09-10',
                inicio_motivacion: 'Dinámica de rompehielos con títeres y canciones',
                desarrollo: 'Actividad de lectoescritura guiada y rondas de preguntas',
                cierre_evaluacion: 'Dibujo reflexivo colectivo y despedida en círculo',
                reflexion_docente: 'Excelente respuesta grupal, mejorar control de tiempos',
                evidencia: 'https://drive.google.com/drive/folders/evidencia_visita_2_pw',
            });
            assert.equal(res.status, 200);

            const bits = await client.get('/api/estudiante/bitacoras');
            const b = bits.data.data.find(item => item.visita === 2);
            assert.ok(b);
            bitacoraId = b.id;
        });

        it('3.08 Tutor observa la bitácora radicada en su cola de bitácoras pendientes', async () => {
            client.setToken(tutorToken);
            const res = await client.get('/api/tutor/bitacoras', { query: { id_tutor: 2 } });
            assert.equal(res.status, 200);
            assert.ok(res.data.data.some(b => b.visita === 2 && b.estudiante.includes('Laura')));
        });

        it('3.09 Asesor In Situ observa la bitácora en su cola para certificación presencial', async () => {
            client.setToken(asesorToken);
            const res = await client.get('/api/asesor/bitacoras');
            assert.equal(res.status, 200);
            assert.ok(res.data.data.some(b => b.visita === 2 && b.estudiante.includes('Laura')));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Pairwise 8, 9, 10: Asesor Avala -> Tutor Califica -> Horas se Acumulan
    // ──────────────────────────────────────────────────────────────────────────
    describe('Pares 8, 9, 10: Asesor Avala -> Tutor Califica -> Acumulación Atómica', () => {
        it('3.10 Asesor In Situ emite aval presencial certificando asistencia en aula', async () => {
            client.setToken(asesorToken);
            const res = await client.post('/api/asesor/evaluar', {
                id_bitacora: 2,
                comentarios: 'Asistencia presencial verificada; excelente actitud pedagógica con los infantes.',
                nota: 4.9,
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('3.11 Estudiante visualiza las observaciones del Asesor en su Línea de Tiempo', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/timeline');
            assert.equal(res.status, 200);
            const b2 = res.data.data.find(b => b.visita === 2);
            assert.ok(b2);
            assert.ok(b2.asesorEvaluacion);
            assert.ok(b2.asesorEvaluacion.comentarios.includes('Asistencia presencial verificada'));
        });

        it('3.12 Tutor califica la bitácora con 4.5 -> Se desencadena acumulación atómica de horas', async () => {
            client.setToken(tutorToken);
            const res = await client.post('/api/tutor/calificar', {
                id_bitacora: 2,
                nota: 4.5,
                comentarios: 'Excelente reflexión didáctica y coherencia pedagógica.',
            });
            assert.equal(res.status, 200);
            assert.ok(res.data.message.includes('Horas acumuladas'));
        });

        it('3.13 Horas acumuladas de la asignación del estudiante se incrementan en +6 horas', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/asignacion');
            assert.equal(res.status, 200);
            // 16h iniciales + 6h de sesión = 22h
            assert.equal(Number(res.data.data.horasAcumuladas), 22);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Pairwise 11, 12: Métricas de Progreso & Portafolio Digital
    // ──────────────────────────────────────────────────────────────────────────
    describe('Pares 11, 12: Métricas de Progreso & Portafolio Digital', () => {
        it('3.14 Semáforo de progreso del estudiante recalcula avance con las nuevas horas', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/progreso');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            // 22h / 64h = ~34.3% (debe ser semáforo AMARILLO)
            assert.ok(Number(res.data.data.porcentaje) > 30);
            assert.equal(res.data.data.semaforo, 'AMARILLO');
        });

        it('3.15 Portafolio digital indexa el soporte probatorio adjuntado por el estudiante', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/evidencias');
            assert.equal(res.status, 200);
            assert.ok(res.data.data.some(e => e.visita === 2 && e.urlEvidencia.includes('evidencia_visita_2_pw')));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Pairwise 13, 14, 15: Director Gestión Cuentas -> Seguridad RBAC
    // ──────────────────────────────────────────────────────────────────────────
    describe('Pares 13, 14, 15: Director Gestión Cuentas -> Seguridad de Acceso', () => {
        let newUserId = 0;

        it('3.16 Director aprovisiona nueva cuenta de Tutor -> Nuevo Tutor inicia sesión exitosamente', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nuevo_usuario', {
                nombre: 'Profesor Pairwise',
                apellido: 'García',
                email: 'tutor_pw@sigpa.edu',
                contrasena: 'clave_tutor_2026',
                rol: 'TUTOR',
            });
            assert.equal(res.status, 200);

            // Obtener ID del usuario recién creado
            const users = await client.get('/api/director/usuarios');
            const u = users.data.data.find(usr => usr.email === 'tutor_pw@sigpa.edu');
            assert.ok(u);
            newUserId = u.id;

            // Iniciar sesión con la nueva cuenta
            client.clearToken();
            const logRes = await client.login('tutor_pw@sigpa.edu', 'clave_tutor_2026');
            assert.equal(logRes.status, 200);
            assert.equal(logRes.data.usuario.rol, 'TUTOR');
        });

        it('3.17 Director suspende la cuenta (ACTIVO=N) -> Intento de inicio de sesión es bloqueado con 401', async () => {
            client.setToken(directorToken);
            const suspRes = await client.post('/api/director/cambiar_estado_usuario', {
                id: newUserId,
                activo: 'N',
            });
            assert.equal(suspRes.status, 200);

            // Intentar inicio de sesión bloqueado
            client.clearToken();
            const logRes = await client.login('tutor_pw@sigpa.edu', 'clave_tutor_2026');
            assert.equal(logRes.status, 401);
            assert.equal(logRes.data.success, false);
            assert.ok(logRes.data.message.includes('inactivo'));
        });

        it('3.18 Director reactiva la cuenta (ACTIVO=S) -> Inicio de sesión vuelve a ser exitoso', async () => {
            client.setToken(directorToken);
            const actRes = await client.post('/api/director/cambiar_estado_usuario', {
                id: newUserId,
                activo: 'S',
            });
            assert.equal(actRes.status, 200);

            // Iniciar sesión exitosamente
            client.clearToken();
            const logRes = await client.login('tutor_pw@sigpa.edu', 'clave_tutor_2026');
            assert.equal(logRes.status, 200);
            assert.equal(logRes.data.success, true);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Pairwise 16: Tutor aprueba asignación -> Estudiante refleja estado
    // ──────────────────────────────────────────────────────────────────────────
    describe('Par 16: Tutor actualiza Asignación -> Estudiante refleja estado', () => {
        it('3.19 Tutor actualiza estado de asignación a APROBADA -> Estudiante visualiza actualización', async () => {
            client.setToken(tutorToken);
            const res = await client.post('/api/tutor/aprobar_asignacion', {
                id_asignacion: 1,
                estado: 'APROBADA',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);

            client.setToken(estudianteToken);
            const asig = await client.get('/api/estudiante/asignacion');
            assert.equal(asig.status, 200);
            assert.equal(asig.data.data.estado, 'APROBADA');
        });
    });
});
