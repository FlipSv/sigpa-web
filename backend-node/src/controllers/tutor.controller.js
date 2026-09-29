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

/* ── GET /api/tutor/asignaciones ─────────────────────────────────────── */
async function getAsignaciones(req, res, next) {
    try {
        const idTutor = Number(req.query.id_tutor || 2);

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
            WHERE a.ID_TUTOR = :idTutor1 OR :idTutor2 = 0
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
        const idTutor = Number(req.query.id_tutor || 2);

        const sql = `
            SELECT b.ID_BITACORA, b.ID_ASIGNACION, b.NUMERO_VISITA,
                   TO_CHAR(b.FECHA_REGISTRO, 'YYYY-MM-DD') AS FECHA_REGISTRO,
                   b.HORAS_SESION, b.ACTIVIDADES, b.OBSERVACIONES, b.URL_EVIDENCIA, b.ESTADO_REVISION,
                   u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE,
                   p.NOMBRE AS PRACTICA,
                   i.NOMBRE AS INSTITUCION,
                   e.NOTA, e.COMENTARIOS
            FROM BITACORA b
            JOIN ASIGNACION a ON b.ID_ASIGNACION = a.ID_ASIGNACION
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            LEFT JOIN EVALUACION e ON b.ID_BITACORA = e.ID_BITACORA AND e.TIPO_EVALUADOR = 'TUTOR'
            WHERE a.ID_TUTOR = :idTutor1 OR :idTutor2 = 0
            ORDER BY b.ID_BITACORA DESC
        `;

        const result = await executeQuery(sql, { idTutor1: idTutor, idTutor2: idTutor });

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.ID_BITACORA,
                idAsignacion: r.ID_ASIGNACION,
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
            })),
        });
    } catch (err) {
        next(err);
    }
}

/* ── POST /api/tutor/calificar ───────────────────────────────────────── */
async function calificarBitacora(req, res, next) {
    try {
        const { id_bitacora, id_evaluador, nota, comentarios } = req.body;

        if (!id_bitacora || nota == null || nota === '') {
            throw createError(400, 'Faltan datos obligatorios (id_bitacora, nota)');
        }

        const idBitacora = Number(id_bitacora);
        const idEvaluador = id_evaluador ? Number(id_evaluador) : 2;
        const numNota = Number(nota);

        await executeTransaction(async (conn) => {
            const evalSql = `
                INSERT INTO EVALUACION (ID_EVALUACION, ID_BITACORA, ID_EVALUADOR, TIPO_EVALUADOR, NOTA, COMENTARIOS, FECHA_EVALUACION)
                VALUES ((SELECT NVL(MAX(ID_EVALUACION), 0) + 1 FROM EVALUACION), :idBitacora, :idEvaluador, 'TUTOR', :numNota, :comentarios, SYSDATE)
            `;
            await conn.execute(evalSql, {
                idBitacora,
                idEvaluador,
                numNota,
                comentarios: comentarios || '',
            }, { autoCommit: false });

            const bitSql = `
                UPDATE BITACORA SET ESTADO_REVISION = 'CALIFICADA' WHERE ID_BITACORA = :idBitacora
            `;
            await conn.execute(bitSql, { idBitacora }, { autoCommit: false });

            if (numNota >= 3.0) {
                const updateHorasSql = `
                    UPDATE ASIGNACION
                    SET HORAS_ACUMULADAS = HORAS_ACUMULADAS + (SELECT HORAS_SESION FROM BITACORA WHERE ID_BITACORA = :idBitacora1)
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

        const sql = `UPDATE ASIGNACION SET ESTADO_PRACTICA = :estado WHERE ID_ASIGNACION = :idAsignacion`;
        await executeQuery(sql, { estado, idAsignacion: Number(id_asignacion) });

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
};
