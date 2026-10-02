/**
 * SIGPA — DirectorController (Oracle 10g)
 *
 * Endpoints:
 *   GET  /api/director/kpis
 *   GET  /api/director/estado        (prácticas)
 *   GET  /api/director/instituciones
 *   GET  /api/director/usuarios
 *   POST /api/director/nuevo_usuario
 *   POST /api/director/cambiar_estado_usuario
 *   GET  /api/director/asignaciones
 *   POST /api/director/cambiar_estado
 *   POST /api/director/nueva_practica
 *   POST /api/director/nueva_institucion
 *   POST /api/director/asignar
 */
'use strict';

const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/database');
const { createError } = require('../middlewares/errorHandler');

/* ── GET /api/director/kpis ──────────────────────────────────────────── */
async function getKpis(req, res, next) {
    try {
        const estRes = await executeQuery(`SELECT COUNT(*) AS CNT FROM USUARIO WHERE ROL = 'ESTUDIANTE' AND ACTIVO = 'S'`);
        const totalEstudiantes = estRes.rows[0].CNT || 0;

        const hrsRes = await executeQuery(`SELECT NVL(SUM(HORAS_ACUMULADAS), 0) AS HRS FROM ASIGNACION`);
        const totalHoras = Number(hrsRes.rows[0].HRS || 0);

        const instRes = await executeQuery(`
            SELECT COUNT(*) AS CNT, NVL(SUM(CUPOS_DISPONIBLES), 0) AS CUP
            FROM INSTITUCION
            WHERE CONVENIO_ACTIVO = 'S'
        `);
        const conveniosActivos = instRes.rows[0].CNT || 0;
        const cuposDisponibles = Number(instRes.rows[0].CUP || 0);

        const pracRes = await executeQuery(`SELECT COUNT(*) AS CNT FROM PRACTICA WHERE ESTADO = 'ABIERTA'`);
        const practicasAbiertas = pracRes.rows[0].CNT || 0;

        res.json({
            success: true,
            data: {
                totalEstudiantes,
                totalHoras,
                conveniosActivos,
                cuposDisponibles,
                practicasAbiertas,
            },
        });
    } catch (err) { next(err); }
}

/* ── GET /api/director/estado  (prácticas) ───────────────────────────── */
async function getPracticas(req, res, next) {
    try {
        const sql = `
            SELECT p.ID_PRACTICA, p.SEMESTRE, p.TIPO, p.HORAS_REQUERIDAS,
                   p.NOMBRE, p.ESTADO, p.DESCRIPCION,
                   (SELECT COUNT(*) FROM ASIGNACION a WHERE a.ID_PRACTICA = p.ID_PRACTICA) AS TOTAL_ESTUDIANTES
            FROM PRACTICA p
            ORDER BY p.SEMESTRE ASC
        `;
        const result = await executeQuery(sql);

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id:               r.ID_PRACTICA,
                semestre:         r.SEMESTRE,
                tipo:             r.TIPO,
                horas:            r.HORAS_REQUERIDAS,
                nombre:           r.NOMBRE,
                estado:           r.ESTADO,
                descripcion:      r.DESCRIPCION || '',
                totalEstudiantes: r.TOTAL_ESTUDIANTES || 0,
            })),
        });
    } catch (err) { next(err); }
}

/* ── GET /api/director/instituciones ─────────────────────────────────── */
async function getInstituciones(req, res, next) {
    try {
        const sql = `
            SELECT ID_INSTITUCION, NOMBRE, DIRECCION, TELEFONO,
                   CONVENIO_ACTIVO, CUPOS_DISPONIBLES,
                   TO_CHAR(FECHA_VENC_CONVENIO, 'YYYY-MM-DD') AS FECHA_VENC_CONVENIO,
                   (SELECT COUNT(*) FROM ASIGNACION a WHERE a.ID_INSTITUCION = i.ID_INSTITUCION) AS ESTUDIANTES_ASIGNADOS
            FROM INSTITUCION i
            ORDER BY i.NOMBRE ASC
        `;
        const result = await executeQuery(sql);

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id:                  r.ID_INSTITUCION,
                nombre:              r.NOMBRE,
                direccion:           r.DIRECCION || '',
                telefono:            r.TELEFONO || '',
                convenioActivo:      r.CONVENIO_ACTIVO,
                cupos:               r.CUPOS_DISPONIBLES,
                vencimiento:         r.FECHA_VENC_CONVENIO || '2027-12-31',
                estudiantesAsignados:r.ESTUDIANTES_ASIGNADOS || 0,
            })),
        });
    } catch (err) { next(err); }
}

/* ── GET /api/director/usuarios ──────────────────────────────────────── */
async function getUsuarios(req, res, next) {
    try {
        const sql = `
            SELECT ID_USUARIO, NOMBRE, APELLIDO, EMAIL, ROL, ACTIVO
            FROM USUARIO
            ORDER BY ID_USUARIO ASC
        `;
        const result = await executeQuery(sql);

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id:       r.ID_USUARIO,
                nombre:   `${r.NOMBRE || ''} ${r.APELLIDO || ''}`.trim(),
                nombres:  r.NOMBRE || '',
                apellidos:r.APELLIDO || '',
                email:    r.EMAIL,
                rol:      r.ROL,
                activo:   r.ACTIVO || 'S',
            })),
        });
    } catch (err) { next(err); }
}

/* ── POST /api/director/nuevo_usuario ────────────────────────────────── */
async function nuevoUsuario(req, res, next) {
    try {
        const { nombre, apellido, email, contrasena, rol } = req.body;
        if (!nombre || !email || !contrasena || !rol) {
            throw createError(400, 'Todos los campos (nombre, email, contraseña, rol) son obligatorios');
        }

        const validRoles = ['DIRECTOR', 'TUTOR', 'ASESOR', 'ESTUDIANTE'];
        const rolUpper = rol.toUpperCase().trim();
        if (!validRoles.includes(rolUpper)) {
            throw createError(400, `Rol no válido. Debe ser uno de: ${validRoles.join(', ')}`);
        }

        const cleanEmail = email.toLowerCase().trim();

        // Validar unicidad del correo
        const checkSql = `SELECT COUNT(*) AS CNT FROM USUARIO WHERE LOWER(EMAIL) = :email`;
        const checkRes = await executeQuery(checkSql, { email: cleanEmail });
        if (checkRes.rows[0].CNT > 0) {
            throw createError(400, `El correo ${cleanEmail} ya se encuentra registrado en el sistema`);
        }

        // Cifrado unidireccional de la contraseña con bcrypt
        const hashedPassword = await bcrypt.hash(contrasena.trim(), 10);

        const insertSql = `
            INSERT INTO USUARIO (ID_USUARIO, NOMBRE, APELLIDO, EMAIL, CONTRASENA, ROL, ACTIVO)
            VALUES ((SELECT NVL(MAX(ID_USUARIO), 0) + 1 FROM USUARIO), :nombre, :apellido, :email, :contrasena, :rol, 'S')
        `;
        await executeQuery(insertSql, {
            nombre: nombre.trim(),
            apellido: (apellido || '').trim(),
            email: cleanEmail,
            contrasena: hashedPassword,
            rol: rolUpper,
        });

        res.json({
            success: true,
            message: `Cuenta para ${rolUpper} (${cleanEmail}) creada exitosamente en SIGPA`
        });
    } catch (err) { next(err); }
}

/* ── POST /api/director/cambiar_estado_usuario ───────────────────────── */
async function cambiarEstadoUsuario(req, res, next) {
    try {
        const { id, activo } = req.body;
        if (!id || !activo) throw createError(400, 'Faltan parámetros id o activo');

        const estadoUpper = activo.toUpperCase().trim();
        if (!['S', 'N'].includes(estadoUpper)) {
            throw createError(400, "El estado debe ser 'S' (Activo) o 'N' (Inactivo)");
        }

        const sql = `UPDATE USUARIO SET ACTIVO = :activo WHERE ID_USUARIO = :id`;
        await executeQuery(sql, { activo: estadoUpper, id: Number(id) });

        res.json({
            success: true,
            message: `Estado de usuario actualizado a: ${estadoUpper === 'S' ? 'Activo' : 'Inactivo'}`
        });
    } catch (err) { next(err); }
}

/* ── GET /api/director/asignaciones ─────────────────────────────────── */
async function getAsignaciones(req, res, next) {
    try {
        const sql = `
            SELECT a.ID_ASIGNACION, a.HORAS_ACUMULADAS, a.ESTADO_PRACTICA,
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
                id:               r.ID_ASIGNACION,
                estudiante:       (r.ESTUDIANTE || '').trim(),
                tutor:            (r.TUTOR || '').trim(),
                practica:         r.PRACTICA,
                institucion:      r.INSTITUCION || '',
                horasAcumuladas:  Number(r.HORAS_ACUMULADAS || 0),
                horasRequeridas:  r.HORAS_REQUERIDAS,
                estado:           r.ESTADO_PRACTICA,
                fecha:            r.FECHA_ASIGNACION || '',
            })),
        });
    } catch (err) { next(err); }
}

/* ── POST /api/director/cambiar_estado ───────────────────────────────── */
async function cambiarEstado(req, res, next) {
    try {
        const { id, estado } = req.body;
        if (!id || !estado) throw createError(400, 'Faltan parámetros id o estado');

        const sql = `UPDATE PRACTICA SET ESTADO = :estado WHERE ID_PRACTICA = :id`;
        await executeQuery(sql, { estado, id: Number(id) });

        res.json({ success: true, message: 'Estado actualizado correctamente' });
    } catch (err) { next(err); }
}

/* ── POST /api/director/nueva_practica ───────────────────────────────── */
async function nuevaPractica(req, res, next) {
    try {
        const { nombre, semestre, tipo, horas, descripcion } = req.body;
        if (!nombre || !semestre || !horas) throw createError(400, 'Faltan datos de la práctica');

        const sql = `
            INSERT INTO PRACTICA (ID_PRACTICA, NOMBRE, SEMESTRE, TIPO, HORAS_REQUERIDAS, ESTADO, DESCRIPCION)
            VALUES ((SELECT NVL(MAX(ID_PRACTICA), 0) + 1 FROM PRACTICA), :nombre, :semestre, :tipo, :horas, 'ABIERTA', :descripcion)
        `;
        await executeQuery(sql, {
            nombre,
            semestre: Number(semestre),
            tipo: tipo || 'INVESTIGATIVA',
            horas: Number(horas),
            descripcion: descripcion || '',
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
        const { id_estudiante, id_tutor, id_practica, id_institucion } = req.body;

        if (!id_estudiante || !id_practica || !id_institucion) {
            throw createError(400, 'Faltan datos de asignación obligatorios');
        }

        const idInst = Number(id_institucion);

        /* Validar institución en Oracle: convenio activo y cupos disponibles */
        const valSql = `
            SELECT CONVENIO_ACTIVO, CUPOS_DISPONIBLES,
                   (SELECT COUNT(*) FROM ASIGNACION WHERE ID_INSTITUCION = :idInst AND ESTADO_PRACTICA = 'EN_CURSO') AS OCUPADOS
            FROM INSTITUCION
            WHERE ID_INSTITUCION = :idInst
        `;
        const instRes = await executeQuery(valSql, { idInst });
        const inst = instRes.rows && instRes.rows.length > 0 ? instRes.rows[0] : null;

        if (!inst) throw createError(400, 'La institución no existe');
        if (inst.CONVENIO_ACTIVO !== 'S') {
            throw createError(400, 'Bloqueo normativo: La institución no cuenta con convenio activo vigente');
        }
        if (inst.OCUPADOS >= inst.CUPOS_DISPONIBLES) {
            throw createError(400, `Bloqueo de cupos: La institución ya alcanzó el límite máximo (${inst.CUPOS_DISPONIBLES})`);
        }

        // Insertar en ASIGNACION poblando tanto ID_USUARIO como ID_ESTUDIANTE para compatibilidad total con el esquema Oracle
        const insertSql = `
            INSERT INTO ASIGNACION (
                ID_ASIGNACION, ID_USUARIO, ID_ESTUDIANTE, ID_TUTOR, ID_PRACTICA, ID_INSTITUCION,
                HORAS_ACUMULADAS, ESTADO, ESTADO_PRACTICA, FECHA_ASIGNACION
            )
            VALUES (
                (SELECT NVL(MAX(ID_ASIGNACION), 0) + 1 FROM ASIGNACION),
                :idEstudiante, :idEstudiante, :idTutor, :idPractica, :idInstitucion,
                0.0, 'APROBADA', 'EN_CURSO', SYSDATE
            )
        `;
        try {
            await executeQuery(insertSql, {
                idEstudiante: Number(id_estudiante),
                idTutor: id_tutor ? Number(id_tutor) : null,
                idPractica: Number(id_practica),
                idInstitucion: idInst,
            });
        } catch (errInsert) {
            // Si la columna ID_USUARIO o ESTADO no existiera en alguna versión alterna del esquema (ORA-00904), reintentar sin ella
            if (errInsert.message && errInsert.message.includes('ORA-00904')) {
                const fallbackSql = `
                    INSERT INTO ASIGNACION (
                        ID_ASIGNACION, ID_ESTUDIANTE, ID_TUTOR, ID_PRACTICA, ID_INSTITUCION,
                        HORAS_ACUMULADAS, ESTADO_PRACTICA, FECHA_ASIGNACION
                    )
                    VALUES (
                        (SELECT NVL(MAX(ID_ASIGNACION), 0) + 1 FROM ASIGNACION),
                        :idEstudiante, :idTutor, :idPractica, :idInstitucion,
                        0.0, 'EN_CURSO', SYSDATE
                    )
                `;
                await executeQuery(fallbackSql, {
                    idEstudiante: Number(id_estudiante),
                    idTutor: id_tutor ? Number(id_tutor) : null,
                    idPractica: Number(id_practica),
                    idInstitucion: idInst,
                });
            } else {
                throw errInsert;
            }
        }

        res.json({ success: true, message: 'Estudiante asignado formalmente a la institución y práctica' });
    } catch (err) { next(err); }
}

module.exports = {
    getKpis,
    getPracticas,
    getInstituciones,
    getUsuarios,
    nuevoUsuario,
    cambiarEstadoUsuario,
    getAsignaciones,
    cambiarEstado,
    nuevaPractica,
    nuevaInstitucion,
    asignarEstudiante,
};
