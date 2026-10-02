/**
 * SIGPA — EstudianteController (Oracle 10g)
 *
 * Endpoints:
 *   GET  /api/estudiante/asignacion
 *   GET  /api/estudiante/progreso
 *   GET  /api/estudiante/bitacoras
 *   GET  /api/estudiante/timeline
 *   GET  /api/estudiante/evidencias
 *   GET  /api/estudiante/evaluaciones
 *   GET  /api/estudiante/preguntas_guia
 *   GET  /api/estudiante/preguntas-guia/:id_practica/:visita
 *   POST /api/estudiante/bitacora
 *   POST /api/estudiante/registrar_bitacora
 */
'use strict';

const { executeQuery } = require('../config/database');
const { createError } = require('../middlewares/errorHandler');

/**
 * Extrae el ID del estudiante desde el query param o desde el JWT del usuario autenticado.
 * Roles supervisores (DIRECTOR, TUTOR, ASESOR) pueden consultar datos de cualquier estudiante
 * pasando ?id_estudiante=X. El estudiante solo puede consultar sus propios datos.
 */
function resolverIdEstudiante(req) {
    const fromQuery = req.query.id_estudiante;
    const fromJWT   = req.usuario && req.usuario.id;
    const rol       = req.usuario && req.usuario.rol ? String(req.usuario.rol).toUpperCase() : '';

    if (fromQuery) {
        // Roles supervisores pueden consultar cualquier estudiante
        if (['DIRECTOR', 'TUTOR', 'COORDINADOR', 'ASESOR'].includes(rol)) {
            return Number(fromQuery);
        }
        // El estudiante solo puede consultar sus propios datos
        if (Number(fromQuery) !== fromJWT) {
            throw createError(403, 'No tienes permiso para consultar datos de otro estudiante');
        }
        return Number(fromQuery);
    }

    if (fromJWT) return Number(fromJWT);

    throw createError(400, 'El parámetro id_estudiante es obligatorio');
}

/* ── GET /api/estudiante/asignacion ──────────────────────────────────── */
async function getAsignacion(req, res, next) {
    try {
        const idEstudiante = resolverIdEstudiante(req);

        const sql = `
            SELECT * FROM (
                SELECT a.ID_ASIGNACION, a.HORAS_ACUMULADAS, a.ESTADO_PRACTICA,
                       TO_CHAR(a.FECHA_ASIGNACION, 'YYYY-MM-DD') AS FECHA_ASIGNACION,
                       p.ID_PRACTICA, p.NOMBRE AS PRACTICA, p.SEMESTRE, p.TIPO, p.HORAS_REQUERIDAS,
                       i.NOMBRE AS INSTITUCION, i.DIRECCION,
                       t.NOMBRE || ' ' || NVL(t.APELLIDO, '') AS TUTOR
                FROM ASIGNACION a
                JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
                LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
                LEFT JOIN USUARIO t ON a.ID_TUTOR = t.ID_USUARIO
                WHERE a.ID_ESTUDIANTE = :idEstudiante
                ORDER BY a.ID_ASIGNACION DESC
            ) WHERE ROWNUM = 1
        `;

        const result = await executeQuery(sql, { idEstudiante });
        const row = result.rows && result.rows.length > 0 ? result.rows[0] : null;

        if (row) {
            res.json({
                success: true,
                data: {
                    idAsignacion: row.ID_ASIGNACION,
                    idPractica: row.ID_PRACTICA,
                    practica: row.PRACTICA,
                    semestre: row.SEMESTRE,
                    tipo: row.TIPO,
                    horasRequeridas: Number(row.HORAS_REQUERIDAS || 64),
                    horasAcumuladas: Number(row.HORAS_ACUMULADAS || 0),
                    estado: row.ESTADO_PRACTICA,
                    institucion: row.INSTITUCION || '',
                    direccionInstitucion: row.DIRECCION || '',
                    tutor: (row.TUTOR || '').trim(),
                    fechaAsignacion: row.FECHA_ASIGNACION || '',
                },
            });
        } else {
            res.json({
                success: false,
                message: 'No tienes prácticas asignadas actualmente',
            });
        }
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/estudiante/progreso (Medidor Predictivo / Semáforo) ────── */
async function getProgreso(req, res, next) {
    try {
        const idEstudiante = resolverIdEstudiante(req);

        // 1. Obtener Asignación
        const asigSql = `
            SELECT * FROM (
                SELECT a.ID_ASIGNACION, a.HORAS_ACUMULADAS, a.ESTADO_PRACTICA,
                       TO_CHAR(a.FECHA_ASIGNACION, 'YYYY-MM-DD') AS FECHA_ASIGNACION,
                       p.ID_PRACTICA, p.NOMBRE AS PRACTICA, p.SEMESTRE, p.HORAS_REQUERIDAS,
                       i.NOMBRE AS INSTITUCION,
                       t.NOMBRE || ' ' || NVL(t.APELLIDO, '') AS TUTOR
                FROM ASIGNACION a
                JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
                LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
                LEFT JOIN USUARIO t ON a.ID_TUTOR = t.ID_USUARIO
                WHERE a.ID_ESTUDIANTE = :idEstudiante
                ORDER BY a.ID_ASIGNACION DESC
            ) WHERE ROWNUM = 1
        `;
        const asigRes = await executeQuery(asigSql, { idEstudiante });
        const asig = asigRes.rows && asigRes.rows.length > 0 ? asigRes.rows[0] : null;

        if (!asig) {
            return res.json({
                success: false,
                message: 'No se encontró asignación de práctica activa para calcular el progreso',
            });
        }

        // 2. Obtener Bitácoras del estudiante
        const bitSql = `
            SELECT b.ID_BITACORA, b.NUMERO_VISITA,
                   TO_CHAR(b.FECHA_REGISTRO, 'YYYY-MM-DD') AS FECHA_REGISTRO,
                   b.HORAS_SESION, b.ESTADO_REVISION
            FROM BITACORA b
            WHERE b.ID_ASIGNACION = :idAsignacion
            ORDER BY b.FECHA_REGISTRO ASC, b.NUMERO_VISITA ASC
        `;
        const bitRes = await executeQuery(bitSql, { idAsignacion: asig.ID_ASIGNACION });
        const bitacoras = bitRes.rows || [];

        const horasRequeridas = Number(asig.HORAS_REQUERIDAS || 64);
        const horasAcumuladas = Number(asig.HORAS_ACUMULADAS || 0);
        const horasRestantes  = Math.max(0, horasRequeridas - horasAcumuladas);
        const pctCumplimiento = horasRequeridas > 0 ? Math.min(100, Math.round((horasAcumuladas / horasRequeridas) * 100)) : 0;

        const totalSesiones = bitacoras.length;
        const totalHorasEnBitacoras = bitacoras.reduce((sum, b) => sum + Number(b.HORAS_SESION || 0), 0);
        const ritmoPromedio = totalSesiones > 0 ? Math.round((totalHorasEnBitacoras / totalSesiones) * 10) / 10 : 16;
        const sesionesRestantes = horasRestantes > 0 ? Math.ceil(horasRestantes / (ritmoPromedio || 16)) : 0;

        // Proyección temporal de fecha de culminación
        let fechaBase = new Date();
        if (bitacoras.length > 0) {
            const ultimaBit = bitacoras[bitacoras.length - 1];
            if (ultimaBit.FECHA_REGISTRO) {
                const parsed = new Date(ultimaBit.FECHA_REGISTRO);
                if (!isNaN(parsed.getTime())) fechaBase = parsed;
            }
        }

        const diasEstimadosRestantes = sesionesRestantes * 7; // 1 sesión por semana
        const fechaProyectada = new Date(fechaBase.getTime() + diasEstimadosRestantes * 24 * 60 * 60 * 1000);
        const fechaEstimadaCulminacion = fechaProyectada.toISOString().split('T')[0];

        // Lógica Semafórica Pedagógica
        let semaforo = 'VERDE';
        let semaforoEtiqueta = 'En Ritmo Óptimo';
        let semaforoColor = '#10b981';
        let semaforoMensaje = '¡Excelente ritmo! Estás cumpliendo tus horas pedagógicas dentro del cronograma previsto.';
        let recomendacion = 'Continúa registrando tus bitácoras oportunamente con sus respectivas evidencias didácticas.';

        if (pctCumplimiento < 30) {
            semaforo = 'ROJO';
            semaforoEtiqueta = 'Riesgo Crítico';
            semaforoColor = '#ef4444';
            semaforoMensaje = 'Atención requerida: Tu avance acumulado es menor al 30% de la meta pedagógica.';
            recomendacion = 'Coordina de inmediato con tu tutor académico y programa sesiones intensivas en tu institución.';
        } else if (pctCumplimiento < 65 || ritmoPromedio < 12) {
            semaforo = 'AMARILLO';
            semaforoEtiqueta = 'Ritmo Bajo';
            semaforoColor = '#f59e0b';
            semaforoMensaje = 'Ritmo moderado: Requiere incrementar la frecuencia o duración de las sesiones en aula.';
            recomendacion = 'Se aconseja programar al menos 1 visita adicional semanal para culminar el periodo sin contratiempos.';
        }

        res.json({
            success: true,
            data: {
                idAsignacion: asig.ID_ASIGNACION,
                idPractica: asig.ID_PRACTICA,
                practica: asig.PRACTICA,
                semestre: asig.SEMESTRE,
                institucion: asig.INSTITUCION || '',
                tutor: (asig.TUTOR || '').trim(),
                horasAcumuladas,
                horasRequeridas,
                horasRestantes,
                porcentaje: pctCumplimiento,
                semaforo,
                semaforoEtiqueta,
                semaforoColor,
                semaforoMensaje,
                recomendacion,
                ritmoPromedio,
                sesionesRealizadas: totalSesiones,
                sesionesEstimadasRestantes: sesionesRestantes,
                fechaUltimaSesion: bitacoras.length > 0 ? (bitacoras[bitacoras.length - 1].FECHA_REGISTRO || '') : asig.FECHA_ASIGNACION || '',
                fechaEstimadaCulminacion,
                diasEstimadosRestantes,
            }
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/estudiante/bitacoras ───────────────────────────────────── */
async function getBitacoras(req, res, next) {
    try {
        const idEstudiante = resolverIdEstudiante(req);

        const sql = `
            SELECT b.ID_BITACORA, b.NUMERO_VISITA,
                   TO_CHAR(b.FECHA_REGISTRO, 'YYYY-MM-DD') AS FECHA_REGISTRO,
                   b.HORAS_SESION, b.ACTIVIDADES, b.OBSERVACIONES, b.URL_EVIDENCIA, b.ESTADO_REVISION,
                   e.NOTA, e.COMENTARIOS AS COMENTARIO_EVALUACION
            FROM BITACORA b
            JOIN ASIGNACION a ON b.ID_ASIGNACION = a.ID_ASIGNACION
            LEFT JOIN EVALUACION e ON b.ID_BITACORA = e.ID_BITACORA
            WHERE a.ID_ESTUDIANTE = :idEstudiante
            ORDER BY b.NUMERO_VISITA DESC
        `;

        const result = await executeQuery(sql, { idEstudiante });

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.ID_BITACORA,
                visita: r.NUMERO_VISITA,
                fecha: r.FECHA_REGISTRO || '',
                horas: Number(r.HORAS_SESION || 0),
                actividades: r.ACTIVIDADES || '',
                observaciones: r.OBSERVACIONES || '',
                evidencia: r.URL_EVIDENCIA || '',
                estado: r.ESTADO_REVISION,
                nota: r.NOTA != null ? Number(r.NOTA) : null,
                comentariosEvaluacion: r.COMENTARIO_EVALUACION || '',
            })),
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/estudiante/timeline (Línea de Tiempo de Evolución) ─────── */
async function getTimeline(req, res, next) {
    try {
        const idEstudiante = resolverIdEstudiante(req);

        const sql = `
            SELECT b.ID_BITACORA, b.NUMERO_VISITA,
                   TO_CHAR(b.FECHA_REGISTRO, 'YYYY-MM-DD') AS FECHA_REGISTRO,
                   b.HORAS_SESION, b.ACTIVIDADES, b.OBSERVACIONES, b.URL_EVIDENCIA, b.ESTADO_REVISION,
                   p.NOMBRE AS PRACTICA, p.SEMESTRE, i.NOMBRE AS INSTITUCION
            FROM BITACORA b
            JOIN ASIGNACION a ON b.ID_ASIGNACION = a.ID_ASIGNACION
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            WHERE a.ID_ESTUDIANTE = :idEstudiante
            ORDER BY b.NUMERO_VISITA ASC
        `;

        const bitResult = await executeQuery(sql, { idEstudiante });
        const bitacoras = bitResult.rows || [];

        // Obtener todas las evaluaciones para estas bitácoras
        const evalSql = `
            SELECT e.ID_EVALUACION, e.ID_BITACORA, e.TIPO_EVALUADOR, e.NOTA, e.COMENTARIOS,
                   TO_CHAR(e.FECHA_EVALUACION, 'YYYY-MM-DD HH24:MI:SS') AS FECHA_EVALUACION,
                   u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS EVALUADOR
            FROM EVALUACION e
            JOIN BITACORA b ON e.ID_BITACORA = b.ID_BITACORA
            JOIN ASIGNACION a ON b.ID_ASIGNACION = a.ID_ASIGNACION
            JOIN USUARIO u ON e.ID_EVALUADOR = u.ID_USUARIO
            WHERE a.ID_ESTUDIANTE = :idEstudiante
            ORDER BY e.ID_EVALUACION ASC
        `;
        const evalResult = await executeQuery(evalSql, { idEstudiante });
        const evaluaciones = evalResult.rows || [];

        const timeline = bitacoras.map(b => {
            const evals = evaluaciones.filter(e => e.ID_BITACORA === b.ID_BITACORA);
            const evalTutor = evals.find(e => e.TIPO_EVALUADOR === 'TUTOR') || null;
            const evalAsesor = evals.find(e => e.TIPO_EVALUADOR === 'ASESOR') || null;

            return {
                idBitacora: b.ID_BITACORA,
                visita: b.NUMERO_VISITA,
                fecha: b.FECHA_REGISTRO || '',
                horas: Number(b.HORAS_SESION || 0),
                actividades: typeof b.ACTIVIDADES === 'object' && b.ACTIVIDADES !== null ? JSON.stringify(b.ACTIVIDADES) : (b.ACTIVIDADES || ''),
                observaciones: typeof b.OBSERVACIONES === 'object' && b.OBSERVACIONES !== null ? JSON.stringify(b.OBSERVACIONES) : (b.OBSERVACIONES || ''),
                evidencia: b.URL_EVIDENCIA || '',
                estado: b.ESTADO_REVISION,
                practica: b.PRACTICA,
                semestre: b.SEMESTRE,
                institucion: b.INSTITUCION || '',
                tutorEvaluacion: evalTutor ? {
                    evaluador: (evalTutor.EVALUADOR || '').trim(),
                    nota: evalTutor.NOTA != null ? Number(evalTutor.NOTA) : null,
                    comentarios: evalTutor.COMENTARIOS || '',
                    fecha: evalTutor.FECHA_EVALUACION || '',
                } : null,
                asesorEvaluacion: evalAsesor ? {
                    evaluador: (evalAsesor.EVALUADOR || '').trim(),
                    nota: evalAsesor.NOTA != null ? Number(evalAsesor.NOTA) : null,
                    comentarios: evalAsesor.COMENTARIOS || '',
                    fecha: evalAsesor.FECHA_EVALUACION || '',
                } : null,
            };
        });

        res.json({
            success: true,
            data: timeline,
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/estudiante/evidencias (Portafolio Digital de Evidencias) ── */
async function getEvidencias(req, res, next) {
    try {
        const idEstudiante = resolverIdEstudiante(req);

        const sql = `
            SELECT b.ID_BITACORA, b.NUMERO_VISITA,
                   TO_CHAR(b.FECHA_REGISTRO, 'YYYY-MM-DD') AS FECHA_REGISTRO,
                   b.HORAS_SESION, b.URL_EVIDENCIA, b.ESTADO_REVISION,
                   p.NOMBRE AS PRACTICA, i.NOMBRE AS INSTITUCION,
                   e.NOTA, e.COMENTARIOS
            FROM BITACORA b
            JOIN ASIGNACION a ON b.ID_ASIGNACION = a.ID_ASIGNACION
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            LEFT JOIN EVALUACION e ON b.ID_BITACORA = e.ID_BITACORA AND e.TIPO_EVALUADOR = 'TUTOR'
            WHERE a.ID_ESTUDIANTE = :idEstudiante AND b.URL_EVIDENCIA IS NOT NULL
            ORDER BY b.NUMERO_VISITA DESC
        `;

        const result = await executeQuery(sql, { idEstudiante });

        const items = (result.rows || []).map(r => {
            const url = r.URL_EVIDENCIA || '';
            let tipo = 'PDF';
            let icono = '📄';

            if (url.toLowerCase().includes('drive.google.com') || url.toLowerCase().includes('docs.google.com')) {
                tipo = 'GOOGLE_DRIVE';
                icono = '📁';
            } else if (url.toLowerCase().includes('onedrive') || url.toLowerCase().includes('sharepoint.com')) {
                tipo = 'ONEDRIVE';
                icono = '☁️';
            } else if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                tipo = 'IMAGEN';
                icono = '🖼️';
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
                tipo = 'ENLACE_WEB';
                icono = '🔗';
            }

            return {
                idBitacora: r.ID_BITACORA,
                visita: r.NUMERO_VISITA,
                fecha: r.FECHA_REGISTRO || '',
                horas: Number(r.HORAS_SESION || 0),
                urlEvidencia: url,
                tipo,
                icono,
                estado: r.ESTADO_REVISION,
                practica: r.PRACTICA,
                institucion: r.INSTITUCION || '',
                nota: r.NOTA != null ? Number(r.NOTA) : null,
                comentarios: r.COMENTARIOS || '',
            };
        });

        res.json({
            success: true,
            data: items,
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/estudiante/evaluaciones ────────────────────────────────── */
async function getEvaluaciones(req, res, next) {
    try {
        const idEstudiante = resolverIdEstudiante(req);

        const sql = `
            SELECT e.ID_EVALUACION, e.TIPO_EVALUADOR, e.NOTA, e.COMENTARIOS,
                   TO_CHAR(e.FECHA_EVALUACION, 'YYYY-MM-DD HH24:MI:SS') AS FECHA_EVALUACION,
                   b.NUMERO_VISITA, p.NOMBRE AS PRACTICA,
                   u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS EVALUADOR
            FROM EVALUACION e
            JOIN BITACORA b ON e.ID_BITACORA = b.ID_BITACORA
            JOIN ASIGNACION a ON b.ID_ASIGNACION = a.ID_ASIGNACION
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            JOIN USUARIO u ON e.ID_EVALUADOR = u.ID_USUARIO
            WHERE a.ID_ESTUDIANTE = :idEstudiante
            ORDER BY e.ID_EVALUACION DESC
        `;

        const result = await executeQuery(sql, { idEstudiante });

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.ID_EVALUACION,
                visita: r.NUMERO_VISITA,
                practica: r.PRACTICA,
                tipoEvaluador: r.TIPO_EVALUADOR,
                evaluador: (r.EVALUADOR || '').trim(),
                nota: r.NOTA != null ? Number(r.NOTA) : null,
                comentarios: r.COMENTARIOS || '',
                fecha: r.FECHA_EVALUACION || '',
            })),
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/estudiante/preguntas_guia & /preguntas-guia/:id_practica/:visita ── */
async function getPreguntasGuia(req, res, next) {
    try {
        const rawPractica = req.params.id_practica || req.query.id_practica;
        const rawVisita   = req.params.visita || req.query.visita;
        if (!rawPractica) throw createError(400, 'El parámetro id_practica es obligatorio');
        if (!rawVisita)   throw createError(400, 'El parámetro visita es obligatorio');
        const idPractica = Number(rawPractica);
        const visita = Number(rawVisita);

        const sql = `
            SELECT ID_PREGUNTA, TEXTO_PREGUNTA, ORDEN
            FROM PREGUNTA
            WHERE ID_PRACTICA = :idPractica AND NUMERO_VISITA = :visita
            ORDER BY ORDEN ASC
        `;

        let rows = [];
        try {
            const result = await executeQuery(sql, { idPractica, visita });
            rows = result.rows || [];
        } catch (e) {
            try {
                // Compatibilidad con tabla PREGUNTA_GUIA
                const result = await executeQuery(`
                    SELECT ID_PREGUNTA, TEXTO_PREGUNTA, ORDEN
                    FROM PREGUNTA_GUIA
                    WHERE ID_PRACTICA = :idPractica AND NUMERO_VISITA = :visita
                    ORDER BY ORDEN ASC
                `, { idPractica, visita });
                rows = result.rows || [];
            } catch (err2) {
                rows = [];
            }
        }

        // Si no existen preguntas en BD para esa visita, proveer banco de preguntas pedagógicas UDI
        if (rows.length === 0) {
            const defaultPreguntas = {
                1: [
                    '¿Cómo caracterizas el contexto del aula y la disposición inicial de los niños frente a la propuesta didáctica?',
                    '¿Qué estrategias de motivación y saberes previos generaron mayor enganche y participación?',
                    '¿Qué acuerdos pedagógicos de convivencia facilitaron el desarrollo armónico de la jornada?'
                ],
                2: [
                    '¿De qué manera los materiales didácticos y recursos utilizados potenciaron el aprendizaje significativo?',
                    '¿Qué retos o imprevistos metodológicos surgieron en el aula y cómo los resolviste didácticamente?',
                    '¿Cómo promoviste la inclusión y la participación activa de los estudiantes con ritmos diversos?'
                ],
                3: [
                    '¿Qué evidencias concretas de aprendizaje formativo demostraron los niños al cierre de la sesión?',
                    '¿Cuáles fueron tus mayores aciertos pedagógicos y qué reflexiones críticas orientan tu próxima planeación?',
                    '¿De qué forma integraste las recomendaciones pedagógicas emitidas por tu tutor y asesor in situ?'
                ]
            };

            const list = defaultPreguntas[visita] || [
                '¿Cómo evaluaste el logro de los objetivos pedagógicos propuestos para esta sesión?',
                '¿Qué adaptaciones curriculares o didácticas resultaron indispensables durante el trabajo en aula?',
                '¿Qué aprendizajes sobre tu identidad como docente practicante te deja esta experiencia pedagógica?'
            ];

            rows = list.map((txt, idx) => ({
                ID_PREGUNTA: idx + 1,
                TEXTO_PREGUNTA: txt,
                ORDEN: idx + 1,
            }));
        }

        res.json({
            success: true,
            data: rows.map(r => ({
                id: r.ID_PREGUNTA,
                pregunta: r.TEXTO_PREGUNTA,
                orden: r.ORDEN,
            })),
        });
    } catch (err) {
        next(err);
    }
}

/* ── POST /api/estudiante/bitacora (Asistente Guiado de Planeación) ─── */
async function registrarBitacora(req, res, next) {
    try {
        const {
            id_asignacion,
            visita,
            horas,
            fecha,
            actividades,
            observaciones,
            evidencia,
            // Campos enriquecidos del Asistente Guiado Pedagógico
            inicio_motivacion,
            desarrollo,
            cierre_evaluacion,
            reflexion_docente,
        } = req.body;

        if (!id_asignacion || !visita || !horas) {
            throw createError(400, 'Faltan campos obligatorios en el registro de la bitácora (asignación, visita u horas)');
        }

        const idAsignacion = Number(id_asignacion);
        const numVisita = Number(visita);
        const numHoras = Number(horas);

        // Validación de horas: máximo 8 horas por jornada pedagógica
        if (isNaN(numHoras) || numHoras <= 0 || numHoras > 8) {
            throw createError(400, 'Las horas de práctica en una sola jornada deben estar entre 1 y 8 horas');
        }

        // Validación de fecha: no permitir fechas futuras
        if (fecha && String(fecha).trim()) {
            const fechaStr = String(fecha).trim().substring(0, 10);
            const fechaSesion = new Date(fechaStr + 'T00:00:00');
            if (isNaN(fechaSesion.getTime())) {
                throw createError(400, 'Formato de fecha inválido. Utilice el formato YYYY-MM-DD');
            }
            const hoy = new Date();
            hoy.setHours(23, 59, 59, 999);
            if (fechaSesion > hoy) {
                throw createError(400, 'La fecha de la sesión no puede ser una fecha futura');
            }
        }

        // Construir contenido estructurado de actividades pedagógicas si vienen desglosadas
        let textoActividades = actividades || '';
        if (inicio_motivacion || desarrollo || cierre_evaluacion) {
            const partes = [];
            if (inicio_motivacion && inicio_motivacion.trim()) {
                partes.push(`[FASE 1 - INICIO / MOTIVACIÓN]:\n${inicio_motivacion.trim()}`);
            }
            if (desarrollo && desarrollo.trim()) {
                partes.push(`[FASE 2 - DESARROLLO EN AULA]:\n${desarrollo.trim()}`);
            }
            if (cierre_evaluacion && cierre_evaluacion.trim()) {
                partes.push(`[FASE 3 - CIERRE Y EVALUACIÓN FORMATIVA]:\n${cierre_evaluacion.trim()}`);
            }
            textoActividades = partes.join('\n\n');
        }

        if (!textoActividades.trim()) {
            throw createError(400, 'Debes diligenciar las actividades o momentos pedagógicos de la sesión');
        }

        // Construir contenido estructurado de observaciones / reflexiones docentes
        let textoObservaciones = observaciones || '';
        if (reflexion_docente && reflexion_docente.trim()) {
            textoObservaciones = `[REFLEXIÓN PEDAGÓGICA DOCENTE]:\n${reflexion_docente.trim()}` +
                (observaciones && observaciones.trim() ? `\n\n[OBSERVACIONES ADICIONALES]:\n${observaciones.trim()}` : '');
        }

        // Validación normativa para Semestres 5 y 6
        const checkSql = `
            SELECT p.SEMESTRE, p.TIPO
            FROM ASIGNACION a
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            WHERE a.ID_ASIGNACION = :idAsignacion
        `;
        const asigRes = await executeQuery(checkSql, { idAsignacion });
        const asigRow = asigRes.rows && asigRes.rows.length > 0 ? asigRes.rows[0] : null;

        if (asigRow) {
            const sem = asigRow.SEMESTRE;
            if ((sem === 5 || sem === 6) && (!evidencia || !String(evidencia).trim())) {
                throw createError(400, 'Requisito normativo: Las prácticas 5 y 6 exigen adjuntar soporte de evidencia en formato PDF o enlace de portafolio (Formatos P5/P6)');
            }
        }

        const bindParams = {
            idAsignacion,
            numVisita,
            numHoras,
            actividades: textoActividades,
            observaciones: textoObservaciones,
            evidencia: evidencia && String(evidencia).trim() ? String(evidencia).trim() : `evidencia_visita_${numVisita}.pdf`,
        };

        let insertSql;
        if (fecha && String(fecha).trim()) {
            insertSql = `
                INSERT INTO BITACORA (ID_BITACORA, ID_ASIGNACION, NUMERO_VISITA, FECHA_REGISTRO, HORAS_SESION, ACTIVIDADES, OBSERVACIONES, URL_EVIDENCIA, ESTADO_REVISION)
                VALUES ((SELECT NVL(MAX(ID_BITACORA), 0) + 1 FROM BITACORA), :idAsignacion, :numVisita, TO_DATE(:fechaStr, 'YYYY-MM-DD'), :numHoras, :actividades, :observaciones, :evidencia, 'PENDIENTE')
            `;
            bindParams.fechaStr = String(fecha).trim().substring(0, 10);
        } else {
            insertSql = `
                INSERT INTO BITACORA (ID_BITACORA, ID_ASIGNACION, NUMERO_VISITA, FECHA_REGISTRO, HORAS_SESION, ACTIVIDADES, OBSERVACIONES, URL_EVIDENCIA, ESTADO_REVISION)
                VALUES ((SELECT NVL(MAX(ID_BITACORA), 0) + 1 FROM BITACORA), :idAsignacion, :numVisita, SYSDATE, :numHoras, :actividades, :observaciones, :evidencia, 'PENDIENTE')
            `;
        }

        await executeQuery(insertSql, bindParams);

        res.json({
            success: true,
            message: 'Bitácora y diario de campo pedagógico registrados con éxito y enviados a revisión del tutor',
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getAsignacion,
    getProgreso,
    getBitacoras,
    getTimeline,
    getEvidencias,
    getEvaluaciones,
    getPreguntasGuia,
    registrarBitacora,
};

