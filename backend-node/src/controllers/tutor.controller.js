/**
 * SIGPA — TutorController (Oracle 10g)
 * Migrado desde: backend.controller.TutorController.java
 *
 * Endpoints:
 *   GET  /api/tutor/asignaciones (o /api/tutor/estudiantes)
 *   GET  /api/tutor/bitacoras    (o /api/tutor/bitacoras_pendientes)
 *   POST /api/tutor/calificar
 *   POST /api/tutor/aprobar_asignacion
 */
'use strict';

const { executeQuery, executeTransaction } = require('../config/database');
const { createError } = require('../middlewares/errorHandler');
const { cerrarPractica } = require('./director.controller');

/* ── GET /api/tutor/asignaciones ─────────────────────────────────────── */
async function getAsignaciones(req, res, next) {
    try {
        const idTutor = req.usuario.rol === 'DIRECTOR' ? Number(req.query.id_tutor || 0) : Number(req.usuario.id);

        const sql = `
            SELECT a.ID_ASIGNACION, a.HORAS_ACUMULADAS, a.ESTADO_PRACTICA,
                   TO_CHAR(a.FECHA_ASIGNACION, 'YYYY-MM-DD') AS FECHA_ASIGNACION,
                   u.ID_USUARIO AS ID_ESTUDIANTE, u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE, u.EMAIL,
                   p.NOMBRE AS PRACTICA, p.HORAS_REQUERIDAS,
                   i.NOMBRE AS INSTITUCION
            FROM ASIGNACION a
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            WHERE (a.ID_TUTOR = :idTutor1 OR :idTutor2 = 0)
              AND a.ESTADO_PRACTICA NOT IN ('PENDIENTE', 'RECHAZADA')
            ORDER BY a.ID_ASIGNACION DESC
        `;

        const result = await executeQuery(sql, { idTutor1: idTutor, idTutor2: idTutor });

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.ID_ASIGNACION,
                idEstudiante: r.ID_ESTUDIANTE,
                estudiante: (r.ESTUDIANTE || '').trim(),
                email: r.EMAIL || '',
                practica: r.PRACTICA,
                horasRequeridas: r.HORAS_REQUERIDAS,
                horasAcumuladas: Number(r.HORAS_ACUMULADAS || 0),
                institucion: r.INSTITUCION || '',
                estado: r.ESTADO_PRACTICA,
                fecha: r.FECHA_ASIGNACION || '',
            })),
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/tutor/bitacoras ────────────────────────────────────────── */
async function getBitacoras(req, res, next) {
    try {
        const idTutor = req.usuario.rol === 'DIRECTOR' ? Number(req.query.id_tutor || 0) : Number(req.usuario.id);

        const sql = `
            SELECT b.ID_BITACORA, b.ID_ASIGNACION, b.NUMERO_VISITA,
                   TO_CHAR(b.FECHA_REGISTRO, 'YYYY-MM-DD') AS FECHA_REGISTRO,
                   b.HORAS_SESION, b.ACTIVIDADES, b.OBSERVACIONES, b.URL_EVIDENCIA, b.ESTADO_REVISION,
                   u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE,
                   p.NOMBRE AS PRACTICA, p.ID_PRACTICA,
                   i.NOMBRE AS INSTITUCION,
                   e.NOTA, e.COMENTARIOS, av.NOTA AS NOTA_ASESOR, av.COMENTARIOS AS AVAL_ASESOR
            FROM BITACORA b
            JOIN ASIGNACION a ON b.ID_ASIGNACION = a.ID_ASIGNACION
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            LEFT JOIN EVALUACION e ON e.ID_EVALUACION = (
                SELECT MAX(et.ID_EVALUACION) FROM EVALUACION et
                WHERE et.ID_BITACORA = b.ID_BITACORA AND et.TIPO_EVALUADOR = 'TUTOR'
            )
            LEFT JOIN EVALUACION av ON av.ID_EVALUACION = (
                SELECT MAX(ea.ID_EVALUACION) FROM EVALUACION ea
                WHERE ea.ID_BITACORA = b.ID_BITACORA AND ea.TIPO_EVALUADOR = 'ASESOR'
            )
            WHERE (a.ID_TUTOR = :idTutor1 OR :idTutor2 = 0)
              AND (:practica = 0 OR p.ID_PRACTICA = :idPractica)
              AND (:semestre = 0 OR p.SEMESTRE = :semestreFiltro)
            ORDER BY b.ID_BITACORA DESC
        `;

        const practica = Number(req.query.id_practica || 0);
        const semestre = req.usuario.rol === 'DIRECTOR' ? Number(req.query.semestre || 0) : 0;
        if (!Number.isInteger(practica) || practica < 0) throw createError(400, 'Práctica inválida');
        if (![0, 1, 2, 3].includes(semestre)) throw createError(400, 'Semestre inválido');
        const result = await executeQuery(sql, { idTutor1: idTutor, idTutor2: idTutor, practica, idPractica: practica, semestre, semestreFiltro: semestre });

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.ID_BITACORA,
                idAsignacion: r.ID_ASIGNACION,
                idPractica: r.ID_PRACTICA,
                visita: r.NUMERO_VISITA,
                fecha: r.FECHA_REGISTRO || '',
                horas: Number(r.HORAS_SESION || 0),
                actividades: r.ACTIVIDADES || '',
                observaciones: r.OBSERVACIONES || '',
                evidencia: r.URL_EVIDENCIA || '',
                estado: r.ESTADO_REVISION,
                estudiante: (r.ESTUDIANTE || '').trim(),
                practica: r.PRACTICA,
                institucion: r.INSTITUCION || '',
                nota: r.NOTA != null ? Number(r.NOTA) : null,
                comentarios: r.COMENTARIOS || '',
                notaAsesor: r.NOTA_ASESOR != null ? Number(r.NOTA_ASESOR) : null,
                avalAsesor: r.AVAL_ASESOR || '',
            })),
        });
    } catch (err) {
        next(err);
    }
}

/* ── POST /api/tutor/calificar ───────────────────────────────────────── */
async function calificarBitacora(req, res, next) {
    try {
        const { id_bitacora, nota, comentarios } = req.body;
        const idBitacora = Number(id_bitacora);
        const idEvaluador = Number(req.usuario.id);
        const numNota = typeof nota === 'number' || (typeof nota === 'string' && nota.trim()) ? Number(nota) : NaN;
        if (!Number.isInteger(idBitacora) || idBitacora < 1 ||
            !Number.isFinite(numNota) || numNota < 0 || numNota > 5 ||
            typeof comentarios !== 'string' || !comentarios.trim()) {
            throw createError(400, 'Indique una bitácora, una nota de 0 a 5 y la retroalimentación');
        }

        await executeTransaction(async (conn) => {
            if (!['true', '1'].includes(process.env.USE_MOCK_DB)) {
                await conn.execute('LOCK TABLE EVALUACION IN SHARE ROW EXCLUSIVE MODE', {}, { autoCommit: false });
            }
            const claimed = await conn.execute(`
                UPDATE BITACORA SET ESTADO_REVISION = 'CALIFICADA'
                WHERE ID_BITACORA = :idBitacora
                  AND NVL(ESTADO_REVISION, 'PENDIENTE') <> 'CALIFICADA'
                  AND EXISTS (SELECT 1 FROM ASIGNACION a WHERE a.ID_ASIGNACION = BITACORA.ID_ASIGNACION
                              AND a.ID_TUTOR = :idEvaluador
                              AND a.ESTADO_PRACTICA NOT IN ('PENDIENTE', 'RECHAZADA'))
                  AND NOT EXISTS (SELECT 1 FROM EVALUACION e WHERE e.ID_BITACORA = BITACORA.ID_BITACORA
                                  AND e.TIPO_EVALUADOR = 'TUTOR')
            `, { idBitacora, idEvaluador }, { autoCommit: false });
            if (!claimed.rowsAffected) throw createError(409, 'La bitácora ya fue calificada o no está asignada a este tutor');

            const evalSql = `
                INSERT INTO EVALUACION (ID_EVALUACION, ID_BITACORA, ID_EVALUADOR, TIPO_EVALUADOR, NOTA, COMENTARIOS, FECHA_EVALUACION)
                VALUES ((SELECT NVL(MAX(ID_EVALUACION), 0) + 1 FROM EVALUACION), :idBitacora, :idEvaluador, 'TUTOR', :numNota, :comentarios, SYSDATE)
            `;
            await conn.execute(evalSql, {
                idBitacora,
                idEvaluador,
                numNota,
                comentarios: comentarios.trim(),
            }, { autoCommit: false });

            if (numNota >= 3.0) {
                const updateHorasSql = `
                    UPDATE ASIGNACION
                    SET HORAS_ACUMULADAS = NVL(HORAS_ACUMULADAS, 0) + (SELECT NVL(HORAS_SESION, 0) FROM BITACORA WHERE ID_BITACORA = :idBitacora1)
                    WHERE ID_ASIGNACION = (SELECT ID_ASIGNACION FROM BITACORA WHERE ID_BITACORA = :idBitacora2)
                `;
                await conn.execute(updateHorasSql, {
                    idBitacora1: idBitacora,
                    idBitacora2: idBitacora,
                }, { autoCommit: false });
            }
        });

        res.json({
            success: true,
            message: 'Calificación y retroalimentación guardadas con éxito. Horas acumuladas actualizadas.',
        });
    } catch (err) {
        next(err);
    }
}

/* ── POST /api/tutor/aprobar_asignacion ──────────────────────────────── */
async function aprobarAsignacion(req, res, next) {
    try {
        const { id_asignacion, estado } = req.body;

        if (!id_asignacion || !estado) {
            throw createError(400, 'Faltan parámetros');
        }

        const idAsignacion = Number(id_asignacion);
        const idTutor = Number(req.usuario.id);
        if (!Number.isInteger(idAsignacion) || idAsignacion < 1 || !['EN_CURSO', 'FINALIZADA'].includes(estado)) {
            throw createError(400, 'Estado o asignación inválidos');
        }
        const result = await executeQuery(`
            UPDATE ASIGNACION SET ESTADO_PRACTICA = :estado
            WHERE ID_ASIGNACION = :idAsignacion AND ID_TUTOR = :idTutor
              AND ESTADO_APROBACION = 'APROBADA' AND ESTADO_PRACTICA IN ('EN_CURSO', 'FINALIZADA')
        `, { estado, idAsignacion, idTutor });
        if (!result.rowsAffected) throw createError(409, 'La asignación no está disponible para este tutor');

        res.json({
            success: true,
            message: 'Estado de asignación actualizado',
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getAsignaciones,
    getBitacoras,
    calificarBitacora,
    aprobarAsignacion,
    cerrarAsignacion: cerrarPractica,
    cerrarPractica,
};
