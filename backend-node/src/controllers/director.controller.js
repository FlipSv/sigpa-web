/**
 * SIGPA — DirectorController (Oracle 10g)
 *
 * Endpoints:
 *   GET  /api/director/kpis
 *   GET  /api/director/estado        (prácticas)
 *   GET  /api/director/instituciones
 *   GET  /api/director/estudiantes
 *   GET  /api/director/asignaciones
 *   POST /api/director/cambiar_estado
 *   POST /api/director/nueva_practica
 *   POST /api/director/nueva_institucion
 *   POST /api/director/asignar
 */
'use strict';

const { executeQuery, executeTransaction } = require('../config/database');
const { createError } = require('../middlewares/errorHandler');
const pdfReportService = require('../services/pdfReportService');

/* ── GET /api/director/kpis ──────────────────────────────────────────── */
async function getKpis(req, res, next) {
    try {
        const estRes = await executeQuery(`SELECT COUNT(*) AS CNT FROM USUARIO WHERE ROL = 'ESTUDIANTE' AND ACTIVO = 'S'`);
        const totalEstudiantes = estRes.rows && estRes.rows[0] ? Number(estRes.rows[0].CNT || 0) : 0;

        const hrsRes = await executeQuery(`SELECT NVL(SUM(HORAS_ACUMULADAS), 0) AS HRS FROM ASIGNACION`);
        const totalHoras = hrsRes.rows && hrsRes.rows[0] ? Number(hrsRes.rows[0].HRS || 0) : 0;

        const instRes = await executeQuery(`
            SELECT COUNT(*) AS CNT, NVL(SUM(
                CASE WHEN i.CUPOS_DISPONIBLES > NVL(a.OCUPADOS, 0)
                     THEN i.CUPOS_DISPONIBLES - NVL(a.OCUPADOS, 0) ELSE 0 END
            ), 0) AS CUP
            FROM INSTITUCION i
            LEFT JOIN (
                SELECT ID_INSTITUCION, COUNT(*) AS OCUPADOS FROM ASIGNACION
                WHERE ESTADO_PRACTICA IN ('PENDIENTE', 'EN_CURSO')
                GROUP BY ID_INSTITUCION
            ) a ON a.ID_INSTITUCION = i.ID_INSTITUCION
            WHERE ${vigenciaInstitucion}
        `);
        const conveniosActivos = instRes.rows && instRes.rows[0] ? Number(instRes.rows[0].CNT || 0) : 0;
        const cuposDisponibles = instRes.rows && instRes.rows[0] ? Number(instRes.rows[0].CUP || 0) : 0;

        const pracRes = await executeQuery(`SELECT COUNT(*) AS CNT FROM PRACTICA WHERE ESTADO = 'ABIERTA' AND SEMESTRE IN (1, 2, 3)`);
        const practicasAbiertas = pracRes.rows && pracRes.rows[0] ? Number(pracRes.rows[0].CNT || 0) : 0;

        const metrics = {
            totalEstudiantes,
            totalHoras,
            conveniosActivos,
            cuposDisponibles,
            practicasAbiertas,
            estudiantes: totalEstudiantes,
            horas: totalHoras,
            convenios: conveniosActivos,
            cupos: cuposDisponibles,
            practicas: practicasAbiertas
        };

        res.json({
            success: true,
            status: 'success',
            ...metrics,
            data: metrics,
            kpis: metrics,
            stats: metrics
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/director/estado  (prácticas) ───────────────────────────── */
async function getPracticas(req, res, next) {
    try {
        const sql = `
            SELECT p.ID_PRACTICA, p.SEMESTRE, p.TIPO, p.HORAS_REQUERIDAS,
                   p.NOMBRE, p.ESTADO, p.ID_INSTITUCION, i.NOMBRE AS INSTITUCION,
                   p.ID_TUTOR, t.NOMBRE || ' ' || NVL(t.APELLIDO, '') AS TUTOR,
                   (SELECT COUNT(*) FROM ASIGNACION a WHERE a.ID_PRACTICA = p.ID_PRACTICA) AS TOTAL_ESTUDIANTES,
                   (SELECT COUNT(*) FROM USUARIO u WHERE u.ROL = 'ESTUDIANTE' AND u.ACTIVO = 'S' AND u.SEMESTRE = p.SEMESTRE) AS ESTUDIANTES_SEMESTRE
            FROM PRACTICA p
            LEFT JOIN INSTITUCION i ON i.ID_INSTITUCION = p.ID_INSTITUCION
            LEFT JOIN USUARIO t ON t.ID_USUARIO = p.ID_TUTOR
            WHERE p.SEMESTRE IN (1, 2, 3, 4, 5, 6)
            ORDER BY p.SEMESTRE, p.ID_PRACTICA
        `;
        const result = await executeQuery(sql);

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.ID_PRACTICA,
                semestre: r.SEMESTRE,
                tipo: r.TIPO,
                horas: r.HORAS_REQUERIDAS,
                nombre: r.NOMBRE,
                estado: r.ESTADO,
                idInstitucion: r.ID_INSTITUCION,
                institucion: r.INSTITUCION || '',
                idTutor: r.ID_TUTOR,
                tutor: (r.TUTOR || '').trim(),
                totalEstudiantes: r.TOTAL_ESTUDIANTES || 0,
                cuposTotales: r.ESTUDIANTES_SEMESTRE || 0,
            })),
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/director/instituciones ─────────────────────────────────── */
async function getInstituciones(req, res, next) {
    try {
        const sql = `
            SELECT ID_INSTITUCION, NOMBRE, DIRECCION, TELEFONO,
                   CONVENIO_ACTIVO, CUPOS_DISPONIBLES,
                   TO_CHAR(FECHA_VENC_CONVENIO, 'YYYY-MM-DD') AS FECHA_VENC_CONVENIO,
                   CASE WHEN ${vigenciaInstitucion} THEN 'S' ELSE 'N' END AS VIGENTE,
                   (SELECT COUNT(*) FROM ASIGNACION a WHERE a.ID_INSTITUCION = i.ID_INSTITUCION AND a.ESTADO_PRACTICA IN ('EN_CURSO', 'PENDIENTE')) AS ESTUDIANTES_ASIGNADOS
            FROM INSTITUCION i
            ORDER BY i.NOMBRE ASC
        `;
        const result = await executeQuery(sql);

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.ID_INSTITUCION,
                nombre: r.NOMBRE,
                direccion: r.DIRECCION || '',
                telefono: r.TELEFONO || '',
                convenioActivo: r.CONVENIO_ACTIVO,
                vigente: r.VIGENTE === 'S',
                cupos: r.CUPOS_DISPONIBLES,
                vencimiento: r.FECHA_VENC_CONVENIO || '',
                estudiantesAsignados: r.ESTUDIANTES_ASIGNADOS || 0,
                ocupados: r.ESTUDIANTES_ASIGNADOS || 0,
            })),
        });
    } catch (err) { next(err); }
}

async function getEstudiantes(req, res, next) {
    try {
        const rawSemestre = req.query.semestre;
        const binds = {};
        let sql = `
            SELECT ID_USUARIO, NOMBRE, APELLIDO, SEMESTRE FROM USUARIO
            WHERE ROL = 'ESTUDIANTE' AND ACTIVO = 'S'
        `;
        if (rawSemestre) {
            const semestre = Number(rawSemestre);
            sql += ` AND SEMESTRE = :semestre`;
            binds.semestre = semestre;
        }
        sql += ` ORDER BY SEMESTRE, NOMBRE, APELLIDO`;
        const result = await executeQuery(sql, binds);
        res.json({ success: true, data: result.rows.map(row => ({
            id: row.ID_USUARIO,
            nombre: `${row.NOMBRE} ${(row.APELLIDO || '').replace(/ \(Estudiante\)$/, '')}`.trim(),
            semestre: row.SEMESTRE,
        })) });
    } catch (err) { next(err); }
}

/* ── GET /api/director/conteo-estudiantes ───────────────────────────── */
async function getConteoEstudiantesPorSemestre(req, res, next) {
    try {
        const result = await executeQuery(`
            SELECT SEMESTRE, COUNT(*) AS TOTAL
            FROM USUARIO
            WHERE ROL = 'ESTUDIANTE' AND ACTIVO = 'S'
            GROUP BY SEMESTRE
            ORDER BY SEMESTRE
        `);
        const conteo = {};
        (result.rows || []).forEach(r => {
            conteo[r.SEMESTRE] = Number(r.TOTAL || 0);
        });
        res.json({ success: true, data: conteo });
    } catch (err) { next(err); }
}

/* ── GET /api/director/asignaciones ─────────────────────────────────── */
async function getAsignaciones(req, res, next) {
    try {
        const sql = `
            SELECT a.ID_ASIGNACION, a.HORAS_ACUMULADAS, a.ESTADO_PRACTICA, a.ESTADO_APROBACION, a.ID_PRACTICA,
                   TO_CHAR(a.FECHA_ASIGNACION, 'YYYY-MM-DD') AS FECHA_ASIGNACION,
                   u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE,
                   t.NOMBRE || ' ' || NVL(t.APELLIDO, '') AS TUTOR,
                   p.NOMBRE AS PRACTICA, p.HORAS_REQUERIDAS,
                   i.NOMBRE AS INSTITUCION
            FROM ASIGNACION a
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            LEFT JOIN USUARIO t ON a.ID_TUTOR = t.ID_USUARIO
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            ORDER BY a.ID_ASIGNACION DESC
        `;
        const result = await executeQuery(sql);

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.ID_ASIGNACION,
                idPractica: r.ID_PRACTICA,
                aprobacion: r.ESTADO_APROBACION,
                estudiante: (r.ESTUDIANTE || '').trim(),
                tutor: (r.TUTOR || '').trim(),
                practica: r.PRACTICA,
                institucion: r.INSTITUCION || '',
                horasAcumuladas: Number(r.HORAS_ACUMULADAS || 0),
                horasRequeridas: r.HORAS_REQUERIDAS,
                estado: r.ESTADO_PRACTICA,
                fecha: r.FECHA_ASIGNACION || '',
            })),
        });
    } catch (err) {
        next(err);
    }
}

/* ── POST /api/director/cambiar_estado ───────────────────────────────── */
async function cambiarEstado(req, res, next) {
    try {
        const { id, estado } = req.body;
        if (!Number.isInteger(Number(id)) || Number(id) < 1 || !['ABIERTA', 'CERRADA'].includes(estado)) {
            throw createError(400, 'Seleccione una práctica y un estado válidos');
        }

        const estadoUpper = String(estado).toUpperCase().trim();
        if (!['ABIERTA', 'CERRADA'].includes(estadoUpper)) {
            throw createError(400, 'Estado no válido. Debe ser ABIERTA o CERRADA');
        }

        const sql = `UPDATE PRACTICA SET ESTADO = :estado WHERE ID_PRACTICA = :id`;
        const result = await executeQuery(sql, { estado, id: Number(id) });
        if (!result.rowsAffected) throw createError(404, 'La práctica no existe');

        res.json({ success: true, message: 'Estado actualizado correctamente' });
    } catch (err) { next(err); }
}

/* ── Mapeo oficial de modalidades fijas por semestre ────────────────── */
const MODALIDADES_POR_SEMESTRE = {
    1: 'OBSERVACION',
    2: 'INTERVENCION',
    3: 'DOCENTE',
    4: 'INVESTIGATIVA',
    5: 'COMUNITARIA',
    6: 'PROFESIONAL'
};

/* ── POST /api/director/nueva_practica ───────────────────────────────── */
async function nuevaPractica(req, res, next) {
    try {
        const semestre = Number(req.body.semestre);
        const horas = Number(req.body.horas || 64);
        
        if (![1, 2, 3, 4, 5, 6].includes(semestre)) {
            throw createError(400, 'Seleccione un semestre académico válido (1 al 6)');
        }
        if (!Number.isInteger(horas) || horas < 16 || horas > 320) {
            throw createError(400, 'Las horas requeridas deben ser un valor válido entre 16 y 320 horas');
        }

        // Modalidad oficial fija según el semestre
        const tipo = MODALIDADES_POR_SEMESTRE[semestre] || req.body.tipo || 'OBSERVACION';
        const nombrePractica = req.body.nombre && String(req.body.nombre).trim() 
            ? String(req.body.nombre).trim() 
            : `Práctica Semestre ${semestre}`;

        // Obtener cupos automáticos basados en los estudiantes matriculados en ese semestre
        const estRes = await executeQuery(`
            SELECT COUNT(*) AS TOTAL FROM USUARIO 
            WHERE ROL = 'ESTUDIANTE' AND ACTIVO = 'S' AND SEMESTRE = :semestre
        `, { semestre });
        const estudiantesEnSemestre = estRes.rows && estRes.rows[0] ? Number(estRes.rows[0].TOTAL || 0) : 0;

        let newId = null;
        await executeTransaction(async conn => {
            await lockOracleTable(conn, 'PRACTICA');

            // Verificar si ya existe una práctica abierta para este semestre
            const checkExistente = await conn.execute(`
                SELECT ID_PRACTICA, NOMBRE FROM PRACTICA 
                WHERE SEMESTRE = :semestre AND ESTADO = 'ABIERTA'
            `, { semestre });

            if (checkExistente.rows && checkExistente.rows.length > 0) {
                throw createError(409, `Ya existe una práctica activa y abierta para el Semestre ${semestre}`);
            }

            // Insertar la práctica como oferta curricular para la cohorte del semestre
            await conn.execute(`
                INSERT INTO PRACTICA (
                    ID_PRACTICA, NOMBRE, SEMESTRE, TIPO, HORAS_REQUERIDAS, ESTADO, ID_INSTITUCION
                )
                VALUES (
                    (SELECT NVL(MAX(ID_PRACTICA), 0) + 1 FROM PRACTICA),
                    :nombre, :semestre, :tipo, :horas, 'ABIERTA', NULL
                )
            `, {
                nombre: nombrePractica,
                semestre,
                tipo,
                horas
            }, { autoCommit: false });

            const idRes = await conn.execute(`SELECT NVL(MAX(ID_PRACTICA), 1) AS CURRENT_ID FROM PRACTICA`);
            newId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].CURRENT_ID || idRes.rows[0][0]) : 1;
        });

        res.json({
            success: true,
            message: `Práctica para Semestre ${semestre} habilitada exitosamente (${estudiantesEnSemestre} estudiantes matriculados)`,
            practica_id: newId,
            id_practica: newId,
            data: {
                id: newId,
                nombre: nombrePractica,
                semestre,
                tipo,
                horas,
                estudiantesInscritos: estudiantesEnSemestre,
                estado: 'ABIERTA'
            }
        });
    } catch (err) { next(err); }
}

/* ── GET /api/director/tutores ───────────────────────────────────────── */
async function getTutores(req, res, next) {
    try {
        const sql = `
            SELECT ID_USUARIO, NOMBRE, APELLIDO, EMAIL, ROL
            FROM USUARIO
            WHERE ROL IN ('TUTOR', 'COORDINADOR') AND ACTIVO = 'S'
            ORDER BY NOMBRE, APELLIDO
        `;
        const result = await executeQuery(sql);
        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.ID_USUARIO,
                nombre: `${r.NOMBRE} ${(r.APELLIDO || '').replace(/ \(Tutor\)$/, '')}`.trim(),
                email: r.EMAIL,
                rol: r.ROL
            }))
        });
    } catch (err) { next(err); }
}

/* ── POST /api/director/asignar_tutor_practica ────────────────────────── */
async function asignarTutorPractica(req, res, next) {
    try {
        const idPractica = Number(req.body.id_practica);
        const idTutor = req.body.id_tutor ? Number(req.body.id_tutor) : null;

        if (!idPractica || isNaN(idPractica)) {
            throw createError(400, 'Debe especificar una práctica válida');
        }

        // Si se envía idTutor, verificar que exista y sea rol TUTOR o COORDINADOR
        if (idTutor) {
            const tutRes = await executeQuery(`SELECT ID_USUARIO FROM USUARIO WHERE ID_USUARIO = :idTutor AND ROL IN ('TUTOR', 'COORDINADOR') AND ACTIVO = 'S'`, { idTutor });
            if (!tutRes.rows || tutRes.rows.length === 0) {
                throw createError(404, 'El tutor seleccionado no existe o no está activo');
            }
        }

        const sql = `UPDATE PRACTICA SET ID_TUTOR = :idTutor WHERE ID_PRACTICA = :idPractica`;
        const result = await executeQuery(sql, { idTutor, idPractica });
        if (!result.rowsAffected) throw createError(404, 'La práctica no existe');

        // Actualizar asignaciones vinculadas a esta práctica si no tienen tutor asignado
        if (idTutor) {
            try {
                await executeQuery(`UPDATE ASIGNACION SET ID_TUTOR = :idTutor WHERE ID_PRACTICA = :idPractica AND ID_TUTOR IS NULL`, { idTutor, idPractica });
            } catch (eAsig) {}
        }

        res.json({ success: true, message: 'Tutor asignado a la práctica exitosamente' });
    } catch (err) { next(err); }
}

/* ── DELETE /api/director/practica/:id ────────────────────────────────── */
async function eliminarPractica(req, res, next) {
    try {
        const id = Number(req.params.id || req.body.id_practica || req.body.id);
        if (!id || isNaN(id)) throw createError(400, 'Identificador de práctica inválido');

        // Verificar si tiene estudiantes asignados
        const checkAsig = await executeQuery(`SELECT COUNT(*) AS CNT FROM ASIGNACION WHERE ID_PRACTICA = :id`, { id });
        if (checkAsig.rows && checkAsig.rows[0] && Number(checkAsig.rows[0].CNT) > 0) {
            throw createError(409, `No se puede eliminar la práctica porque tiene ${checkAsig.rows[0].CNT} estudiantes con asignación formal.`);
        }

        // Borrar preguntas guía asociadas
        try {
            await executeQuery(`DELETE FROM PREGUNTA_GUIA WHERE ID_PRACTICA = :id`, { id });
        } catch (eQ) {}

        const result = await executeQuery(`DELETE FROM PRACTICA WHERE ID_PRACTICA = :id`, { id });
        if (!result.rowsAffected) throw createError(404, 'La práctica no existe');

        res.json({ success: true, message: 'Práctica eliminada exitosamente del catálogo' });
    } catch (err) { next(err); }
}

/* ── DELETE /api/director/institucion/:id ──────────────────────────────── */
async function eliminarInstitucion(req, res, next) {
    try {
        const id = Number(req.params.id || req.body.id_institucion || req.body.id);
        if (!id || isNaN(id)) throw createError(400, 'Identificador de institución inválido');

        // Verificar si tiene estudiantes asignados en ASIGNACION
        const checkAsig = await executeQuery(`SELECT COUNT(*) AS CNT FROM ASIGNACION WHERE ID_INSTITUCION = :id`, { id });
        if (checkAsig.rows && checkAsig.rows[0] && Number(checkAsig.rows[0].CNT) > 0) {
            throw createError(409, `No se puede eliminar la institución porque tiene ${checkAsig.rows[0].CNT} asignaciones de práctica activas.`);
        }

        // Desvincular de prácticas si alguna aún la referencia
        try {
            await executeQuery(`UPDATE PRACTICA SET ID_INSTITUCION = NULL WHERE ID_INSTITUCION = :id`, { id });
        } catch (eP) {}

        const result = await executeQuery(`DELETE FROM INSTITUCION WHERE ID_INSTITUCION = :id`, { id });
        if (!result.rowsAffected) throw createError(404, 'La institución no existe');

        res.json({ success: true, message: 'Institución y convenio eliminados exitosamente' });
    } catch (err) { next(err); }
}

/* ── POST /api/director/nueva_institucion ────────────────────────────── */
async function nuevaInstitucion(req, res, next) {
    try {
        const { nombre, direccion, telefono, cupos, vencimiento } = req.body;
        if (!nombre) throw createError(400, 'El nombre de la institución es obligatorio');

        const sql = `
            INSERT INTO INSTITUCION (ID_INSTITUCION, NOMBRE, DIRECCION, TELEFONO, CONVENIO_ACTIVO, CUPOS_DISPONIBLES, FECHA_VENC_CONVENIO)
            VALUES ((SELECT NVL(MAX(ID_INSTITUCION), 0) + 1 FROM INSTITUCION), :nombre, :direccion, :telefono, 'S', :cupos, TO_DATE(:vencimiento, 'YYYY-MM-DD'))
        `;
        await executeQuery(sql, {
            nombre,
            direccion: direccion || '',
            telefono: telefono || '',
            cupos: Number(cupos) || 3,
            vencimiento: vencimiento || '2027-12-31',
        });

        res.json({ success: true, message: 'Institución y convenio registrados con éxito' });
    } catch (err) { next(err); }
}

/* ── POST /api/director/asignar ──────────────────────────────────────── */
async function asignarEstudiante(req, res, next) {
    try {
        const estudiante = Number(req.body.id_estudiante);
        const semestre = Number(req.body.semestre);
        const institucion = Number(req.body.id_institucion);
        if (![1, 2, 3].includes(semestre) || !Number.isInteger(estudiante) || estudiante < 1 ||
            !Number.isInteger(institucion) || institucion < 1) {
            throw createError(400, 'Seleccione semestre, estudiante e institución válidos');
        }

        await executeTransaction(async conn => {
            await lockOracleTable(conn, 'ASIGNACION');
            const result = await conn.execute(`
                INSERT INTO ASIGNACION (
                    ID_ASIGNACION, ID_USUARIO, ID_ESTUDIANTE, ID_TUTOR, ID_PRACTICA, ID_INSTITUCION,
                    HORAS_ACUMULADAS, ESTADO, ESTADO_APROBACION, ESTADO_PRACTICA, FECHA_ASIGNACION
                )
                SELECT (SELECT NVL(MAX(ID_ASIGNACION), 0) + 1 FROM ASIGNACION),
                       u.ID_USUARIO, u.ID_USUARIO, t.ID_USUARIO, p.ID_PRACTICA, i.ID_INSTITUCION,
                       0, 'PENDIENTE', 'PENDIENTE', 'PENDIENTE', SYSDATE
                FROM USUARIO u
                LEFT JOIN USUARIO t ON t.ROL = 'TUTOR' AND t.ACTIVO = 'S'
                JOIN PRACTICA p ON p.SEMESTRE = u.SEMESTRE AND p.ESTADO = 'ABIERTA'
                JOIN INSTITUCION i ON i.ID_INSTITUCION = :institucion
                WHERE u.ID_USUARIO = :estudiante AND u.ROL = 'ESTUDIANTE' AND u.ACTIVO = 'S'
                  AND u.SEMESTRE = :semestre AND ${vigenciaInstitucion}
                  AND (SELECT COUNT(*) FROM ASIGNACION a WHERE a.ID_INSTITUCION = i.ID_INSTITUCION
                       AND a.ESTADO_PRACTICA IN ('EN_CURSO', 'PENDIENTE')) < i.CUPOS_DISPONIBLES
                  AND NOT EXISTS (SELECT 1 FROM ASIGNACION a WHERE a.ID_ESTUDIANTE = u.ID_USUARIO
                                  AND a.ESTADO_PRACTICA IN ('EN_CURSO', 'PENDIENTE'))
            `, { estudiante, semestre, institucion }, { autoCommit: false });
            if (!result.rowsAffected) throw createError(409, 'Verifique el semestre, el tutor activo, la práctica abierta, el cupo y las asignaciones existentes');
        });

        res.json({ success: true, message: 'Asignación registrada y pendiente de aprobación' });
    } catch (err) { next(err); }
}

const vigenciaInstitucion = "i.CONVENIO_ACTIVO = 'S' AND TO_CHAR(i.FECHA_VENC_CONVENIO, 'YYYY-MM-DD') >= TO_CHAR(SYSDATE, 'YYYY-MM-DD')";

async function lockOracleTable(conn, table) {
    if (!['true', '1'].includes(process.env.USE_MOCK_DB)) {
        await conn.execute(`LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE`, {}, { autoCommit: false });
    }
}

async function aprobarAsignacion(req, res, next) {
    try {
        const id = Number(req.body.id_asignacion);
        const estado = req.body.estado;
        if (!Number.isInteger(id) || id < 1 || !['APROBADA', 'RECHAZADA'].includes(estado)) {
            throw createError(400, 'Seleccione una asignación y un estado válidos');
        }
        const result = await executeQuery(`
            UPDATE ASIGNACION SET ESTADO = :estado, ESTADO_APROBACION = :aprobacion, ESTADO_PRACTICA = :estadoPractica
            WHERE ID_ASIGNACION = :id AND ESTADO_APROBACION = 'PENDIENTE' AND ESTADO_PRACTICA = 'PENDIENTE'
        `, { id, estado, aprobacion: estado, estadoPractica: estado === 'APROBADA' ? 'EN_CURSO' : 'RECHAZADA' });
        if (!result.rowsAffected) throw createError(409, 'La asignación ya fue revisada o no existe');
        res.json({ success: true, message: 'Asignación actualizada' });
    } catch (err) { next(err); }
}

/* ── POST /api/director/preguntas-guia (CU-10 Configuración de Preguntas) ─ */
async function guardarPreguntasGuia(req, res, next) {
    try {
        const idPractica = Number(req.body.id_practica || req.body.idPractica);
        let rawVisita = req.body.tipo_visita || req.body.visita || req.body.numero_visita;
        let tipoVisita = null;
        if (rawVisita != null) {
            if (typeof rawVisita === 'string') {
                const m = rawVisita.match(/\d+/);
                tipoVisita = m ? parseInt(m[0], 10) : Number(rawVisita);
            } else {
                tipoVisita = Number(rawVisita);
            }
        }
        const preguntas = req.body.preguntas;

        if (!idPractica || isNaN(idPractica) || !tipoVisita || isNaN(tipoVisita)) {
            throw createError(400, 'Los parámetros id_practica y tipo_visita son obligatorios y deben ser numéricos');
        }

        if (!Array.isArray(preguntas) || preguntas.length === 0) {
            throw createError(400, 'El campo preguntas debe ser una lista (array) no vacía de preguntas guía');
        }

        // Validar existencia de la práctica
        const checkPrac = await executeQuery('SELECT ID_PRACTICA, NOMBRE FROM PRACTICA WHERE ID_PRACTICA = :idPractica', { idPractica });
        if (!checkPrac.rows || checkPrac.rows.length === 0) {
            throw createError(404, `La práctica con ID ${idPractica} no existe en el catálogo institucional`);
        }

        // Eliminar preguntas preexistentes para esta práctica y visita
        await executeQuery('DELETE FROM PREGUNTA_GUIA WHERE ID_PRACTICA = :idPractica AND NUMERO_VISITA = :tipoVisita', { idPractica, tipoVisita });

        // Obtener ID autoincremental seguro para SQLite y Oracle
        let nextId = 1;
        try {
            const maxRes = await executeQuery('SELECT NVL(MAX(ID_PREGUNTA), 0) AS MAX_ID FROM PREGUNTA_GUIA');
            if (maxRes.rows && maxRes.rows[0]) {
                nextId = Number(maxRes.rows[0].MAX_ID || 0) + 1;
            }
        } catch (errMax) {
            nextId = 1;
        }

        let insertedCount = 0;
        for (let idx = 0; idx < preguntas.length; idx++) {
            const item = preguntas[idx];
            const orden = (item && item.orden != null) ? Number(item.orden) : (idx + 1);
            const texto = typeof item === 'string' ? item.trim() : (item && (item.texto || item.texto_pregunta || item.pregunta) ? String(item.texto || item.texto_pregunta || item.pregunta).trim() : '');
            const categoria = (item && item.categoria) ? String(item.categoria).trim() : 'PEDAGOGICA';

            if (!texto) {
                throw createError(400, `La pregunta en la posición ${idx + 1} no cuenta con texto descriptivo`);
            }

            const currentId = nextId++;

            // Insertar en la tabla consolidada PREGUNTA_GUIA (la vista PREGUNTA refleja esto automáticamente)
            await executeQuery(`
                INSERT INTO PREGUNTA_GUIA (ID_PREGUNTA, ID_PREGUNTA_GUIA, ID_PRACTICA, ID_MODALIDAD, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN)
                VALUES (:idPregunta, :idPreguntaGuia, :idPractica, :idModalidad, :tipoVisita, :texto, :categoria, :orden)
            `, {
                idPregunta: currentId,
                idPreguntaGuia: currentId,
                idPractica,
                idModalidad: idPractica,
                tipoVisita,
                texto,
                categoria,
                orden
            });

            insertedCount++;
        }

        res.status(201).json({
            success: true,
            message: `Banco curricular de preguntas guía configurado exitosamente (${insertedCount} preguntas guardadas)`,
            id_practica: idPractica,
            tipo_visita: tipoVisita,
            count: insertedCount,
            total_registradas: insertedCount,
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/director/preguntas-guia ─────────────────────────────────── */
async function getPreguntasGuiaDirector(req, res, next) {
    try {
        const rawPractica = req.params.id_practica || req.query.id_practica || 1;
        let rawVisita = req.params.visita || req.query.tipo_visita || req.query.visita || 1;
        let tipoVisita = 1;
        if (typeof rawVisita === 'string') {
            const m = rawVisita.match(/\d+/);
            tipoVisita = m ? parseInt(m[0], 10) : Number(rawVisita);
        } else {
            tipoVisita = Number(rawVisita);
        }
        const idPractica = Number(rawPractica);

        let rows = [];
        try {
            const resQ = await executeQuery(`
                SELECT ID_PREGUNTA, ID_PRACTICA, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN
                FROM PREGUNTA_GUIA
                WHERE ID_PRACTICA = :idPractica AND NUMERO_VISITA = :tipoVisita
                ORDER BY ORDEN ASC
            `, { idPractica, tipoVisita });
            rows = resQ.rows || [];
        } catch (e) {
            rows = [];
        }

        const mapped = rows.map(r => ({
            id: r.ID_PREGUNTA,
            idPractica: r.ID_PRACTICA,
            visita: r.NUMERO_VISITA,
            pregunta: r.TEXTO_PREGUNTA,
            texto: r.TEXTO_PREGUNTA,
            categoria: r.CATEGORIA || 'PEDAGOGICA',
            orden: r.ORDEN,
        }));

        res.json({
            success: true,
            data: mapped,
            preguntas: mapped,
        });
    } catch (err) {
        next(err);
    }
}

/* ── POST /api/director/cerrar-practica (CU-14 / CU-15) ──────────────── */
async function cerrarPractica(req, res, next) {
    try {
        const idAsignacion = Number(req.body.id_asignacion || req.body.idAsignacion || req.body.id);
        const observaciones = req.body.observaciones || '';
        const estadoFinal = String(req.body.estado_final || 'CERRADA').toUpperCase().trim();

        if (!idAsignacion || isNaN(idAsignacion)) {
            throw createError(400, 'El parámetro id_asignacion es obligatorio');
        }

        // Consultar la asignación con práctica y estudiante
        const asigSql = `
            SELECT a.ID_ASIGNACION, a.HORAS_ACUMULADAS, a.ESTADO_PRACTICA,
                   p.ID_PRACTICA, p.NOMBRE AS PRACTICA, p.HORAS_REQUERIDAS,
                   u.ID_USUARIO AS ID_ESTUDIANTE, u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE,
                   i.NOMBRE AS INSTITUCION
            FROM ASIGNACION a
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            WHERE a.ID_ASIGNACION = :idAsignacion
        `;
        const asigRes = await executeQuery(asigSql, { idAsignacion });
        const asig = asigRes.rows && asigRes.rows.length > 0 ? asigRes.rows[0] : null;

        if (!asig) {
            throw createError(404, `Asignación con ID ${idAsignacion} no encontrada`);
        }

        const horasAcum = Number(asig.HORAS_ACUMULADAS || 0);
        const horasReq = Number(asig.HORAS_REQUERIDAS || 64);

        // Prerrequisito 1: Cumplimiento del 100% de las horas requeridas
        if (horasAcum < horasReq) {
            throw createError(400, `Requisito no cumplido: El estudiante ha acumulado ${horasAcum}h de ${horasReq}h requeridas (se exige 100% para el cierre)`);
        }

        // Prerrequisito 2: Verificar si hay bitácoras pendientes de evaluación
        let bitacoras = [];
        try {
            const bitSql = `
                SELECT ID_BITACORA, ESTADO_REVISION
                FROM BITACORA
                WHERE ID_ASIGNACION = :idAsignacion
            `;
            const bitRes = await executeQuery(bitSql, { idAsignacion });
            bitacoras = bitRes.rows || [];
        } catch (eBit) {
            try {
                const bitRes2 = await executeQuery(`SELECT ID_BITACORA, ESTADO FROM BITACORA WHERE ID_ASIGNACION = :idAsignacion`, { idAsignacion });
                bitacoras = bitRes2.rows || [];
            } catch (eBit2) {
                bitacoras = [];
            }
        }
        const pendientes = bitacoras.filter(b => (b.ESTADO_REVISION || b.ESTADO) === 'PENDIENTE');

        if (pendientes.length > 0) {
            throw createError(400, `No se puede emitir el Acta de Cierre: existen ${pendientes.length} bitácoras pendientes de evaluación`);
        }

        // Calcular calificación definitiva consolidada
        let notaFinal = 5.0;
        try {
            const evalSql = `
                SELECT AVG(e.NOTA) AS PROMEDIO, COUNT(e.ID_EVALUACION) AS TOTAL_EVALS
                FROM EVALUACION e
                JOIN BITACORA b ON e.ID_BITACORA = b.ID_BITACORA
                WHERE b.ID_ASIGNACION = :idAsignacion AND e.NOTA IS NOT NULL
            `;
            const evalRes = await executeQuery(evalSql, { idAsignacion });
            if (evalRes.rows && evalRes.rows[0] && evalRes.rows[0].PROMEDIO != null) {
                notaFinal = Number(Number(evalRes.rows[0].PROMEDIO).toFixed(1));
            }
        } catch (eEval) {
            console.warn('Aviso calculando nota final:', eEval.message);
        }

        // Actualizar asignación a estado cerrado
        const updateSql = `
            UPDATE ASIGNACION
            SET ESTADO_PRACTICA = :estadoFinal,
                ESTADO = :estadoFinal
            WHERE ID_ASIGNACION = :idAsignacion
        `;
        try {
            await executeQuery(updateSql, { estadoFinal, idAsignacion });
        } catch (errUpd) {
            await executeQuery(`UPDATE ASIGNACION SET ESTADO_PRACTICA = :estadoFinal WHERE ID_ASIGNACION = :idAsignacion`, { estadoFinal, idAsignacion });
        }

        const actaId = `ACTA-UDI-${idAsignacion}-${new Date().getFullYear()}`;

        res.json({
            success: true,
            message: 'Práctica académica cerrada exitosamente. Acta final de culminación emitida.',
            acta_id: actaId,
            actaId: actaId,
            id_asignacion: idAsignacion,
            estudiante: (asig.ESTUDIANTE || '').trim(),
            practica: asig.PRACTICA,
            horas_cumplidas: horasAcum,
            horas_requeridas: horasReq,
            porcentaje_cumplimiento: 100,
            nota_final: notaFinal,
            estado: estadoFinal,
            observaciones: observaciones || 'Culminación exitosa de los créditos de práctica pedagógica institucional',
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/director/auditoria/cupos-instituciones ─────────────────── */
async function getAuditoriaCupos(req, res, next) {
    try {
        const instSql = `
            SELECT i.ID_INSTITUCION, i.NOMBRE, i.DIRECCION, i.TELEFONO, i.CONVENIO_ACTIVO,
                   i.CUPOS_DISPONIBLES,
                   TO_CHAR(i.FECHA_VENC_CONVENIO, 'YYYY-MM-DD') AS FECHA_VENC_CONVENIO,
                   COUNT(CASE WHEN a.ESTADO_PRACTICA IN ('EN_CURSO', 'ASIGNADA') THEN a.ID_ASIGNACION END) AS CUPOS_OCUPADOS,
                   COUNT(CASE WHEN a.ESTADO_PRACTICA = 'FINALIZADA' THEN a.ID_ASIGNACION END) AS ESTUDIANTES_FINALIZADOS,
                   NVL(ROUND(AVG(a.HORAS_ACUMULADAS), 1), 0) AS PROMEDIO_HORAS
            FROM INSTITUCION i
            LEFT JOIN ASIGNACION a ON i.ID_INSTITUCION = a.ID_INSTITUCION
            GROUP BY i.ID_INSTITUCION, i.NOMBRE, i.DIRECCION, i.TELEFONO, i.CONVENIO_ACTIVO, i.CUPOS_DISPONIBLES, i.FECHA_VENC_CONVENIO
            ORDER BY i.NOMBRE ASC
        `;
        const asigSql = `
            SELECT a.ID_ASIGNACION, a.ID_INSTITUCION, a.ID_ESTUDIANTE,
                   u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE,
                   u.EMAIL, u.SEMESTRE,
                   p.ID_PRACTICA, p.NOMBRE AS PRACTICA, p.HORAS_REQUERIDAS,
                   NVL(t.NOMBRE || ' ' || NVL(t.APELLIDO, ''), 'Sin tutor') AS TUTOR,
                   a.HORAS_ACUMULADAS, a.ESTADO_PRACTICA
            FROM ASIGNACION a
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            LEFT JOIN USUARIO t ON a.ID_TUTOR = t.ID_USUARIO
            WHERE a.ID_INSTITUCION IS NOT NULL
            ORDER BY u.NOMBRE ASC
        `;

        const [instResult, asigResult] = await Promise.all([
            executeQuery(instSql),
            executeQuery(asigSql)
        ]);

        const asigsPorInstitucion = {};
        for (const a of (asigResult.rows || [])) {
            const instId = Number(a.ID_INSTITUCION);
            if (!asigsPorInstitucion[instId]) asigsPorInstitucion[instId] = [];
            asigsPorInstitucion[instId].push({
                idAsignacion: a.ID_ASIGNACION,
                idEstudiante: a.ID_ESTUDIANTE,
                estudiante: (a.ESTUDIANTE || '').trim(),
                email: a.EMAIL,
                semestre: a.SEMESTRE,
                idPractica: a.ID_PRACTICA,
                practica: a.PRACTICA,
                horasRequeridas: Number(a.HORAS_REQUERIDAS || 64),
                horasAcumuladas: Number(a.HORAS_ACUMULADAS || 0),
                tutor: (a.TUTOR || '').trim(),
                estado: a.ESTADO_PRACTICA
            });
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        let cuposTotales = 0;
        let cuposOcupados = 0;
        let conveniosActivos = 0;
        let conveniosPorVencer = 0;
        let institucionesSaturadas = 0;

        const instituciones = (instResult.rows || []).map(r => {
            const id = Number(r.ID_INSTITUCION);
            const cuposOfertados = Number(r.CUPOS_DISPONIBLES || 0);
            const ocupados = Number(r.CUPOS_OCUPADOS || 0);
            const libres = Math.max(0, cuposOfertados - ocupados);
            const pct = cuposOfertados > 0 ? Math.round((ocupados / cuposOfertados) * 100) : 0;
            const convActivo = r.CONVENIO_ACTIVO === 'S';

            cuposTotales += cuposOfertados;
            cuposOcupados += ocupados;
            if (convActivo) conveniosActivos++;
            if (pct >= 100 && cuposOfertados > 0) institucionesSaturadas++;

            // Días de vigencia del convenio
            let diasRestantes = null;
            let alertaVigencia = 'INACTIVO';
            if (convActivo && r.FECHA_VENC_CONVENIO) {
                const fv = new Date(r.FECHA_VENC_CONVENIO + 'T00:00:00');
                diasRestantes = Math.ceil((fv - hoy) / (1000 * 60 * 60 * 24));
                if (diasRestantes < 0) {
                    alertaVigencia = 'VENCIDO';
                } else if (diasRestantes <= 30) {
                    alertaVigencia = 'POR_VENCER';
                    conveniosPorVencer++;
                } else {
                    alertaVigencia = 'VIGENTE';
                }
            } else if (convActivo) {
                alertaVigencia = 'VIGENTE';
            }

            let alertaCapacidad = 'DISPONIBLE';
            if (ocupados >= cuposOfertados && cuposOfertados > 0) {
                alertaCapacidad = 'SATURADA';
            } else if (pct >= 70) {
                alertaCapacidad = 'ALTA';
            }

            return {
                id,
                nombre: (r.NOMBRE || '').trim(),
                direccion: r.DIRECCION || '',
                telefono: r.TELEFONO || '',
                convenioActivo: convActivo,
                vencimiento: r.FECHA_VENC_CONVENIO || '',
                diasRestantes,
                alertaVigencia,
                cuposTotales: cuposOfertados,
                cuposOcupados: ocupados,
                cuposLibres: libres,
                porcentajeOcupacion: pct,
                alertaCapacidad,
                estudiantesFinalizados: Number(r.ESTUDIANTES_FINALIZADOS || 0),
                promedioHoras: Number(r.PROMEDIO_HORAS || 0),
                practicantes: asigsPorInstitucion[id] || []
            };
        });

        const cuposLibres = Math.max(0, cuposTotales - cuposOcupados);
        const tasaOcupacion = cuposTotales > 0 ? Math.round((cuposOcupados / cuposTotales) * 100) : 0;

        res.json({
            success: true,
            data: {
                resumen: {
                    totalInstituciones: instituciones.length,
                    cuposTotales,
                    cuposOcupados,
                    cuposLibres,
                    tasaOcupacion,
                    conveniosActivos,
                    conveniosPorVencer,
                    institucionesSaturadas
                },
                instituciones
            }
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/director/auditoria/practicantes ────────────────────────── */
async function getAuditoriaPracticantes(req, res, next) {
    try {
        const sql = `
            SELECT a.ID_ASIGNACION, a.ESTADO_PRACTICA, a.HORAS_ACUMULADAS,
                   TO_CHAR(a.FECHA_ASIGNACION, 'YYYY-MM-DD') AS FECHA_ASIGNACION,
                   u.ID_USUARIO AS ID_ESTUDIANTE,
                   u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE,
                   u.EMAIL, u.SEMESTRE,
                   p.ID_PRACTICA, p.NOMBRE AS PRACTICA, p.SEMESTRE AS SEMESTRE_PRACTICA,
                   p.HORAS_REQUERIDAS, p.TIPO AS MODALIDAD,
                   i.ID_INSTITUCION, NVL(i.NOMBRE, 'Sin asignar') AS INSTITUCION,
                   t.ID_USUARIO AS ID_TUTOR,
                   NVL(t.NOMBRE || ' ' || NVL(t.APELLIDO, ''), 'Sin tutor') AS TUTOR,
                   NVL(b_agg.TOTAL_BITACORAS, 0) AS TOTAL_BITACORAS,
                   NVL(b_agg.BITACORAS_CALIFICADAS, 0) AS BITACORAS_CALIFICADAS,
                   NVL(b_agg.BITACORAS_PENDIENTES, 0) AS BITACORAS_PENDIENTES,
                   NVL(b_agg.TOTAL_HORAS_SESION, 0) AS TOTAL_HORAS_SESION,
                   ev_agg.PROMEDIO_TUTOR,
                   ev_agg.PROMEDIO_ASESOR
            FROM ASIGNACION a
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            LEFT JOIN USUARIO t ON a.ID_TUTOR = t.ID_USUARIO
            LEFT JOIN (
                SELECT ID_ASIGNACION,
                       COUNT(ID_BITACORA) AS TOTAL_BITACORAS,
                       COUNT(CASE WHEN ESTADO_REVISION = 'CALIFICADA' THEN 1 END) AS BITACORAS_CALIFICADAS,
                       COUNT(CASE WHEN ESTADO_REVISION = 'PENDIENTE' THEN 1 END) AS BITACORAS_PENDIENTES,
                       SUM(HORAS_SESION) AS TOTAL_HORAS_SESION
                FROM BITACORA
                GROUP BY ID_ASIGNACION
            ) b_agg ON a.ID_ASIGNACION = b_agg.ID_ASIGNACION
            LEFT JOIN (
                SELECT b.ID_ASIGNACION,
                       ROUND(AVG(CASE WHEN e.TIPO_EVALUADOR = 'TUTOR' THEN e.NOTA END), 2) AS PROMEDIO_TUTOR,
                       ROUND(AVG(CASE WHEN e.TIPO_EVALUADOR = 'ASESOR' THEN e.NOTA END), 2) AS PROMEDIO_ASESOR
                FROM EVALUACION e
                JOIN BITACORA b ON e.ID_BITACORA = b.ID_BITACORA
                GROUP BY b.ID_ASIGNACION
            ) ev_agg ON a.ID_ASIGNACION = ev_agg.ID_ASIGNACION
            ORDER BY u.SEMESTRE ASC, u.NOMBRE ASC
        `;

        const result = await executeQuery(sql);
        let rows = result.rows || [];

        if (req.query.semestre) {
            const s = Number(req.query.semestre);
            rows = rows.filter(r => Number(r.SEMESTRE) === s || Number(r.SEMESTRE_PRACTICA) === s);
        }
        if (req.query.id_practica) {
            const pid = Number(req.query.id_practica);
            rows = rows.filter(r => Number(r.ID_PRACTICA) === pid);
        }
        if (req.query.id_institucion) {
            const iid = Number(req.query.id_institucion);
            rows = rows.filter(r => Number(r.ID_INSTITUCION) === iid);
        }

        let totalHorasValidadas = 0;
        let listosParaActa = 0;
        let rezagados = 0;
        let finalizados = 0;

        const practicantes = rows.map(r => {
            const horasAcum = Number(r.HORAS_ACUMULADAS || 0);
            const horasReq = Number(r.HORAS_REQUERIDAS || 64);
            const pct = horasReq > 0 ? Math.min(100, Math.round((horasAcum / horasReq) * 100)) : 0;
            const bitPend = Number(r.BITACORAS_PENDIENTES || 0);
            const bitCal = Number(r.BITACORAS_CALIFICADAS || 0);
            const bitTot = Number(r.TOTAL_BITACORAS || 0);

            totalHorasValidadas += horasAcum;

            let estadoAuditoria = 'EN_CURSO';
            if (r.ESTADO_PRACTICA === 'FINALIZADA') {
                estadoAuditoria = 'FINALIZADA';
                finalizados++;
            } else if (horasAcum >= horasReq && bitPend === 0) {
                estadoAuditoria = 'LISTO_PARA_ACTA';
                listosParaActa++;
            } else if (pct < 40 && horasReq > 0) {
                estadoAuditoria = 'REZAGADO';
                rezagados++;
            }

            let notaDefinitiva = null;
            const notTutor = r.PROMEDIO_TUTOR != null ? Number(r.PROMEDIO_TUTOR) : null;
            const notAsesor = r.PROMEDIO_ASESOR != null ? Number(r.PROMEDIO_ASESOR) : null;
            if (notTutor != null && notAsesor != null) {
                notaDefinitiva = Number(((notTutor + notAsesor) / 2).toFixed(1));
            } else if (notTutor != null) {
                notaDefinitiva = Number(notTutor.toFixed(1));
            } else if (notAsesor != null) {
                notaDefinitiva = Number(notAsesor.toFixed(1));
            }

            return {
                idAsignacion: r.ID_ASIGNACION,
                idEstudiante: r.ID_ESTUDIANTE,
                estudiante: (r.ESTUDIANTE || '').trim(),
                email: r.EMAIL,
                semestre: r.SEMESTRE,
                idPractica: r.ID_PRACTICA,
                practica: r.PRACTICA,
                semestrePractica: r.SEMESTRE_PRACTICA,
                modalidad: r.MODALIDAD,
                horasRequeridas: horasReq,
                horasAcumuladas: horasAcum,
                porcentajeCumplimiento: pct,
                idInstitucion: r.ID_INSTITUCION,
                institucion: (r.INSTITUCION || '').trim(),
                idTutor: r.ID_TUTOR,
                tutor: (r.TUTOR || '').trim(),
                totalBitacoras: bitTot,
                bitacorasCalificadas: bitCal,
                bitacorasPendientes: bitPend,
                horasSesionRegistradas: Number(r.TOTAL_HORAS_SESION || 0),
                promedioTutor: notTutor,
                promedioAsesor: notAsesor,
                notaDefinitiva,
                estadoPractica: r.ESTADO_PRACTICA,
                estadoAuditoria,
                aptoParaActa: horasAcum >= horasReq && bitPend === 0
            };
        });

        res.json({
            success: true,
            data: {
                resumen: {
                    totalPracticantes: practicantes.length,
                    totalHorasValidadas,
                    promedioAvanceGlobal: practicantes.length > 0
                        ? Math.round(practicantes.reduce((sum, p) => sum + p.porcentajeCumplimiento, 0) / practicantes.length)
                        : 0,
                    listosParaActa,
                    rezagados,
                    finalizados
                },
                practicantes
            }
        });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/director/auditoria/consolidado-practicas ───────────────── */
async function getConsolidadoPracticas(req, res, next) {
    try {
        const sql = `
            SELECT p.ID_PRACTICA, p.NOMBRE, p.SEMESTRE, p.TIPO, p.HORAS_REQUERIDAS,
                   p.ESTADO, p.DESCRIPCION, p.ID_TUTOR,
                   NVL(t.NOMBRE || ' ' || NVL(t.APELLIDO, ''), 'Sin tutor docente asignado') AS TUTOR,
                   NVL(m.TOTAL_MATRICULADOS, 0) AS TOTAL_MATRICULADOS,
                   NVL(a_agg.TOTAL_ASIGNADOS, 0) AS TOTAL_ASIGNADOS,
                   NVL(a_agg.TOTAL_HORAS_ACUMULADAS, 0) AS TOTAL_HORAS_ACUMULADAS,
                   NVL(a_agg.TOTAL_FINALIZADOS, 0) AS TOTAL_FINALIZADOS,
                   NVL(a_agg.TOTAL_CUMPLIDOS, 0) AS TOTAL_CUMPLIDOS
            FROM PRACTICA p
            LEFT JOIN USUARIO t ON p.ID_TUTOR = t.ID_USUARIO
            LEFT JOIN (
                SELECT SEMESTRE, COUNT(ID_USUARIO) AS TOTAL_MATRICULADOS
                FROM USUARIO
                WHERE ROL = 'ESTUDIANTE' AND ACTIVO = 'S'
                GROUP BY SEMESTRE
            ) m ON p.SEMESTRE = m.SEMESTRE
            LEFT JOIN (
                SELECT a.ID_PRACTICA,
                       COUNT(a.ID_ASIGNACION) AS TOTAL_ASIGNADOS,
                       SUM(a.HORAS_ACUMULADAS) AS TOTAL_HORAS_ACUMULADAS,
                       COUNT(CASE WHEN a.ESTADO_PRACTICA = 'FINALIZADA' THEN 1 END) AS TOTAL_FINALIZADOS,
                       COUNT(CASE WHEN a.HORAS_ACUMULADAS >= 64 THEN 1 END) AS TOTAL_CUMPLIDOS
                FROM ASIGNACION a
                GROUP BY a.ID_PRACTICA
            ) a_agg ON p.ID_PRACTICA = a_agg.ID_PRACTICA
            ORDER BY p.SEMESTRE ASC, p.ID_PRACTICA ASC
        `;

        const result = await executeQuery(sql);
        const data = (result.rows || []).map(r => {
            const horasReq = Number(r.HORAS_REQUERIDAS || 64);
            const totalAsig = Number(r.TOTAL_ASIGNADOS || 0);
            const matriculados = Number(r.TOTAL_MATRICULADOS || 0);
            const horasTotal = Number(r.TOTAL_HORAS_ACUMULADAS || 0);
            const avgHoras = totalAsig > 0 ? Math.round(horasTotal / totalAsig) : 0;
            const pct = horasReq > 0 ? Math.min(100, Math.round((avgHoras / horasReq) * 100)) : 0;

            return {
                id: r.ID_PRACTICA,
                nombre: (r.NOMBRE || '').trim(),
                semestre: Number(r.SEMESTRE),
                tipo: r.TIPO,
                horas: horasReq,
                estado: r.ESTADO,
                descripcion: r.DESCRIPCION || '',
                idTutor: r.ID_TUTOR,
                tutor: (r.TUTOR || '').trim(),
                totalMatriculados: matriculados,
                totalAsignados: totalAsig,
                sinPlaza: Math.max(0, matriculados - totalAsig),
                totalHorasAcumuladas: horasTotal,
                promedioHoras: avgHoras,
                promedioAvance: pct,
                totalFinalizados: Number(r.TOTAL_FINALIZADOS || 0),
                totalCumplidos: Number(r.TOTAL_CUMPLIDOS || 0)
            };
        });

        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/director/reportes/practica/:id/pdf ─────────────────────── */
async function descargarReportePracticaPdf(req, res, next) {
    try {
        const idPractica = Number(req.params.id);
        if (!Number.isInteger(idPractica) || idPractica <= 0) {
            throw createError(400, 'ID de práctica no válido');
        }

        const pracSql = `
            SELECT p.ID_PRACTICA, p.NOMBRE, p.SEMESTRE, p.TIPO, p.HORAS_REQUERIDAS, p.ESTADO,
                   NVL(t.NOMBRE || ' ' || NVL(t.APELLIDO, ''), 'Sin tutor asignado') AS TUTOR
            FROM PRACTICA p
            LEFT JOIN USUARIO t ON p.ID_TUTOR = t.ID_USUARIO
            WHERE p.ID_PRACTICA = :idPractica
        `;
        const asigSql = `
            SELECT a.ID_ASIGNACION, a.HORAS_ACUMULADAS, a.ESTADO_PRACTICA,
                   u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE,
                   u.EMAIL,
                   NVL(i.NOMBRE, 'Sin asignar') AS INSTITUCION,
                   NVL(b_agg.TOTAL_BITACORAS, 0) AS TOTAL_BITACORAS,
                   NVL(b_agg.BITACORAS_PENDIENTES, 0) AS BITACORAS_PENDIENTES
            FROM ASIGNACION a
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            LEFT JOIN (
                SELECT ID_ASIGNACION,
                       COUNT(ID_BITACORA) AS TOTAL_BITACORAS,
                       COUNT(CASE WHEN ESTADO_REVISION = 'PENDIENTE' THEN 1 END) AS BITACORAS_PENDIENTES
                FROM BITACORA
                GROUP BY ID_ASIGNACION
            ) b_agg ON a.ID_ASIGNACION = b_agg.ID_ASIGNACION
            WHERE a.ID_PRACTICA = :idPractica
            ORDER BY u.NOMBRE ASC
        `;

        const [pracRes, asigRes] = await Promise.all([
            executeQuery(pracSql, { idPractica }),
            executeQuery(asigSql, { idPractica })
        ]);

        if (!pracRes.rows || pracRes.rows.length === 0) {
            throw createError(404, 'La práctica académica solicitada no existe');
        }

        const pRow = pracRes.rows[0];
        const participantes = (asigRes.rows || []).map(a => ({
            id: a.ID_ASIGNACION,
            estudiante: (a.ESTUDIANTE || '').trim(),
            email: a.EMAIL,
            institucion: (a.INSTITUCION || '').trim(),
            horasAcumuladas: Number(a.HORAS_ACUMULADAS || 0),
            horasRequeridas: Number(pRow.HORAS_REQUERIDAS || 64),
            totalBitacoras: Number(a.TOTAL_BITACORAS || 0),
            bitacorasPendientes: Number(a.BITACORAS_PENDIENTES || 0),
            estado: a.ESTADO_PRACTICA
        }));

        const totalHoras = participantes.reduce((s, p) => s + p.horasAcumuladas, 0);
        const promAvance = participantes.length > 0 && pRow.HORAS_REQUERIDAS > 0
            ? Math.round((totalHoras / (participantes.length * Number(pRow.HORAS_REQUERIDAS))) * 100)
            : 0;

        const pdfBuffer = await pdfReportService.generatePracticaReportPdf({
            practica: {
                id: pRow.ID_PRACTICA,
                nombre: (pRow.NOMBRE || '').trim(),
                semestre: pRow.SEMESTRE,
                tipo: pRow.TIPO,
                horas: Number(pRow.HORAS_REQUERIDAS || 64),
                estado: pRow.ESTADO,
                tutor: (pRow.TUTOR || '').trim()
            },
            metricas: {
                totalMatriculados: participantes.length,
                institucionesVinculadas: new Set(participantes.map(p => p.institucion).filter(i => i !== 'Sin asignar')).size,
                totalHoras,
                promedioAvance: promAvance,
                totalBitacoras: participantes.reduce((s, p) => s + p.totalBitacoras, 0),
                bitacorasPendientes: participantes.reduce((s, p) => s + p.bitacorasPendientes, 0)
            },
            participantes
        });

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="informe-practica-${idPractica}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
}

/* ── GET /api/director/reportes/cupos/pdf ─────────────────────────────── */
async function descargarAuditoriaCuposPdf(req, res, next) {
    try {
        const instSql = `
            SELECT i.ID_INSTITUCION, i.NOMBRE, i.DIRECCION, i.CONVENIO_ACTIVO,
                   i.CUPOS_DISPONIBLES,
                   TO_CHAR(i.FECHA_VENC_CONVENIO, 'YYYY-MM-DD') AS FECHA_VENC_CONVENIO,
                   COUNT(CASE WHEN a.ESTADO_PRACTICA IN ('EN_CURSO', 'ASIGNADA') THEN a.ID_ASIGNACION END) AS CUPOS_OCUPADOS
            FROM INSTITUCION i
            LEFT JOIN ASIGNACION a ON i.ID_INSTITUCION = a.ID_INSTITUCION
            GROUP BY i.ID_INSTITUCION, i.NOMBRE, i.DIRECCION, i.CONVENIO_ACTIVO, i.CUPOS_DISPONIBLES, i.FECHA_VENC_CONVENIO
            ORDER BY i.NOMBRE ASC
        `;
        const instRes = await executeQuery(instSql);
        const rows = instRes.rows || [];

        let cuposTotales = 0;
        let cuposOcupados = 0;

        const instituciones = rows.map(r => {
            const tot = Number(r.CUPOS_DISPONIBLES || 0);
            const ocup = Number(r.CUPOS_OCUPADOS || 0);
            cuposTotales += tot;
            cuposOcupados += ocup;
            return {
                id: r.ID_INSTITUCION,
                nombre: (r.NOMBRE || '').trim(),
                direccion: r.DIRECCION || '',
                convenioActivo: r.CONVENIO_ACTIVO,
                vencimiento: r.FECHA_VENC_CONVENIO || '',
                cupos: tot,
                estudiantesAsignados: ocup
            };
        });

        const cuposLibres = Math.max(0, cuposTotales - cuposOcupados);
        const tasaOcupacion = cuposTotales > 0 ? Math.round((cuposOcupados / cuposTotales) * 100) : 0;

        const pdfBuffer = await pdfReportService.generateCuposReportPdf({
            instituciones,
            resumen: {
                cuposTotales,
                cuposOcupados,
                cuposLibres,
                tasaOcupacion
            }
        });

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="auditoria-cupos-instituciones.pdf"',
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
}

/* ── POST / GET /api/director/reportes/acta-cierre-pdf ────────────────── */
async function descargarActaCierreDirecta(req, res, next) {
    try {
        const idAsignacion = Number(req.params.id || (req.body && req.body.id_asignacion) || (req.query && req.query.id_asignacion));
        if (!Number.isInteger(idAsignacion) || idAsignacion <= 0) {
            throw createError(400, 'ID de asignación no válido para emitir Acta');
        }

        const asigSql = `
            SELECT a.ID_ASIGNACION, a.HORAS_ACUMULADAS, a.ESTADO_PRACTICA,
                   u.NOMBRE || ' ' || NVL(u.APELLIDO, '') AS ESTUDIANTE,
                   u.EMAIL,
                   p.NOMBRE AS PRACTICA, p.HORAS_REQUERIDAS,
                   NVL(i.NOMBRE, 'Institución de Práctica') AS INSTITUCION,
                   NVL(t.NOMBRE || ' ' || NVL(t.APELLIDO, ''), 'Docente Tutor') AS TUTOR
            FROM ASIGNACION a
            JOIN USUARIO u ON a.ID_ESTUDIANTE = u.ID_USUARIO
            JOIN PRACTICA p ON a.ID_PRACTICA = p.ID_PRACTICA
            LEFT JOIN INSTITUCION i ON a.ID_INSTITUCION = i.ID_INSTITUCION
            LEFT JOIN USUARIO t ON a.ID_TUTOR = t.ID_USUARIO
            WHERE a.ID_ASIGNACION = :idAsignacion
        `;
        const asigRes = await executeQuery(asigSql, { idAsignacion });
        if (!asigRes.rows || asigRes.rows.length === 0) {
            throw createError(404, 'Asignación no encontrada');
        }

        const asig = asigRes.rows[0];
        const horasAcum = Number(asig.HORAS_ACUMULADAS || 0);
        const horasReq = Number(asig.HORAS_REQUERIDAS || 64);

        // Validar bitácoras pendientes
        const bitSql = `
            SELECT ID_BITACORA FROM BITACORA
            WHERE ID_ASIGNACION = :idAsignacion AND ESTADO_REVISION = 'PENDIENTE'
        `;
        const bitRes = await executeQuery(bitSql, { idAsignacion });
        const pendientes = (bitRes.rows || []).length;
        if (pendientes > 0) {
            throw createError(400, `No se puede generar el Acta de Cierre: existen ${pendientes} bitácoras pendientes de calificación`);
        }

        let notaFinal = (req.body && req.body.nota_final) ? Number(req.body.nota_final) : 5.0;
        try {
            const evSql = `
                SELECT AVG(e.NOTA) AS PROMEDIO
                FROM EVALUACION e
                JOIN BITACORA b ON e.ID_BITACORA = b.ID_BITACORA
                WHERE b.ID_ASIGNACION = :idAsignacion AND e.NOTA IS NOT NULL
            `;
            const evRes = await executeQuery(evSql, { idAsignacion });
            if (evRes.rows && evRes.rows[0] && evRes.rows[0].PROMEDIO != null) {
                notaFinal = Number(Number(evRes.rows[0].PROMEDIO).toFixed(1));
            }
        } catch (eEv) {
            // fallback
        }

        const pdfBuffer = await pdfReportService.generateClosureActPdf({
            id_asignacion: idAsignacion,
            estudiante: {
                nombre: (asig.ESTUDIANTE || '').trim(),
                email: asig.EMAIL
            },
            tutor: {
                nombre: (asig.TUTOR || '').trim()
            },
            institucion: {
                nombre: (asig.INSTITUCION || '').trim()
            },
            horas_cumplidas: horasAcum,
            total_horas_requeridas: horasReq,
            nota_final: notaFinal,
            fecha_cierre: new Date().toISOString().split('T')[0]
        });

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="acta-cierre-${idAsignacion}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
}

/* ── POST /api/v1/reports/visita-pdf ─────────────────────────────────── */
async function descargarReporteVisitaDirecto(req, res, next) {
    try {
        const payload = req.body || {};
        const pdfBuffer = await pdfReportService.generateVisitReportPdf(payload);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="informe-visita-${payload.visita || 1}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getKpis,
    getPracticas,
    getInstituciones,
    getEstudiantes,
    getTutores,
    getConteoEstudiantesPorSemestre,
    asignarTutorPractica,
    eliminarPractica,
    eliminarInstitucion,
    aprobarAsignacion,
    getAsignaciones,
    cambiarEstado,
    nuevaPractica,
    nuevaInstitucion,
    asignarEstudiante,
    guardarPreguntasGuia,
    getPreguntasGuiaDirector,
    cerrarPractica,
    getAuditoriaCupos,
    getAuditoriaPracticantes,
    getConsolidadoPracticas,
    descargarReportePracticaPdf,
    descargarAuditoriaCuposPdf,
    descargarActaCierreDirecta,
    descargarReporteVisitaDirecto,
};
