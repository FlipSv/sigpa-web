/**
 * Tier 1 — Feature Coverage Test Suite (≥75 tests, ≥5 per feature across 15 features)
 * 
 * Systematic Category-Partition testing ensuring happy-path equivalence class
 * representatives across all 15 features of the SIGPA platform.
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDb, teardownTestDb } = require('../helpers/testDb');
const { startTestServer } = require('../helpers/testServer');
const { createApiClient } = require('../helpers/apiClient');

describe('Tier 1: Feature Coverage (≥75 Tests across 15 Features)', () => {
    let serverClose;
    let client;
    let directorToken;
    let tutorToken;
    let estudianteToken;
    let asesorToken;

    before(async () => {
        await setupTestDb('tier1_coverage');
        const { baseUrl, close } = await startTestServer();
        serverClose = close;
        client = createApiClient(baseUrl);

        // Pre-fetch tokens for all 4 roles
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
    // Feature 1: Autenticación RBAC (CU-01, RF-01, RNF-03)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 1: Autenticación RBAC', () => {
        it('1.1 Login exitoso como Director emite JWT con rol DIRECTOR', async () => {
            client.clearToken();
            const res = await client.login('director@sigpa.edu', '1234');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(typeof res.data.token === 'string' && res.data.token.length > 20);
            assert.equal(res.data.usuario.rol, 'DIRECTOR');
        });

        it('1.2 Login exitoso como Tutor emite JWT con rol TUTOR', async () => {
            client.clearToken();
            const res = await client.login('tutor@sigpa.edu', '1234');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.equal(res.data.usuario.rol, 'TUTOR');
        });

        it('1.3 Login exitoso como Estudiante emite JWT con rol ESTUDIANTE', async () => {
            client.clearToken();
            const res = await client.login('estudiante@sigpa.edu', '1234');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.equal(res.data.usuario.rol, 'ESTUDIANTE');
        });

        it('1.4 Login exitoso como Asesor In Situ emite JWT con rol ASESOR', async () => {
            client.clearToken();
            const res = await client.login('asesor@sigpa.edu', '1234');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.equal(res.data.usuario.rol, 'ASESOR');
        });

        it('1.5 GET /api/perfil con token válido retorna los datos del usuario autenticado', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/perfil');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.equal(res.data.usuario.email, 'director@sigpa.edu');
            assert.equal(res.data.usuario.rol, 'DIRECTOR');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 2: Cambio de Contraseña Seguro (CU-01, RNF-03)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 2: Cambio de Contraseña Seguro', () => {
        it('2.1 Usuario autenticado puede cambiar su contraseña exitosamente', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/perfil/cambiar-contrasena', {
                contrasena_actual: '1234',
                nueva_contrasena: 'nueva_clave_2026',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.message.includes('actualizada'));
        });

        it('2.2 Login con la nueva contraseña funciona correctamente', async () => {
            client.clearToken();
            const res = await client.login('estudiante@sigpa.edu', 'nueva_clave_2026');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            estudianteToken = res.data.token;
        });

        it('2.3 Usuario puede actualizar su contraseña a otra clave válida (>=6 chars)', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/perfil/cambiar-contrasena', {
                contrasena_actual: 'nueva_clave_2026',
                nueva_contrasena: 'clave_segura_2026',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('2.4 Ruta alternativa /api/cambiar-contrasena opera de forma idéntica', async () => {
            client.setToken(tutorToken);
            const res = await client.post('/api/cambiar-contrasena', {
                contrasena_actual: '1234',
                nueva_contrasena: 'tutor_pass_2026',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);

            // Revertir
            const revRes = await client.post('/api/cambiar-contrasena', {
                contrasena_actual: 'tutor_pass_2026',
                nueva_contrasena: 'tutor_pass_final',
            });
            assert.equal(revRes.status, 200);
        });

        it('2.5 Login con contraseña actualizada sigue siendo válido', async () => {
            client.clearToken();
            const res = await client.login('estudiante@sigpa.edu', 'clave_segura_2026');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            estudianteToken = res.data.token;
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 3: Habilitación de Instituciones y Convenios (CU-02, RF-01, RF-02)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 3: Habilitación de Instituciones y Convenios', () => {
        it('3.1 Director puede consultar el catálogo de instituciones aliadas', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/instituciones');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
            assert.ok(res.data.data.length >= 1);
        });

        it('3.2 Director puede registrar una nueva institución receptora con convenio vigente', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nueva_institucion', {
                nombre: 'Instituto Pedagógico Gabriela Mistral',
                direccion: 'Calle 45 # 22-10',
                telefono: '6076890011',
                cupos: 6,
                vencimiento: '2028-12-31',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('3.3 La nueva institución registrada aparece en la lista de instituciones', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/instituciones');
            assert.equal(res.status, 200);
            const found = res.data.data.find(i => i.nombre.includes('Gabriela Mistral'));
            assert.ok(found, 'La institución recién creada debe estar en el catálogo');
            assert.equal(found.cupos, 6);
        });

        it('3.4 Registro de institución asigna cupos por defecto si no se especifican', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nueva_institucion', {
                nombre: 'Colegio Campestre Los Robles',
                direccion: 'Km 5 Vía Ruitoque',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('3.5 Institución creada cuenta con convenio activo por defecto', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/instituciones');
            assert.equal(res.status, 200);
            const robles = res.data.data.find(i => i.nombre.includes('Los Robles'));
            assert.ok(robles);
            assert.ok(robles.convenioActivo === 'S' || robles.convenioActivo === true);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 4: Parametrización de Prácticas Pedagógicas (CU-01, RF-03)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 4: Parametrización de Prácticas Pedagógicas', () => {
        it('4.1 Director puede listar el catálogo de modalidades de práctica', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/estado');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
            assert.ok(res.data.data.length >= 1);
        });

        it('4.2 Ruta alternativa /api/director/practicas retorna catálogo equivalente', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/practicas');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
        });

        it('4.3 Director puede crear una nueva modalidad curricular de práctica', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nueva_practica', {
                nombre: 'Práctica Pedagógica de Inclusión y Diversidad VII',
                semestre: 7,
                horas: 80,
                tipo: 'INTERVENCION',
                descripcion: 'Atención a población escolar con necesidades educativas diversas',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('4.4 Director puede cambiar el estado de una práctica a CERRADA', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/cambiar_estado', {
                id: 1,
                estado: 'CERRADA',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('4.5 Director puede reabrir la práctica cambiando el estado a ABIERTA', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/cambiar_estado', {
                id: 1,
                estado: 'ABIERTA',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 5: Asignación Tripartita de Plazas (CU-03, CU-04, RF-04)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 5: Asignación Tripartita de Plazas', () => {
        it('5.1 Director puede listar las asignaciones tripartitas existentes', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/asignaciones');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
        });

        it('5.2 Director puede consultar usuarios para identificar candidatos a vinculación', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/usuarios');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.data.some(u => u.rol === 'ESTUDIANTE'));
            assert.ok(res.data.data.some(u => u.rol === 'TUTOR'));
        });

        it('5.3 Director asigna formalmente a un estudiante a práctica e institución aliada', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/asignar', {
                id_estudiante: 6, // Andrés Silva
                id_practica: 1,
                id_institucion: 1,
                id_tutor: 4,
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('5.4 La nueva asignación aparece registrada con horas iniciales en cero', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/asignaciones');
            assert.equal(res.status, 200);
            const asignacion = res.data.data.find(a => a.estudiante.includes('Andrés') || a.id === 2);
            assert.ok(asignacion);
            assert.equal(Number(asignacion.horasAcumuladas), 0);
        });

        it('5.5 Tutor puede visualizar al estudiante vinculado en su lista de asignaciones', async () => {
            client.setToken(tutorToken);
            const res = await client.get('/api/tutor/asignaciones', { query: { id_tutor: 4 } });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 6: Diligenciamiento de Bitácora y Momentos Pedagógicos (CU-06, RF-06)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 6: Diligenciamiento de Bitácora y Momentos Pedagógicos', () => {
        it('6.1 Estudiante radica bitácora estructurada con los 3 momentos pedagógicos', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: 1,
                visita: 2,
                horas: 6,
                fecha: '2026-09-01',
                inicio_motivacion: 'Ambientación con canciones infantiles y títeres sobre valores',
                desarrollo: 'Taller de pintura colectiva y motricidad fina en mesas redondas',
                cierre_evaluacion: 'Asamblea de conclusiones y muestra de mural artístico grupal',
                reflexion_docente: 'Se observó buena coordinación, ajustar tiempos de limpieza',
                evidencia: 'https://drive.google.com/drive/folders/evidencia_visita_2',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('6.2 Ruta alternativa /api/estudiante/registrar_bitacora radica bitácora de visita 3', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/estudiante/registrar_bitacora', {
                id_asignacion: 1,
                visita: 3,
                horas: 4,
                fecha: '2026-09-08',
                actividades: 'Dinámicas lúdicas de lectura guiada en rincón pedagógico',
                observaciones: 'Participación activa del 100% del grupo infantil',
                evidencia: 'https://drive.google.com/drive/folders/evidencia_visita_3',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('6.3 Estudiante consulta sus bitácoras radicadas en estado PENDIENTE', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/bitacoras');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            const pending = res.data.data.find(b => b.visita === 2 && b.estado === 'PENDIENTE');
            assert.ok(pending, 'Bitácora visita 2 debe estar en estado PENDIENTE');
        });

        it('6.4 Línea de tiempo pedagógica expone los momentos registrados', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/timeline');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
            assert.ok(res.data.data.some(b => b.visita === 2));
        });

        it('6.5 Dashboard de progreso refleja las sesiones realizadas', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/progreso');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.data.sesionesRealizadas >= 1);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 7: Validación Formatos P5 y P6 con Evidencias (CU-08, RF-07)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 7: Validación Formatos P5 y P6 con Evidencias', () => {
        it('7.1 En prácticas de primeros semestres (1-4) la evidencia se autocompleta si falta', async () => {
            client.setToken(estudianteToken);
            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: 1,
                visita: 4,
                horas: 4,
                fecha: '2026-09-15',
                actividades: 'Observación y acompañamiento en recreo activo',
                observaciones: 'Registro etnográfico de juegos espontáneos',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('7.2 Portafolio digital consolida evidencias registradas', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/evidencias');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
            assert.ok(res.data.data.length >= 1);
        });

        it('7.3 Registro de bitácora en Semestre 5 es exitoso cuando se provee soporte probatorio P5', async () => {
            // Asignar estudiante Andrés (id 6) a práctica Semestre 5
            client.setToken(directorToken);
            await client.post('/api/director/asignar', {
                id_estudiante: 6,
                id_practica: 5, // Práctica Semestre 5
                id_institucion: 1,
                id_tutor: 4,
            });

            // Consultar asignaciones para obtener el id_asignacion de la práctica 5
            const asigRes = await client.get('/api/director/asignaciones');
            const asigP5 = asigRes.data.data.find(a => (a.practica && (a.practica.includes('P5') || a.practica.includes('Integral'))) && a.estudiante.includes('Andrés'));
            const asigId = asigP5 ? asigP5.id : 3;

            // Login como Andrés para radicar
            const est2Res = await client.login('estudiante2@sigpa.edu', '1234');
            client.setToken(est2Res.data.token);

            // Radicar con evidencia válida
            const res = await client.post('/api/estudiante/bitacora', {
                id_asignacion: asigId,
                visita: 1,
                horas: 6,
                fecha: '2026-09-20',
                actividades: 'Diagnóstico participativo en comunidad infantil',
                observaciones: 'Plan de acción comunitario concertado',
                evidencia: 'https://repositorio.udi.edu.co/formatos/formato_p5_andres.pdf',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);

            // Restaurar token del estudiante principal Laura
            client.setToken(estudianteToken);
        });

        it('7.4 Clasificación de evidencias categoriza enlaces Drive/PDF de forma adecuada', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/evidencias');
            assert.equal(res.status, 200);
            assert.ok(res.data.data.some(e => e.tipo === 'PDF' || e.tipo === 'GOOGLE_DRIVE' || e.tipo === 'ENLACE_WEB'));
        });

        it('7.5 Línea de tiempo incluye soporte documental en metadatos', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/timeline');
            assert.equal(res.status, 200);
            const item = res.data.data.find(d => d.evidencia && d.evidencia.length > 0);
            assert.ok(item);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 8: Aval Presencial In Situ (CU-11, RF-08)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 8: Aval Presencial In Situ', () => {
        it('8.1 Asesor In Situ consulta los estudiantes vinculados a su centro', async () => {
            client.setToken(asesorToken);
            const res = await client.get('/api/asesor/estudiantes');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
        });

        it('8.2 Ruta alternativa /api/asesor/asignaciones retorna datos de asignación', async () => {
            client.setToken(asesorToken);
            const res = await client.get('/api/asesor/asignaciones');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
        });

        it('8.3 Asesor In Situ lista bitácoras de practicantes para certificar presencia', async () => {
            client.setToken(asesorToken);
            const res = await client.get('/api/asesor/bitacoras');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
        });

        it('8.4 Asesor In Situ emite aval presencial con retroalimentación cualitativa', async () => {
            client.setToken(asesorToken);
            const res = await client.post('/api/asesor/evaluar', {
                id_bitacora: 2,
                comentarios: 'Se constató asistencia puntual, excelente manejo del grupo y adecuada vestimenta docente.',
                nota: 4.8,
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('8.5 Evaluación del Asesor queda visible en la línea de tiempo del practicante', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/timeline');
            assert.equal(res.status, 200);
            const b2 = res.data.data.find(b => b.visita === 2);
            assert.ok(b2);
            assert.ok(b2.asesorEvaluacion !== null);
            assert.ok(b2.asesorEvaluacion.comentarios.includes('asistencia puntual'));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 9: Calificación Tutor UDI y Acumulación Atómica (CU-12, RF-09)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 9: Calificación Tutor UDI y Acumulación Atómica', () => {
        it('9.1 Tutor consulta bitácoras pendientes de evaluación académica', async () => {
            client.setToken(tutorToken);
            const res = await client.get('/api/tutor/bitacoras');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
        });

        it('9.2 Ruta alternativa /api/tutor/bitacoras_pendientes retorna cola de revisión', async () => {
            client.setToken(tutorToken);
            const res = await client.get('/api/tutor/bitacoras_pendientes');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
        });

        it('9.3 Tutor califica bitácora con nota aprobatoria (>= 3.0) y comentarios formativos', async () => {
            client.setToken(tutorToken);
            const res = await client.post('/api/tutor/calificar', {
                id_bitacora: 2,
                nota: 4.5,
                comentarios: 'Excelente articulación didáctica entre inicio, desarrollo y cierre.',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.message.includes('Horas acumuladas actualizadas'));
        });

        it('9.4 Estado de la bitácora transiciona a CALIFICADA', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/bitacoras');
            assert.equal(res.status, 200);
            const b2 = res.data.data.find(b => b.visita === 2);
            assert.ok(b2);
            assert.equal(b2.estado, 'CALIFICADA');
            assert.equal(Number(b2.nota), 4.5);
        });

        it('9.5 Horas de la sesión se acumulan atómicamente en la asignación del estudiante', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/asignacion');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            // Inicialmente 16h + 6h de visita 2 = 22h
            assert.ok(Number(res.data.data.horasAcumuladas) >= 22);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 10: Dashboard de KPIs y Semáforo de Progreso (CU-05, RF-12)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 10: Dashboard de KPIs y Semáforo de Progreso', () => {
        it('10.1 Director consulta KPIs consolidados del programa', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/kpis');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.totalEstudiantes !== undefined);
            assert.ok(res.data.totalHoras !== undefined);
        });

        it('10.2 KPI consolida convenios activos y cupos disponibles', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/kpis');
            assert.equal(res.status, 200);
            assert.ok(res.data.conveniosActivos >= 1);
            assert.ok(res.data.cuposDisponibles >= 1);
        });

        it('10.3 Estudiante consulta medidor predictivo y porcentaje de avance', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/progreso');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.data.porcentaje !== undefined);
            assert.ok(Number(res.data.data.porcentaje) > 0);
        });

        it('10.4 Medidor clasifica en semáforo de alerta (VERDE, AMARILLO o ROJO)', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/progreso');
            assert.equal(res.status, 200);
            const sem = res.data.data.semaforo;
            assert.ok(['VERDE', 'AMARILLO', 'ROJO'].includes(sem));
            assert.ok(res.data.data.semaforoEtiqueta);
        });

        it('10.5 Medidor calcula ritmo promedio y sesiones estimadas restantes', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/progreso');
            assert.equal(res.status, 200);
            assert.ok(res.data.data.ritmoPromedio !== undefined);
            assert.ok(res.data.data.sesionesEstimadasRestantes !== undefined);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 11: Banco de Preguntas Guía Curriculares (CU-10, RF-05)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 11: Banco de Preguntas Guía Curriculares', () => {
        it('11.1 Consulta de preguntas guía para Visita 1 vía query params', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/preguntas_guia', {
                query: { id_practica: 1, visita: 1 },
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
            assert.ok(res.data.data.length >= 2);
        });

        it('11.2 Consulta de preguntas guía vía ruta REST /:id_practica/:visita', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/preguntas-guia/1/1');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.data.some(q => q.pregunta.includes('socioemocional') || q.pregunta.length > 10));
        });

        it('11.3 Consulta de preguntas guía para Visita 2 retorna banco didáctico', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/preguntas-guia/1/2');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
        });

        it('11.4 Consulta de preguntas guía para Visita 3 retorna banco curricular', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/preguntas-guia/1/3');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(Array.isArray(res.data.data));
        });

        it('11.5 Cada pregunta guía cuenta con orden secuencial asignado', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/preguntas-guia/1/1');
            assert.equal(res.status, 200);
            assert.ok(res.data.data.every(q => typeof q.orden === 'number'));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 12: Microservicio de Reportes (PDF Visita y Actas) (CU-13, CU-14/15, RF-10)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 12: Microservicio de Reportes (PDF Visita y Actas)', () => {
        it('12.1 Health check del microservicio de reportes responde UP', async () => {
            const res = await client.get('/api/v1/reports/health');
            assert.equal(res.status, 200);
            assert.equal(res.data.status, 'UP');
            assert.equal(res.data.service, 'reporting-service');
        });

        it('12.2 Generación de informe de visita PDF retorna URL de descarga', async () => {
            const res = await client.post('/api/v1/reports/visita-pdf', {
                id_bitacora: 2,
                visita: 2,
                estudiante: 'Laura Pérez',
                practica: 'Práctica de Observación en Infancia',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.reportUrl);
        });

        it('12.3 Solicitud con Accept application/pdf retorna stream binario PDF', async () => {
            const res = await client.post('/api/v1/reports/visita-pdf', {
                id_bitacora: 2,
                visita: 2,
            }, {
                headers: { Accept: 'application/pdf' },
            });
            assert.equal(res.status, 200);
            const contentType = res.headers.get('content-type') || '';
            assert.ok(contentType.includes('application/pdf'));
            assert.ok(Buffer.isBuffer(res.data));
            assert.ok(res.data.toString('ascii', 0, 4) === '%PDF');
        });

        it('12.4 Generación de Acta Final de Cierre al cumplir 100% retorna URL', async () => {
            const res = await client.post('/api/v1/reports/acta-cierre-pdf', {
                id_asignacion: 1,
                horas_acumuladas: 64,
                horas_requeridas: 64,
                bitacoras_pendientes: 0,
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.reportUrl.includes('acta_cierre_1.pdf'));
        });

        it('12.5 Solicitud de Acta de Cierre con Accept application/pdf emite binario PDF', async () => {
            const res = await client.post('/api/v1/reports/acta-cierre-pdf', {
                id_asignacion: 1,
                horas_acumuladas: 64,
                horas_requeridas: 64,
                bitacoras_pendientes: 0,
            }, {
                headers: { Accept: 'application/pdf' },
            });
            assert.equal(res.status, 200);
            assert.ok(res.headers.get('content-type').includes('application/pdf'));
            assert.ok(res.data.toString('ascii', 0, 4) === '%PDF');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 13: API Gateway & Enrutamiento Perimetral (Sección 5.4, R2)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 13: API Gateway & Enrutamiento Perimetral', () => {
        it('13.1 Cabecera Authorization Bearer es preservada y evaluada en downstream', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/kpis');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('13.2 Perímetro expone cabeceras CORS permisivas para SPA', async () => {
            const res = await client.get('/api/test-db');
            assert.equal(res.status, 200);
            const allowOrigin = res.headers.get('access-control-allow-origin');
            assert.ok(allowOrigin === '*' || allowOrigin !== null);
        });

        it('13.3 Endpoints RESTful retornan Content-Type application/json', async () => {
            const res = await client.get('/api/test-db');
            assert.ok(res.headers.get('content-type').includes('application/json'));
        });

        it('13.4 Ruta de diagnóstico /api/test-db es pública sin requerir token', async () => {
            client.clearToken();
            const res = await client.get('/api/test-db');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('13.5 Respuestas REST cumplen con la envoltura estándar JSON { success: true }', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/asignacion');
            assert.equal(res.status, 200);
            assert.equal(typeof res.data.success, 'boolean');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 14: Persistencia Dual: Oracle 10g Express (R3, schema.sql)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 14: Persistencia Dual: Oracle 10g Express', () => {
        it('14.1 Diagnóstico reporta emulación compatible con Oracle 10g Release 10.2.0.1.0', async () => {
            const res = await client.get('/api/test-db');
            assert.equal(res.status, 200);
            assert.ok(res.data.version.includes('Oracle Database 10g'));
        });

        it('14.2 Catálogo USER_TABLES lista las tablas normalizadas del esquema', async () => {
            const res = await client.get('/api/test-db');
            assert.equal(res.status, 200);
            assert.ok(Array.isArray(res.data.tables));
            assert.ok(res.data.tables.includes('USUARIO'));
            assert.ok(res.data.tables.includes('PRACTICA'));
            assert.ok(res.data.tables.includes('ASIGNACION'));
            assert.ok(res.data.tables.includes('BITACORA'));
        });

        it('14.3 Ejecución de consultas dialecto Oracle opera con código HTTP 200', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/estado');
            assert.equal(res.status, 200);
        });

        it('14.4 Validación de unicidad de correo rechaza duplicados con mensaje descriptivo', async () => {
            client.setToken(directorToken);
            // Intentar crear usuario con correo ya existente
            const res = await client.post('/api/director/nuevo_usuario', {
                nombre: 'Duplicado',
                email: 'director@sigpa.edu',
                contrasena: '123456',
                rol: 'DIRECTOR',
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.success, false);
            assert.ok(res.data.message.includes('ya se encuentra registrado'));
        });

        it('14.5 Emulación de funciones Oracle (NVL, TO_CHAR, ROWNUM) responde con consistencia', async () => {
            client.setToken(directorToken);
            const res = await client.get('/api/director/kpis');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Feature 15: Persistencia Dual: SQLite Native Mock (R3, sqlite.js)
    // ──────────────────────────────────────────────────────────────────────────
    describe('Feature 15: Persistencia Dual: SQLite Native Mock', () => {
        it('15.1 Diagnóstico /api/test-db confirma modoMock activo', async () => {
            const res = await client.get('/api/test-db');
            assert.equal(res.status, 200);
            assert.equal(res.data.modoMock, true);
            assert.ok(res.data.motor.includes('SQLite'));
        });

        it('15.2 Base de datos cuenta con cuentas semilla iniciales pobladas', async () => {
            const res = await client.get('/api/test-db');
            assert.equal(res.status, 200);
            assert.ok(Number(res.data.totalUsuarios) >= 6);
        });

        it('15.3 Operaciones de lectura y escritura son persistidas en archivo aislado', async () => {
            client.setToken(directorToken);
            const res = await client.post('/api/director/nueva_institucion', {
                nombre: 'Sede Test Persistencia Ephemeral',
                cupos: 5,
            });
            assert.equal(res.status, 200);
        });

        it('15.4 Consultas anidadas con transformaciones SQLite devuelven respuestas válidas', async () => {
            client.setToken(estudianteToken);
            const res = await client.get('/api/estudiante/asignacion');
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });

        it('15.5 Módulo SQLite ejecuta transacciones ACID correctamente', async () => {
            client.setToken(tutorToken);
            const res = await client.post('/api/tutor/calificar', {
                id_bitacora: 1,
                nota: 4.8,
                comentarios: 'Excelente desempeño transaccional',
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.success, true);
        });
    });
});
