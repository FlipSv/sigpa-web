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
                   (SELECT COUNT(*) FROM ASIGNACION a WHERE a.ID_PRACTICA = p.ID_PRACTICA) AS TOTAL_ESTUDIANTES
            FROM PRACTICA p
            LEFT JOIN INSTITUCION i ON i.ID_INSTITUCION = p.ID_INSTITUCION
            WHERE p.SEMESTRE IN (1, 2, 3)
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
                totalEstudiantes: r.TOTAL_ESTUDIANTES || 0,
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
            })),
        });
    } catch (err) { next(err); }
}

async function getEstudiantes(req, res, next) {
    try {
        const semestre = Number(req.query.semestre);
        if (![1, 2, 3].includes(semestre)) throw createError(400, 'Seleccione un semestre válido');
        const result = await executeQuery(`
            SELECT ID_USUARIO, NOMBRE, APELLIDO FROM USUARIO
            WHERE ROL = 'ESTUDIANTE' AND ACTIVO = 'S' AND SEMESTRE = :semestre
            ORDER BY NOMBRE, APELLIDO
        `, { semestre });
        res.json({ success: true, data: result.rows.map(row => ({
            id: row.ID_USUARIO,
            nombre: `${row.NOMBRE} ${(row.APELLIDO || '').replace(/ \(Estudiante\)$/, '')}`.trim(),
            semestre,
        })) });
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

        const sql = `UPDATE PRACTICA SET ESTADO = :estado WHERE ID_PRACTICA = :id`;
        const result = await executeQuery(sql, { estado, id: Number(id) });
        if (!result.rowsAffected) throw createError(404, 'La práctica no existe');

        res.json({ success: true, message: 'Estado actualizado correctamente' });
    } catch (err) { next(err); }
}

/* ── POST /api/director/nueva_practica ───────────────────────────────── */
async function nuevaPractica(req, res, next) {
    try {
        const semestre = Number(req.body.semestre);
        const institucion = Number(req.body.id_institucion);
        const horas = Number(req.body.horas);
        const tipo = req.body.tipo;
        const modalidades = ['OBSERVACION', 'INTERVENCION', 'DOCENTE', 'INVESTIGATIVA', 'PROFESIONAL'];
        if (![1, 2, 3].includes(semestre) || !Number.isInteger(institucion) || institucion < 1 ||
            !Number.isInteger(horas) || horas < 1 || !modalidades.includes(tipo)) {
            throw createError(400, 'Seleccione semestre, institución, modalidad y horas válidos');
        }

        await executeTransaction(async conn => {
            await lockOracleTable(conn, 'PRACTICA');
            const result = await conn.execute(`
                INSERT INTO PRACTICA (ID_PRACTICA, NOMBRE, SEMESTRE, TIPO, HORAS_REQUERIDAS, ESTADO, ID_INSTITUCION)
                SELECT (SELECT NVL(MAX(ID_PRACTICA), 0) + 1 FROM PRACTICA), :nombre,
                       :semestre, :tipo, :horas, 'ABIERTA', i.ID_INSTITUCION
                FROM INSTITUCION i
                WHERE i.ID_INSTITUCION = :institucion AND ${vigenciaInstitucion}
                  AND NOT EXISTS (SELECT 1 FROM PRACTICA p
                                  WHERE p.SEMESTRE = :semestreExistente AND p.ID_INSTITUCION = i.ID_INSTITUCION)
                  AND (SELECT COUNT(*) FROM PRACTICA p WHERE p.SEMESTRE = :semestreLimite) <
                      (SELECT COUNT(*) FROM INSTITUCION i WHERE ${vigenciaInstitucion})
            `, { nombre: `Práctica ${semestre}`, semestre, semestreExistente: semestre, semestreLimite: semestre, tipo, horas, institucion }, { autoCommit: false });
            if (!result.rowsAffected) throw createError(409, 'Institución sin convenio vigente o límite de prácticas alcanzado para ese semestre');
        });

        res.json({ success: true, message: 'Práctica creada con éxito' });
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
                JOIN USUARIO t ON t.SEMESTRE = u.SEMESTRE AND t.ROL = 'TUTOR' AND t.ACTIVO = 'S'
                JOIN PRACTICA p ON p.SEMESTRE = u.SEMESTRE AND p.ESTADO = 'ABIERTA'
                JOIN INSTITUCION i ON i.ID_INSTITUCION = p.ID_INSTITUCION
                WHERE u.ID_USUARIO = :estudiante AND u.ROL = 'ESTUDIANTE' AND u.ACTIVO = 'S'
                  AND u.SEMESTRE = :semestre AND i.ID_INSTITUCION = :institucion AND ${vigenciaInstitucion}
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

module.exports = {
    getKpis,
    getPracticas,
    getInstituciones,
    getEstudiantes,
    aprobarAsignacion,
    getAsignaciones,
    cambiarEstado,
    nuevaPractica,
    nuevaInstitucion,
    asignarEstudiante,
};
