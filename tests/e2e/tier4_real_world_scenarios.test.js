/**
 * Tier 4 — Real-World Application Scenarios Test Suite (≥8 scenarios)
 * 
 * Complete end-to-end academic internship lifecycle simulations
 * modeling genuine institutional operations from initial curriculum
 * parameterization to final closure act generation.
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDb, teardownTestDb } = require('../helpers/testDb');
const { startTestServer } = require('../helpers/testServer');
const { createApiClient } = require('../helpers/apiClient');

describe('Tier 4: Real-World Application Scenarios (≥8 Scenarios)', () => {
    let serverClose;
    let client;
    let directorToken;
    let tutorToken;
    let estudianteToken;
    let asesorToken;

    before(async () => {
        await setupTestDb('tier4_scenarios');
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
    // Scenario 1: Happy Path Licenciatura Ciclo Completo (Semestre 1 - Observación)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Escenario 1: Happy Path: Licenciatura Ciclo Completo (Semestre 1)', () => {
        let sc1PracticaId = 0;
        let sc1InstId = 0;
        let sc1AsigId = 0;
        let sc1BitacoraId = 0;

        it('Paso 1: Director parametriza práctica e institución aliada para el semestre', async () => {
            client.setToken(directorToken);

            // Crear práctica
            const pracRes = await client.post('/api/director/nueva_practica', {
                nombre: 'Licenciatura Infancia I - Observación Cohorte 2026',
                semestre: 1,
                horas: 64,
                tipo: 'OBSERVACION',
                descripcion: 'Práctica inicial de observación etnográfica',
            });
            assert.equal(pracRes.status, 200);

            // Crear institución
            const instRes = await client.post('/api/director/nueva_institucion', {
                nombre: 'Centro Piloto de Primera Infancia UDI',
                direccion: 'Calle 10 # 25-30',
                telefono: '6076998877',
                cupos: 5,
                vencimiento: '2028-12-31',
            });
            assert.equal(instRes.status, 200);

            // Obtener IDs
            const practicas = await client.get('/api/director/estado');
            const p = practicas.data.data.find(item => item.nombre.includes('Cohorte 2026'));
            assert.ok(p);
            sc1PracticaId = p.id;

            const insts = await client.get('/api/director/instituciones');
            const i = insts.data.data.find(item => item.nombre.includes('Centro Piloto'));
            assert.ok(i);
            sc1InstId = i.id;
        });

        it('Paso 2: Director asigna formalmente a la practicante Laura con Tutor y Centro Receptor', async () => {
            client.setToken(directorToken);
            const asigRes = await client.post('/api/director/asignar', {
                id_estudiante: 3, // Laura Pérez
                id_practica: sc1PracticaId,
                id_institucion: sc1InstId,
                id_tutor: 4,      // Mateo Gómez
            });
            assert.equal(asigRes.status, 200);

            const asigs = await client.get('/api/director/asignaciones');
            const asig = asigs.data.data.find(a => a.id_practica === sc1PracticaId || a.practica.includes('Cohorte 2026'));
            assert.ok(asig);
            sc1AsigId = asig.id;
        });

        it('Paso 3: Practicante consulta preguntas guía y radica sesión completa de 8 horas con 3 momentos', async () => {
            client.setToken(estudianteToken);

            // Consultar preguntas guía
            const pregRes = await client.get(`/api/estudiante/preguntas-guia/${sc1PracticaId}/1`);
            assert.equal(pregRes.status, 200);
            assert.ok(pregRes.data.data.length >= 1);

            // Radicar bitácora
            const bitRes = await client.post('/api/estudiante/bitacora', {
                id_asignacion: sc1AsigId,
                visita: 1,
                horas: 8,
                fecha: '2026-09-05',
                inicio_motivacion: 'Presentación con canción de acogida y lectura de cuento infantil',
                desarrollo: 'Juegos cooperativos de psicomotricidad y modelado en plastilina',
                cierre_evaluacion: 'Asamblea grupal para dialogar sobre los dibujos creados',
                reflexion_docente: 'Los niños mostraron empatía; coordinar mejor la entrega de materiales',
                evidencia: 'https://drive.google.com/drive/folders/escenario1_bitacora1',
            });
            assert.equal(bitRes.status, 200);

            const bits = await client.get('/api/estudiante/bitacoras');
            const b = bits.data.data.find(item => item.id > 1 || item.estado === 'PENDIENTE');
            assert.ok(b);
            sc1BitacoraId = b.id;
        });

        it('Paso 4: Asesor In Situ certifica presencia y puntualidad con Aval Presencial', async () => {
            client.setToken(asesorToken);
            const res = await client.post('/api/asesor/evaluar', {
                id_bitacora: sc1BitacoraId,
                comentarios: 'Asistencia impecable, dinamismo en aula y trato respetuoso hacia los niños.',
                nota: 5.0,
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('Paso 5: Tutor evalúa con 4.8 y sistema acumula atómicamente 8 horas actualizando semáforo', async () => {
            client.setToken(tutorToken);
            const res = await client.post('/api/tutor/calificar', {
                id_bitacora: sc1BitacoraId,
                nota: 4.8,
                comentarios: 'Excelente reflexión pedagógica y planeación didáctica coherente.',
            });
            assert.equal(res.status, 200);
            assert.ok(res.data.message.includes('Horas acumuladas'));

            // Verificar acumulación en estudiante
            client.setToken(estudianteToken);
            const asigRes = await client.get('/api/estudiante/asignacion');
            assert.equal(asigRes.status, 200);
            assert.equal(Number(asigRes.data.data.horasAcumuladas), 8);

            const progRes = await client.get('/api/estudiante/progreso');
            assert.equal(progRes.status, 200);
            assert.ok(Number(progRes.data.data.porcentaje) > 0);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 2: Práctica Avanzada con Formato P5/P6 (Semestre 5)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Escenario 2: Práctica Avanzada con Formato P5/P6 (Semestre 5)', () => {
        let sc2AsigId = 0;
        let sc2BitId = 0;

        it('Paso 1: Director asigna estudiante a Práctica de Intervención Semestre 5', async () => {
            client.setToken(directorToken);
            const asigRes = await client.post('/api/director/asignar', {
                id_estudiante: 6, // Andrés Silva
                id_practica: 5,   // Práctica Semestre 5 (Exige P5)
                id_institucion: 1,
                id_tutor: 4,
            });
            assert.equal(asigRes.status, 200);

            const asigs = await client.get('/api/director/asignaciones');
            const asig = asigs.data.data.find(a => a.estudiante.includes('Andrés') && (a.practica.includes('5') || a.practica.includes('P5') || a.practica.includes('Integral')));
            assert.ok(asig);
            sc2AsigId = asig.id;
        });

        it('Paso 2: Intento de radicación en Semestre 5 sin evidencia es bloqueado con HTTP 400', async () => {
            const andresLog = await client.login('estudiante2@sigpa.edu', '1234');
            client.setToken(andresLog.data.token);

            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: sc2AsigId,
                visita: 1,
                horas: 6,
                fecha: '2026-09-12',
                actividades: 'Intervención comunitaria sin anexar Formato P5',
                // Sin evidencia
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('Formatos P5/P6'));
        });

        it('Paso 3: Radicación con enlace de evidencia Formato P5 en PDF es aceptada con éxito', async () => {
            const andresLog = await client.login('estudiante2@sigpa.edu', '1234');
            client.setToken(andresLog.data.token);

            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: sc2AsigId,
                visita: 1,
                horas: 6,
                fecha: '2026-09-12',
                actividades: 'Taller de estimulación temprana comunitaria con madres comunitarias',
                observaciones: 'Diagnóstico contextualizado con fichas de observación validadas',
                evidencia: 'https://repositorio.udi.edu.co/formatos/formato_p5_andres_firmado.pdf',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);

            const bits = await client.get('/api/estudiante/bitacoras');
            const b = bits.data.data.find(item => item.visita === 1);
            assert.ok(b);
            sc2BitId = b.id;
        });

        it('Paso 4: Doble evaluación y despacho de reporte PDF de visita', async () => {
            // Asesor avala
            client.setToken(asesorToken);
            await client.post('/api/asesor/evaluar', {
                id_bitacora: sc2BitId,
                comentarios: 'Intervención comunitaria P5 verificada presencialmente en sede comunitaria.',
                nota: 4.7,
            });

            // Tutor califica
            client.setToken(tutorToken);
            await client.post('/api/tutor/calificar', {
                id_bitacora: sc2BitId,
                nota: 4.8,
                comentarios: 'Formato P5 cumple con los estándares metodológicos de la licenciatura.',
            });

            // Microservicio de reportes compila informe
            const repRes = await client.post('/api/v1/reports/visita-pdf', {
                id_bitacora: sc2BitId,
                visita: 1,
                estudiante: 'Andrés Silva',
            });
            assert.equal(repRes.status, 200);
            assert.ok(repRes.data.reportUrl);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 3: Bloqueo Normativo por Cupos Agotados y Convenio Vencido
    // ──────────────────────────────────────────────────────────────────────────
    describe('Escenario 3: Bloqueo Normativo por Cupos Agotados y Convenio Inactivo', () => {
        let instCupoUnoId = 0;

        it('Paso 1: Director crea institución con cupo límite estricto de 1 plaza', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nueva_institucion', {
                nombre: 'Jardín Infantil Cupo Único Exclusivo',
                cupos: 1,
                vencimiento: '2028-12-31',
            });
            assert.equal(res.status, 200);

            const insts = await client.get('/api/director/instituciones');
            const inst = insts.data.data.find(i => i.nombre.includes('Cupo Único'));
            assert.ok(inst);
            assert.equal(inst.cupos, 1);
            instCupoUnoId = inst.id;
        });

        it('Paso 2: Primera asignación ocupa la totalidad de cupos disponibles (1/1)', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/asignar', {
                id_estudiante: 3, // Laura
                id_practica: 1,
                id_institucion: instCupoUnoId,
                id_tutor: 4,
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('Paso 3: Segunda asignación hacia la misma institución es bloqueada formalmente por cupo excedido', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/asignar', {
                id_estudiante: 6, // Andrés
                id_practica: 1,
                id_institucion: instCupoUnoId,
                id_tutor: 4,
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('Bloqueo de cupos') || res.data.message.includes('límite máximo'));
        });

        it('Paso 4: Asignación a institución con convenio inactivo es rechazada con bloqueo normativo', async () => {
            // Desactivar convenio de la institución en base de datos
            const { executeSqliteQuery } = require('../../backend-node/src/config/sqlite');
            await executeSqliteQuery("UPDATE INSTITUCION SET CONVENIO_ACTIVO = 'N' WHERE ID_INSTITUCION = :id", { id: instCupoUnoId });

            client.setToken(directorToken);
            const res = await client.post('/api/director/asignar', {
                id_estudiante: 6,
                id_practica: 2,
                id_institucion: instCupoUnoId,
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('Bloqueo normativo') || res.data.message.includes('convenio activo'));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 4: Suspensión y Seguridad de Cuenta (Rotación y Desactivación)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Escenario 4: Suspensión y Seguridad de Cuenta (Rotación y Desactivación)', () => {
        let cuentaPruebaToken;

        it('Paso 1: Director crea usuario institucional de prueba para ciclo de seguridad', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nuevo_usuario', {
                nombre: 'Docente Seguridad',
                apellido: 'Auditoría',
                email: 'seguridad_sc4@sigpa.edu',
                contrasena: 'clave_inicial_123',
                rol: 'TUTOR',
            });
            assert.equal(res.status, 200);

            client.clearToken();
            const logRes = await client.login('seguridad_sc4@sigpa.edu', 'clave_inicial_123');
            assert.equal(logRes.status, 200);
            cuentaPruebaToken = logRes.data.token;
        });

        it('Paso 2: Usuario autenticado actualiza su contraseña mediante rotación segura', async () => {
            client.setToken(cuentaPruebaToken);
            const res = await client.post('/api/perfil/cambiar-contrasena', {
                contrasena_actual: 'clave_inicial_123',
                nueva_contrasena: 'clave_rotada_2026_segura',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('Paso 3: Login con contraseña antigua es rechazado (401)', async () => {
            client.clearToken();
            const res = await client.login('seguridad_sc4@sigpa.edu', 'clave_inicial_123');
            assert.equal(res.status, 401);
            assert.equal(res.data.success, false);
        });

        it('Paso 4: Login con la nueva contraseña rotada es exitoso (200)', async () => {
            client.clearToken();
            const res = await client.login('seguridad_sc4@sigpa.edu', 'clave_rotada_2026_segura');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('Paso 5: Director suspende cuenta institucional (ACTIVO=N) -> Acceso es denegado con 401', async () => {
            client.setToken(directorToken);
            const users = await client.get('/api/director/usuarios');
            const u = users.data.data.find(usr => usr.email === 'seguridad_sc4@sigpa.edu');
            assert.ok(u);

            await client.post('/api/director/cambiar_estado_usuario', { id: u.id, activo: 'N' });

            client.clearToken();
            const logRes = await client.login('seguridad_sc4@sigpa.edu', 'clave_rotada_2026_segura');
            assert.equal(logRes.status, 401);
            assert.equal(logRes.data.success, false);
            assert.ok(logRes.data.message.includes('inactivo'));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 5: Evaluación Reprobatoria y No-Acumulación de Horas
    // ──────────────────────────────────────────────────────────────────────────
    describe('Escenario 5: Evaluación Reprobatoria y No-Acumulación de Horas', () => {
        let sc5BitId = 0;
        let horasPrevias = 0;

        it('Paso 1: Estudiante radica sesión de 6 horas presenciales', async () => {
            client.setToken(estudianteToken);
            const asigRes = await client.get('/api/estudiante/asignacion');
            horasPrevias = Number(asigRes.data.data.horasAcumuladas);

            const bitRes = await client.post('/api/estudiante/bitacora', {
                id_asignacion: 1,
                visita: 7,
                horas: 6,
                fecha: '2026-09-18',
                actividades: 'Sesión de aula con incumplimiento de acuerdos metodológicos',
                observaciones: 'Retiro no autorizado antes de finalizar la jornada',
                evidencia: 'https://drive.google.com/drive/folders/sesion_fallida',
            });
            assert.equal(bitRes.status, 200);

            const bits = await client.get('/api/estudiante/bitacoras');
            const b = bits.data.data.find(item => item.visita === 7);
            assert.ok(b);
            sc5BitId = b.id;
        });

        it('Paso 2: Asesor In Situ consigna observaciones de inasistencia parcial', async () => {
            client.setToken(asesorToken);
            const res = await client.post('/api/asesor/evaluar', {
                id_bitacora: sc5BitId,
                comentarios: 'El practicante se ausentó durante el momento de desarrollo escolar.',
                nota: 2.5,
            });
            assert.equal(res.status, 200);
        });

        it('Paso 3: Tutor califica con nota deficiente (2.2 < 3.0)', async () => {
            client.setToken(tutorToken);
            const res = await client.post('/api/tutor/calificar', {
                id_bitacora: sc5BitId,
                nota: 2.2,
                comentarios: 'No cumple los criterios mínimos formativos institucionales.',
            });
            assert.equal(res.status, 200);
        });

        it('Paso 4: Bitácora pasa a CALIFICADA pero las horas acumuladas no varían', async () => {
            client.setToken(estudianteToken);
            const bits = await client.get('/api/estudiante/bitacoras');
            const b7 = bits.data.data.find(b => b.visita === 7);
            assert.ok(b7);
            assert.equal(b7.estado, 'CALIFICADA');
            assert.equal(Number(b7.nota), 2.2);

            const asig = await client.get('/api/estudiante/asignacion');
            const horasNuevas = Number(asig.data.data.horasAcumuladas);
            assert.equal(horasNuevas, horasPrevias, 'Las horas acumuladas no deben incrementarse ante nota reprobatoria');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 6: Acumulación Gradual hacia el 100% y Despacho de Acta de Cierre
    // ──────────────────────────────────────────────────────────────────────────
    describe('Escenario 6: Acumulación Gradual hacia el 100% y Despacho de Acta de Cierre', () => {
        let sc6PracticaId = 0;
        let sc6AsigId = 0;

        it('Paso 1: Director crea práctica modular corta (16 horas) y asigna estudiante', async () => {
            client.setToken(directorToken);

            const pRes = await client.post('/api/director/nueva_practica', {
                nombre: 'Taller Intensivo Pedagógico de Grado (16h)',
                semestre: 4,
                horas: 16,
                tipo: 'INVESTIGATIVA',
            });
            assert.equal(pRes.status, 200);

            const practicas = await client.get('/api/director/estado');
            const p = practicas.data.data.find(item => item.nombre.includes('Taller Intensivo'));
            assert.ok(p);
            sc6PracticaId = p.id;

            const asigRes = await client.post('/api/director/asignar', {
                id_estudiante: 3,
                id_practica: sc6PracticaId,
                id_institucion: 1,
                id_tutor: 4,
            });
            assert.equal(asigRes.status, 200);

            const asigs = await client.get('/api/director/asignaciones');
            const asig = asigs.data.data.find(a => a.practica && a.practica.includes('Taller Intensivo'));
            assert.ok(asig);
            sc6AsigId = asig.id;
        });

        it('Paso 2: Solicitud de Acta de Cierre antes de completar las horas es rechazada (400)', async () => {
            const res = await client.post('/api/v1/reports/acta-cierre-pdf', {
                id_asignacion: sc6AsigId,
                horas_acumuladas: 0,
                horas_requeridas: 16,
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.error.includes('100%'));
        });

        it('Paso 3: Estudiante completa dos jornadas de 8h evaluadas con nota 4.8 alcanzando 16h (100%)', async () => {
            client.setToken(estudianteToken);

            // Sesión 1 (8h)
            await client.post('/api/estudiante/bitacora', {
                id_asignacion: sc6AsigId,
                visita: 1,
                horas: 8,
                fecha: '2026-09-01',
                actividades: 'Investigación pedagógica diagnóstica en primera infancia',
            });

            // Sesión 2 (8h)
            await client.post('/api/estudiante/bitacora', {
                id_asignacion: sc6AsigId,
                visita: 2,
                horas: 8,
                fecha: '2026-09-08',
                actividades: 'Sistematización de experiencias y talleres de intervención',
            });

            const bits = await client.get('/api/estudiante/bitacoras');
            const pending = bits.data.data.filter(b => b.estado === 'PENDIENTE');

            // Calificar ambas pendientes
            client.setToken(tutorToken);
            for (const pb of pending) {
                await client.post('/api/tutor/calificar', { id_bitacora: pb.id, nota: 4.8 });
            }
        });

        it('Paso 4: Solicitud de Acta de Cierre al 100% de horas cumplidas es aprobada emitiendo documento', async () => {
            const res = await client.post('/api/v1/reports/acta-cierre-pdf', {
                id_asignacion: sc6AsigId,
                horas_acumuladas: 16,
                horas_requeridas: 16,
                bitacoras_pendientes: 0,
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.reportUrl.includes('acta_cierre'));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 7: Seguridad Perimetral y Aislamiento Multirrol (Matriz de Permisos)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Escenario 7: Seguridad Perimetral y Aislamiento Multirrol', () => {
        it('Paso 1: Usuario no autenticado intentando ver KPIs recibe HTTP 401', async () => {
            client.clearToken();
            const res = await client.get('/api/director/kpis');
            assert.equal(res.status, 401);
            assert.equal(res.data.success, false);
        });

        it('Paso 2: Estudiante intentando crear práctica recibe HTTP 403 Forbidden', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/director/nueva_practica', { nombre: 'Práctica Hack' });
            assert.equal(res.status, 403);
            assert.equal(res.data.success, false);
        });

        it('Paso 3: Tutor intentando registrar institución recibe HTTP 403 Forbidden', async () => {
            client.setToken(tutorToken);
            const res = await client.post('/api/director/nueva_institucion', { nombre: 'Colegio Tutor' });
            assert.equal(res.status, 403);
            assert.equal(res.data.success, false);
        });

        it('Paso 4: Asesor In Situ intentando calificar como tutor recibe HTTP 403 Forbidden', async () => {
            client.setToken(asesorToken);
            const res = await client.post('/api/tutor/calificar', { id_bitacora: 1, nota: 5.0 });
            assert.equal(res.status, 403);
            assert.equal(res.data.success, false);
        });

        it('Paso 5: Estudiante intentando ver KPIs directivos recibe HTTP 403 Forbidden', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/director/kpis');
            assert.equal(res.status, 403);
            assert.equal(res.data.success, false);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 8: Resiliencia de Persistencia Dual y Recuperación de Sesión
    // ──────────────────────────────────────────────────────────────────────────
    describe('Escenario 8: Resiliencia de Persistencia Dual y Recuperación de Sesión', () => {
        it('Paso 1: Endpoint de diagnóstico confirma integridad del esquema y motor', async () => {
            const res = await client.get('/api/test-db');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.tables.length >= 8);
            assert.ok(res.data.totalUsuarios >= 6);
        });

        it('Paso 2: Consulta analítica que invoca funciones nativas Oracle emuladas responde con éxito', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/kpis');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.totalEstudiantes !== undefined);
            assert.ok(res.data.cuposDisponibles !== undefined);
        });

        it('Paso 3: Peticiones concurrentes multi-rol preservan consistencia de datos', async () => {
            // Ejecutar 3 peticiones en paralelo con diferentes tokens
            const [p1, p2, p3] = await Promise.all([
                (async () => {
                    const c = createApiClient(client.baseUrl);
                    c.setToken(directorToken);
                    return c.get('/api/director/estado');
                })(),
                (async () => {
                    const c = createApiClient(client.baseUrl);
                    c.setToken(tutorToken);
                    return c.get('/api/tutor/asignaciones');
                })(),
                (async () => {
                    const c = createApiClient(client.baseUrl);
                    c.setToken(estudianteToken);
                    return c.get('/api/estudiante/progreso');
                })(),
            ]);

            assert.equal(p1.status, 200);
            assert.equal(p2.status, 200);
            assert.equal(p3.status, 200);
            assert.equal(p1.data.success, true);
            assert.equal(p2.data.success, true);
            assert.equal(p3.data.success, true);
        });
    });
});
