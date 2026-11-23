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

const path = require('path');
const fs = require('fs');
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
        const horasPendientes = bitacoras
            .filter(b => b.ESTADO_REVISION === 'PENDIENTE')
            .reduce((sum, b) => sum + Number(b.HORAS_SESION || 0), 0);
        const horasAprobadas = bitacoras
            .filter(b => b.ESTADO_REVISION === 'CALIFICADA' || b.ESTADO_REVISION === 'APROBADA')
            .reduce((sum, b) => sum + Number(b.HORAS_SESION || 0), 0);

        const horasValidadas = Math.max(horasAcumuladas, horasAprobadas);
        const horasFaltantes = Math.max(0, horasRequeridas - horasValidadas);
        const pctReal = horasRequeridas > 0 ? Math.min(100, Math.round((horasValidadas / horasRequeridas) * 100)) : 0;

        const semaforo = pctReal >= 75 ? 'VERDE' : (pctReal >= 40 ? 'AMARILLO' : 'ROJO');
        const hoyDate = new Date();
        const estimacionDias = horasFaltantes > 0 ? Math.ceil((horasFaltantes / 16) * 7) : 0;
        const fechaEstimada = new Date(hoyDate.getTime() + estimacionDias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        res.json({
            success: true,
            data: {
                idAsignacion: asig.ID_ASIGNACION,
                idPractica: asig.ID_PRACTICA,
                practica: asig.PRACTICA,
                semestre: asig.SEMESTRE,
                institucion: asig.INSTITUCION || '',
                tutor: (asig.TUTOR || '').trim(),
                horasAcumuladas: horasValidadas,
                horasAprobadas: horasValidadas,
                horasPendientes,
                horasRequeridas,
                horasRestantes: horasFaltantes,
                porcentaje: pctReal,
                semaforo,
                fechaEstimadaCulminacion: fechaEstimada,
                sesionesRealizadas: totalSesiones,
                totalBitacoras: totalSesiones,
                fechaUltimaSesion: bitacoras.length > 0 ? (bitacoras[bitacoras.length - 1].FECHA_REGISTRO || '') : asig.FECHA_ASIGNACION || '',
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
            ORDER BY b.NUMERO_VISITA ASC
        `;

        const result = await executeQuery(sql, { idEstudiante });

        res.json({
            success: true,
            data: result.rows.map(r => {
                let planClase = '';
                let evidencia = r.URL_EVIDENCIA || '';
                if (evidencia && evidencia.includes('|')) {
                    const parts = evidencia.split('|');
                    planClase = parts[0] || '';
                    evidencia = parts[1] || '';
                }
                const actStr = r.ACTIVIDADES || '';
                const mPlan = actStr.match(/\[PLAN DE CLASE\]:\s*([^\n]+)/);
                if (mPlan && !planClase) {
                    planClase = mPlan[1].trim();
                }

                return {
                    id: r.ID_BITACORA,
                    sesion: r.NUMERO_VISITA,
                    visita: r.NUMERO_VISITA,
                    fecha: r.FECHA_REGISTRO || '',
                    horas: Number(r.HORAS_SESION || 0),
                    actividades: r.ACTIVIDADES || '',
                    observaciones: r.OBSERVACIONES || '',
                    planClase,
                    evidencia,
                    estado: r.ESTADO_REVISION,
                    nota: r.NOTA != null ? Number(r.NOTA) : null,
                    comentariosEvaluacion: r.COMENTARIO_EVALUACION || '',
                };
            }),
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
            ORDER BY b.NUMERO_VISITA ASC
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
        // Soporte dual: fase pedagógica o sesion/visita
        const rawFase = req.params.fase || req.query.fase;
        const rawVisita = req.params.visita || req.query.visita || req.query.sesion;

        if (!rawPractica) throw createError(400, 'El parámetro id_practica es obligatorio');
        
        const idPractica = Number(rawPractica);
        let numFase = rawFase ? Number(rawFase) : (rawVisita ? Number(rawVisita) : 1);
        // Si el número de sesión es mayor que 4, mapear cíclicamente o por etapa a las 4 fases pedagógicas
        if (numFase > 4) {
            numFase = ((numFase - 1) % 4) + 1;
        }

        const sql = `
            SELECT ID_PREGUNTA, TEXTO_PREGUNTA, CATEGORIA, ORDEN
            FROM PREGUNTA_GUIA
            WHERE ID_PRACTICA = :idPractica AND NUMERO_VISITA = :numFase
            ORDER BY ORDEN ASC
        `;

        let rows = [];
        try {
            const result = await executeQuery(sql, { idPractica, numFase });
            rows = result.rows || [];
        } catch (e) {
            rows = [];
        }

        // Si no existen preguntas en BD para esa fase, proveer banco de preguntas pedagógicas UDI
        if (rows.length === 0) {
            const bancoFases = {
                1: {
                    faseNombre: 'Fase I: Contexto y Diagnóstico Institucional',
                    preguntas: [
                        { txt: '¿Cómo caracterizas el contexto del aula y la disposición socioemocional de los niños frente a la propuesta didáctica?', cat: 'CONTEXTO' },
                        { txt: '¿Qué estrategias de motivación e indagación de saberes previos generaron mayor participación activa?', cat: 'DIDACTICA' },
                        { txt: '¿Qué acuerdos pedagógicos de convivencia facilitaron el desarrollo armónico de la jornada?', cat: 'CONVIVENCIA' }
                    ]
                },
                2: {
                    faseNombre: 'Fase II: Planificación y Mediación Didáctica',
                    preguntas: [
                        { txt: '¿De qué manera los materiales didácticos y recursos lúdicos potenciaron el aprendizaje significativo?', cat: 'RECURSOS' },
                        { txt: '¿Cómo se articularon las actividades motrices y de expresión con el plan curricular del grado?', cat: 'CURRICULO' },
                        { txt: '¿De qué manera se retroalimentó el trabajo cooperativo y la participación de los niños?', cat: 'EVALUACION' }
                    ]
                },
                3: {
                    faseNombre: 'Fase III: Intervención en Aula e Inclusión',
                    preguntas: [
                        { txt: '¿Cómo se articularon los tres momentos pedagógicos (inicio, desarrollo y cierre) con el objetivo formativo?', cat: 'PLANEACION' },
                        { txt: '¿Qué adaptaciones o mediaciones se implementaron para atender la diversidad y ritmos de aprendizaje?', cat: 'INCLUSION' },
                        { txt: '¿Qué retos imprevistos surgieron en el aula y cómo los resolviste metodológicamente?', cat: 'MEDIACION' }
                    ]
                },
                4: {
                    faseNombre: 'Fase IV: Sistematización, Cierre y Evaluación Formativa',
                    preguntas: [
                        { txt: '¿Qué impacto formativo y transformador tuvo la intervención pedagógica en el grupo de infantes?', cat: 'IMPACTO' },
                        { txt: '¿Cuáles son las reflexiones docentes y oportunidades de mejora para la futura labor profesional?', cat: 'SISTEMATIZACION' },
                        { txt: '¿De qué forma integraste las recomendaciones pedagógicas emitidas por tu tutor y asesor in situ?', cat: 'RETROALIMENTACION' }
                    ]
                }
            };

            const faseObj = bancoFases[numFase] || bancoFases[1];
            rows = faseObj.preguntas.map((p, idx) => ({
                ID_PREGUNTA: idx + 1,
                TEXTO_PREGUNTA: p.txt,
                CATEGORIA: p.cat,
                ORDEN: idx + 1,
            }));
        }

        const nombresFase = {
            1: 'Fase I: Contexto y Diagnóstico Institucional',
            2: 'Fase II: Planificación y Mediación Didáctica',
            3: 'Fase III: Intervención en Aula e Inclusión',
            4: 'Fase IV: Sistematización y Evaluación Formativa'
        };

        res.json({
            success: true,
            fase: numFase,
            faseNombre: nombresFase[numFase] || `Fase Pedagógica ${numFase}`,
            data: rows.map(r => ({
                id: r.ID_PREGUNTA,
                pregunta: r.TEXTO_PREGUNTA,
                categoria: r.CATEGORIA || 'PEDAGOGICA',
                orden: r.ORDEN,
            })),
        });
    } catch (err) {
        next(err);
    }
}

/* ── POST /api/estudiante/bitacora (Registro de Bitácora y Momentos) ─── */
async function registrarBitacora(req, res, next) {
    try {
        const {
            id_asignacion,
            visita,
            sesion,
            horas,
            fecha,
            actividades,
            observaciones,
            evidencia,
            plan_clase,
            acompanamiento_tutor,
            // Momentos Pedagógicos
            inicio_motivacion,
            desarrollo,
            cierre_evaluacion,
            reflexion_docente,
        } = req.body;

        const numSesion = Number(sesion || visita);
        if (!id_asignacion || !numSesion || !horas) {
            throw createError(400, 'Faltan campos obligatorios en el registro de la bitácora (asignación, sesión u horas)');
        }

        const idAsignacion = Number(id_asignacion);
        const numVisita = numSesion;
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
        if (inicio_motivacion || desarrollo || cierre_evaluacion || plan_clase) {
            const partes = [];
            if (plan_clase && String(plan_clase).trim()) {
                partes.push(`[PLAN DE CLASE]: ${String(plan_clase).trim()}`);
            }
            if (acompanamiento_tutor && String(acompanamiento_tutor).trim() && acompanamiento_tutor !== 'NO' && acompanamiento_tutor !== '0') {
                partes.push(`[ACOMPAÑAMIENTO DEL TUTOR]: ${String(acompanamiento_tutor).trim()}`);
            }
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
            textoObservaciones = `[REFLEXIÓN PEDAGÓGICA]:\n${reflexion_docente.trim()}` +
                (observaciones && observaciones.trim() ? `\n\n[OBSERVACIONES ADICIONALES]:\n${observaciones.trim()}` : '');
        }

        // Determinar URL_EVIDENCIA combinando plan de clase y evidencia si ambos existen
        let urlEvidencia = evidencia && String(evidencia).trim() ? String(evidencia).trim() : '';
        let urlPlan = plan_clase && String(plan_clase).trim() ? String(plan_clase).trim() : '';
        let urlFinal = '';

        if (urlPlan && urlEvidencia && urlPlan !== urlEvidencia) {
            urlFinal = `${urlPlan}|${urlEvidencia}`;
        } else if (urlEvidencia) {
            urlFinal = urlEvidencia;
        } else if (urlPlan) {
            urlFinal = urlPlan;
        } else {
            urlFinal = `sesion_${numSesion}_evidencia.pdf`;
        }

        const bindParams = {
            idAsignacion,
            numVisita,
            numHoras,
            actividades: textoActividades,
            observaciones: textoObservaciones,
            evidencia: urlFinal,
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
            message: 'Bitácora registrada con éxito y enviada a revisión del tutor',
        });
    } catch (err) {
        next(err);
    }
}

/* ── POST /api/estudiante/subir-evidencia ────────────────────────────── */
async function subirEvidencia(req, res, next) {
    try {
        const { filename, contenido_base64, filedata, id_bitacora } = req.body || {};
        const baseName = filename ? path.basename(filename) : `evidencia_${Date.now()}.pdf`;
        const cleanName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const targetDir = path.resolve(__dirname, '../../uploads/evidencias');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const targetPath = path.join(targetDir, cleanName);

        const dataPayload = contenido_base64 || filedata;
        if (dataPayload) {
            const rawData = dataPayload.includes(',') ? dataPayload.split(',')[1] : dataPayload;
            fs.writeFileSync(targetPath, Buffer.from(rawData, 'base64'));
        } else if (!fs.existsSync(targetPath)) {
            const minimalPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF';
            fs.writeFileSync(targetPath, minimalPdf, 'utf8');
        }

        const publicUrl = `/uploads/evidencias/${cleanName}`;

        if (id_bitacora) {
            try {
                await executeQuery(`UPDATE BITACORA SET URL_EVIDENCIA = :url WHERE ID_BITACORA = :id`, {
                    url: publicUrl,
                    id: Number(id_bitacora)
                });
            } catch (dbErr) {
                console.warn('Advertencia actualizando URL_EVIDENCIA en BD:', dbErr.message);
            }
        }

        res.json({
            success: true,
            message: 'Evidencia almacenada y vinculada exitosamente',
            filename: cleanName,
            url: publicUrl
        });
    } catch (err) {
        next(err);
    }
}

/* ── POST /api/estudiante/generar-qr-asistencia ──────────────────────── */
async function generarQrAsistencia(req, res, next) {
    try {
        const idEstudiante = Number(req.usuario?.id || req.body.id_estudiante);
        if (!idEstudiante) throw createError(400, 'Identificador de estudiante requerido');

        // Consultar asignación activa
        const asigSql = `
            SELECT a.ID_ASIGNACION, a.ID_INSTITUCION, i.NOMBRE AS INSTITUCION,
                   u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE
            FROM ASIGNACION a
            JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            WHERE a.ID_ESTUDIANTE = :idEstudiante
            AND ROWNUM = 1
        `;
        let asigRow;
        try {
            const r = await executeQuery(asigSql, { idEstudiante });
            asigRow = r.rows && r.rows[0];
        } catch (e) {
            // SQLite fallback sin ROWNUM
            const r = await executeQuery(`
                SELECT a.ID_ASIGNACION, a.ID_INSTITUCION, i.NOMBRE AS INSTITUCION,
                       u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE
                FROM ASIGNACION a
                JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
                JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
                WHERE a.ID_ESTUDIANTE = :idEstudiante
                LIMIT 1
            `, { idEstudiante });
            asigRow = r.rows && r.rows[0];
        }

        if (!asigRow) {
            throw createError(404, 'No tienes una práctica o asignación activa en una institución');
        }

        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middlewares/auth.middleware');

        // Token dinámico efímero con vigencia de 15 minutos
        const qrPayload = {
            tipo: 'ASISTENCIA_PRESENCIAL_SIGPA',
            idAsignacion: asigRow.ID_ASIGNACION,
            idEstudiante,
            idInstitucion: asigRow.ID_INSTITUCION,
            estudiante: (asigRow.ESTUDIANTE || '').trim(),
            institucion: asigRow.INSTITUCION,
            fecha: new Date().toISOString().substring(0, 10),
            timestamp: Date.now()
        };

        const qrToken = jwt.sign(qrPayload, JWT_SECRET, { expiresIn: '15m' });

        res.json({
            success: true,
            qrToken,
            datos: {
                idAsignacion: asigRow.ID_ASIGNACION,
                estudiante: (asigRow.ESTUDIANTE || '').trim(),
                institucion: asigRow.INSTITUCION,
                fecha: qrPayload.fecha,
                expiraEnMinutos: 15
            }
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
    subirEvidencia,
    generarQrAsistencia,
};

