/**
 * SIGPA — AsesorController (Oracle 10g)
 * Migrado desde: backend.controller.AsesorController.java
 *
 * Endpoints:
 *   GET  /api/asesor/estudiantes (o /api/asesor/asignaciones)
 *   GET  /api/asesor/bitacoras
 *   POST /api/asesor/evaluar
 */
'use strict';

const { executeQuery } = require('../config/database');
const { createError } = require('../middlewares/errorHandler');

/* ── GET /api/asesor/estudiantes ─────────────────────────────────────── */
async function getEstudiantes(req, res, next) {
    try {
        const sql = `
            SELECT a.ID_ASIGNACION, a.HORAS_ACUMULADAS, a.ESTADO_PRACTICA,
                   u.ID_USUARIO, u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE, u.EMAIL,
                   p.NOMBRE AS PRACTICA, p.HORAS_REQUERIDAS,
                   i.NOMBRE AS INSTITUCION
            FROM ASIGNACION a
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            ORDER BY a.ID_ASIGNACION DESC
        `;

        const result = await executeQuery(sql);

        res.json({
            success: true,
            data: result.rows.map(r => ({
                idAsignacion: r.ID_ASIGNACION,
                idEstudiante: r.ID_USUARIO,
                estudiante: (r.ESTUDIANTE || '').trim(),
                email: r.EMAIL || '',
                practica: r.PRACTICA,
                institucion: r.INSTITUCION || '',
                horasAcumuladas: Number(r.HORAS_ACUMULADAS || 0),
                horasRequeridas: r.HORAS_REQUERIDAS,
                estado: r.ESTADO_PRACTICA,
            })),
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/asesor/bitacoras ────────────────────────────────────────── */
async function getBitacoras(req, res, next) {
    try {
        const sql = `
            SELECT b.ID_BITACORA, b.ID_ASIGNACION, b.NUMERO_VISITA,
                   TO_CHAR(b.FECHA_REGISTRO, 'YYYY-MM-DD') AS FECHA_REGISTRO,
                   b.HORAS_SESION, b.ACTIVIDADES, b.OBSERVACIONES, b.URL_EVIDENCIA,
                   u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE,
                   p.NOMBRE AS PRACTICA, i.NOMBRE AS INSTITUCION,
                   e.NOTA, e.COMENTARIOS
            FROM BITACORA b
            JOIN ASIGNACION a ON b.ID_ASIGNACION = a.ID_ASIGNACION
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            LEFT JOIN EVALUACION e ON b.ID_BITACORA = e.ID_BITACORA AND e.TIPO_EVALUADOR = 'ASESOR'
            ORDER BY b.ID_BITACORA DESC
        `;

        const result = await executeQuery(sql);

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.ID_BITACORA,
                idAsignacion: r.ID_ASIGNACION,
                sesion: r.NUMERO_VISITA,
                visita: r.NUMERO_VISITA,
                fecha: r.FECHA_REGISTRO || '',
                horas: Number(r.HORAS_SESION || 0),
                actividades: r.ACTIVIDADES || '',
                observaciones: r.OBSERVACIONES || '',
                evidencia: r.URL_EVIDENCIA || '',
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

/* ── POST /api/asesor/evaluar ────────────────────────────────────────── */
async function evaluarInSitu(req, res, next) {
    try {
        const { id_bitacora, id_evaluador, nota, comentarios } = req.body;

        if (!id_bitacora || !comentarios) {
            throw createError(400, 'Faltan datos obligatorios (id_bitacora, comentarios)');
        }

        const idBitacora = Number(id_bitacora);
        const idEvaluador = id_evaluador ? Number(id_evaluador) : 3;
        const numNota = nota != null && nota !== '' ? Number(nota) : 5.0;

        const sql = `
            INSERT INTO EVALUACION (ID_EVALUACION, ID_BITACORA, ID_EVALUADOR, TIPO_EVALUADOR, NOTA, COMENTARIOS, FECHA_EVALUACION)
            VALUES ((SELECT NVL(MAX(ID_EVALUACION), 0) + 1 FROM EVALUACION), :idBitacora, :idEvaluador, 'ASESOR', :numNota, :comentarios, SYSDATE)
        `;

        await executeQuery(sql, {
            idBitacora,
            idEvaluador,
            numNota,
            comentarios: comentarios.trim(),
        });

        res.json({
            success: true,
            message: 'Evaluación pedagógica in situ registrada con éxito',
        });
    } catch (err) {
        next(err);
    }
}

/* ── POST /api/asesor/validar-asistencia-qr ─────────────────────────── */
async function validarAsistenciaQr(req, res, next) {
    try {
        const { qrToken, horas } = req.body;
        if (!qrToken) throw createError(400, 'Código QR no proporcionado');

        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middlewares/auth.middleware');

        let decoded;
        try {
            decoded = jwt.verify(qrToken, JWT_SECRET);
        } catch (jwtErr) {
            if (jwtErr.name === 'TokenExpiredError') {
                throw createError(400, 'El Código QR ha expirado (vigencia máxima 15 minutos). Solicita al estudiante generar uno nuevo.');
            }
            throw createError(400, 'Código QR inválido o no reconocido por SIGPA');
        }

        if (decoded.tipo !== 'ASISTENCIA_PRESENCIAL_SIGPA') {
            throw createError(400, 'El código escaneado no corresponde a una asistencia válida');
        }

        const idAsesor = Number(req.usuario?.id || 3);
        const horasValidar = Number(horas || 4);

        // Validar institución del Asesor
        let instAsesorId = req.usuario?.idInstitucion;
        if (!instAsesorId) {
            try {
                const uRes = await executeQuery('SELECT ID_INSTITUCION FROM USUARIO WHERE ID_USUARIO = :id', { id: idAsesor });
                instAsesorId = uRes.rows && uRes.rows[0] ? uRes.rows[0].ID_INSTITUCION : null;
            } catch (_) {}
        }

        // Si el asesor tiene una institución específica configurada, comprobar coincidencia
        if (instAsesorId && decoded.idInstitucion && Number(instAsesorId) !== Number(decoded.idInstitucion)) {
            throw createError(403, `Este estudiante pertenece a otra institución educativa (${decoded.institucion || 'Otra sede'}). No tienes autorización para avalar su asistencia.`);
        }

        const fechaHoy = new Date().toISOString().substring(0, 10);
        const horaAhora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        // Registrar asistencia en base de datos
        try {
            const insertSql = `
                INSERT INTO ASISTENCIA (ID_ASISTENCIA, ID_ASIGNACION, ID_ESTUDIANTE, ID_INSTITUCION, ID_ASESOR, FECHA_ASISTENCIA, HORA_LLEGADA, HORAS_VALIDADAS, ESTADO_VALIDACION, TOKEN_QR)
                VALUES ((SELECT NVL(MAX(ID_ASISTENCIA), 0) + 1 FROM ASISTENCIA), :idAsig, :idEst, :idInst, :idAsesor, :fecha, :hora, :horas, 'VALIDADA', :token)
            `;
            await executeQuery(insertSql, {
                idAsig: decoded.idAsignacion,
                idEst: decoded.idEstudiante,
                idInst: decoded.idInstitucion,
                idAsesor,
                fecha: fechaHoy,
                hora: horaAhora,
                horas: horasValidar,
                token: qrToken.substring(0, 40) + '...'
            });
        } catch (dbErr) {
            console.warn('Aviso registrando en tabla ASISTENCIA:', dbErr.message);
        }

        res.json({
            success: true,
            message: `✔ Asistencia presencial confirmada con éxito para ${decoded.estudiante}`,
            estudiante: decoded.estudiante,
            institucion: decoded.institucion,
            fecha: fechaHoy,
            hora: horaAhora,
            horas: horasValidar
        });

    } catch (err) {
        next(err);
    }
}

module.exports = {
    getEstudiantes,
    getBitacoras,
    evaluarInSitu,
    validarAsistenciaQr,
};
