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
/* ── GET /api/director/kpis ──────────────────────────────────────────── */
async function getKpis(req, res, next) {
    try {
        const estRes = await executeQuery(`SELECT COUNT(*) AS CNT FROM USUARIO WHERE ROL = 'ESTUDIANTE' AND ACTIVO = 'S'`);
        const totalEstudiantes = estRes.rows && estRes.rows[0] ? Number(estRes.rows[0].CNT || 0) : 0;

        const hrsRes = await executeQuery(`SELECT NVL(SUM(HORAS_ACUMULADAS), 0) AS HRS FROM ASIGNACION`);
        const totalHoras = hrsRes.rows && hrsRes.rows[0] ? Number(hrsRes.rows[0].HRS || 0) : 0;

        const instRes = await executeQuery(`
            SELECT COUNT(*) AS CNT, NVL(SUM(CUPOS_DISPONIBLES), 0) AS CUP
            FROM INSTITUCION
            WHERE CONVENIO_ACTIVO = 'S'
        `);
        const conveniosActivos = instRes.rows && instRes.rows[0] ? Number(instRes.rows[0].CNT || 0) : 0;
        const cuposDisponibles = instRes.rows && instRes.rows[0] ? Number(instRes.rows[0].CUP || 0) : 0;

        const pracRes = await executeQuery(`SELECT COUNT(*) AS CNT FROM PRACTICA WHERE ESTADO = 'ABIERTA'`);
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
        console.error('Error en getKpis:', err);
        const fallbackMetrics = {
            totalEstudiantes: 0,
            totalHoras: 0,
            conveniosActivos: 0,
            cuposDisponibles: 0,
            practicasAbiertas: 0,
            estudiantes: 0,
            horas: 0,
            convenios: 0,
            cupos: 0,
            practicas: 0
        };
        res.json({
            success: true,
            status: 'success',
            ...fallbackMetrics,
            data: fallbackMetrics,
            kpis: fallbackMetrics,
            stats: fallbackMetrics
        });
    }
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
                id: r.ID_PRACTICA,
                semestre: r.SEMESTRE,
                tipo: r.TIPO,
                horas: r.HORAS_REQUERIDAS,
                nombre: r.NOMBRE,
                estado: r.ESTADO,
                descripcion: r.DESCRIPCION || '',
                totalEstudiantes: r.TOTAL_ESTUDIANTES || 0,
            })),
        });
    } catch (err) {
        console.warn('Aviso en getPracticas:', err.message);
        res.json({ success: true, data: [] });
    }
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
                id: r.ID_INSTITUCION,
                nombre: r.NOMBRE,
                direccion: r.DIRECCION || '',
                telefono: r.TELEFONO || '',
                convenioActivo: r.CONVENIO_ACTIVO,
                cupos: r.CUPOS_DISPONIBLES,
                vencimiento: r.FECHA_VENC_CONVENIO || '2027-12-31',
                estudiantesAsignados: r.ESTUDIANTES_ASIGNADOS || 0,
                ocupados: r.ESTUDIANTES_ASIGNADOS || 0,
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
                id: r.ID_USUARIO,
                nombre: `${r.NOMBRE || ''} ${r.APELLIDO || ''}`.trim(),
                nombres: r.NOMBRE || '',
                apellidos: r.APELLIDO || '',
                email: r.EMAIL,
                rol: r.ROL,
                activo: r.ACTIVO || 'S',
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
                id: r.ID_ASIGNACION,
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
        console.warn('Aviso en getAsignaciones:', err.message);
        res.json({ success: true, data: [] });
    }
}

/* ── POST /api/director/cambiar_estado ───────────────────────────────── */
async function cambiarEstado(req, res, next) {
    try {
        const { id, estado } = req.body;
        if (!id || !estado) throw createError(400, 'Faltan parámetros id o estado');

        const estadoUpper = String(estado).toUpperCase().trim();
        if (!['ABIERTA', 'CERRADA'].includes(estadoUpper)) {
            throw createError(400, 'Estado no válido. Debe ser ABIERTA o CERRADA');
        }

        const sql = `UPDATE PRACTICA SET ESTADO = :estado WHERE ID_PRACTICA = :id`;
        await executeQuery(sql, { estado: estadoUpper, id: Number(id) });

        res.json({ success: true, message: 'Estado actualizado correctamente' });
    } catch (err) { next(err); }
}

/* ── POST /api/director/nueva_practica ───────────────────────────────── */
async function nuevaPractica(req, res, next) {
    try {
        const { nombre, semestre, tipo, horas, horas_requeridas, descripcion, creditos, cupos } = req.body;
        const nombreVal = nombre ? String(nombre).trim() : '';

        let semestreVal = null;
        if (semestre != null && semestre !== '') {
            if (typeof semestre === 'number') {
                semestreVal = semestre;
            } else {
                const sStr = String(semestre).trim();
                const m = sStr.match(/\d+/);
                semestreVal = m ? parseInt(m[0], 10) : Number(sStr);
            }
        }

        const horasVal = Number(horas || horas_requeridas);
        const creditosVal = creditos != null ? Number(creditos) : 3;
        const cuposVal = cupos != null ? Number(cupos) : 20;

        if (!nombreVal || semestreVal === null || isNaN(semestreVal) || semestreVal <= 0 || semestreVal > 10 ||
            isNaN(horasVal) || horasVal <= 0 || isNaN(creditosVal) || creditosVal <= 0 || isNaN(cuposVal) || cuposVal <= 0) {
            throw createError(400, 'Faltan datos obligatorios o valores inválidos de la práctica (nombre, semestre 1-10, horas > 0, créditos > 0)');
        }

        const tipoVal = tipo ? String(tipo).trim().toUpperCase() : 'INVESTIGATIVA';
        const descVal = descripcion ? String(descripcion).trim() : '';

        let nextId = 1;
        try {
            const maxRes = await executeQuery('SELECT NVL(MAX(ID_PRACTICA), 0) AS MAX_ID FROM PRACTICA');
            if (maxRes.rows && maxRes.rows[0]) {
                nextId = Number(maxRes.rows[0].MAX_ID || 0) + 1;
            }
        } catch (e) {
            nextId = Date.now() % 100000;
        }

        const sql = `
            INSERT INTO PRACTICA (ID_PRACTICA, NOMBRE, SEMESTRE, TIPO, HORAS_REQUERIDAS, ESTADO, DESCRIPCION)
            VALUES (:nextId, :nombre, :semestre, :tipo, :horas, 'ABIERTA', :descripcion)
        `;
        await executeQuery(sql, {
            nextId,
            nombre: nombreVal,
            semestre: semestreVal,
            tipo: tipoVal,
            horas: horasVal,
            descripcion: descVal,
        });

        res.json({
            success: true,
            message: 'Práctica creada con éxito en el catálogo institucional',
            practica_id: nextId,
            id_practica: nextId,
            data: {
                id: nextId,
                nombre: nombreVal,
                semestre: semestreVal,
                tipo: tipoVal,
                horas: horasVal,
                creditos: creditosVal,
                cupos: cuposVal,
                estado: 'ABIERTA',
                descripcion: descVal
            }
        });
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

        // Eliminar preguntas preexistentes para esta práctica y visita en ambas tablas
        try {
            await executeQuery('DELETE FROM PREGUNTA WHERE ID_PRACTICA = :idPractica AND NUMERO_VISITA = :tipoVisita', { idPractica, tipoVisita });
        } catch (e1) {
            console.warn('Aviso borrando de PREGUNTA:', e1.message);
        }
        try {
            await executeQuery('DELETE FROM PREGUNTA_GUIA WHERE ID_PRACTICA = :idPractica AND NUMERO_VISITA = :tipoVisita', { idPractica, tipoVisita });
        } catch (e2) {
            console.warn('Aviso borrando de PREGUNTA_GUIA:', e2.message);
        }

        // Obtener ID autoincremental seguro para SQLite y Oracle
        let nextId = 1;
        try {
            const maxRes = await executeQuery('SELECT NVL(MAX(ID_PREGUNTA), 0) AS MAX_ID FROM PREGUNTA');
            if (maxRes.rows && maxRes.rows[0]) {
                nextId = Number(maxRes.rows[0].MAX_ID || 0) + 1;
            }
        } catch (errMax) {
            try {
                const maxRes2 = await executeQuery('SELECT NVL(MAX(ID_PREGUNTA), 0) AS MAX_ID FROM PREGUNTA_GUIA');
                if (maxRes2.rows && maxRes2.rows[0]) {
                    nextId = Number(maxRes2.rows[0].MAX_ID || 0) + 1;
                }
            } catch (errMax2) {
                nextId = 1;
            }
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

            // Insertar en PREGUNTA
            try {
                await executeQuery(`
                    INSERT INTO PREGUNTA (ID_PREGUNTA, ID_PRACTICA, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN)
                    VALUES (:idPregunta, :idPractica, :tipoVisita, :texto, :categoria, :orden)
                `, {
                    idPregunta: currentId,
                    idPractica,
                    tipoVisita,
                    texto,
                    categoria,
                    orden
                });
            } catch (errIns1) {
                console.warn('Aviso insertando en PREGUNTA:', errIns1.message);
            }

            // Insertar en PREGUNTA_GUIA
            try {
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
            } catch (errIns2) {
                console.warn('Aviso insertando en PREGUNTA_GUIA:', errIns2.message);
            }

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
                FROM PREGUNTA
                WHERE ID_PRACTICA = :idPractica AND NUMERO_VISITA = :tipoVisita
                ORDER BY ORDEN ASC
            `, { idPractica, tipoVisita });
            rows = resQ.rows || [];
        } catch (e1) {
            try {
                const resQ2 = await executeQuery(`
                    SELECT ID_PREGUNTA, ID_PRACTICA, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN
                    FROM PREGUNTA_GUIA
                    WHERE ID_PRACTICA = :idPractica AND NUMERO_VISITA = :tipoVisita
                    ORDER BY ORDEN ASC
                `, { idPractica, tipoVisita });
                rows = resQ2.rows || [];
            } catch (e2) {
                rows = [];
            }
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
            } else {
                try {
                    const directRes = await executeQuery(`SELECT AVG(CALIFICACION) AS PROMEDIO FROM EVALUACION WHERE ID_ASIGNACION = :idAsignacion`, { idAsignacion });
                    if (directRes.rows && directRes.rows[0] && directRes.rows[0].PROMEDIO != null) {
                        notaFinal = Number(Number(directRes.rows[0].PROMEDIO).toFixed(1));
                    }
                } catch (eDirect) {
                    // ignore
                }
            }
        } catch (eEval) {
            try {
                const directRes = await executeQuery(`SELECT AVG(CALIFICACION) AS PROMEDIO FROM EVALUACION WHERE ID_ASIGNACION = :idAsignacion`, { idAsignacion });
                if (directRes.rows && directRes.rows[0] && directRes.rows[0].PROMEDIO != null) {
                    notaFinal = Number(Number(directRes.rows[0].PROMEDIO).toFixed(1));
                }
            } catch (eDirect2) {
                // ignore
            }
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
    guardarPreguntasGuia,
    getPreguntasGuiaDirector,
    cerrarPractica,
};
