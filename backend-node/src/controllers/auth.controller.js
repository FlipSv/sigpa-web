/**
 * SIGPA — AuthController (Oracle 10g)
 * Migrado desde: backend.controller.AuthController.java
 *
 * Endpoint: POST /api/login
 * SQL: SELECT ID_USUARIO, NOMBRE, APELLIDO, EMAIL, ROL FROM USUARIO
 *      WHERE LOWER(EMAIL) = LOWER(:email) AND CONTRASENA = :contrasena AND ACTIVO = 'S'
 */
'use strict';

const { executeQuery } = require('../config/database');
const { createError } = require('../middlewares/errorHandler');

/**
 * POST /api/login
 * Body: { email, contrasena }
 */
async function login(req, res, next) {
    try {
        const { email, contrasena } = req.body;

        if (!email || !contrasena) {
            throw createError(400, 'Debe proporcionar correo y contraseña');
        }

        const sql = `
            SELECT ID_USUARIO, NOMBRE, APELLIDO, EMAIL, ROL
            FROM USUARIO
            WHERE LOWER(EMAIL) = LOWER(:email)
              AND CONTRASENA = :contrasena
              AND ACTIVO = 'S'
        `;

        const result = await executeQuery(sql, {
            email: email.trim(),
            contrasena: String(contrasena).trim(),
        });

        const row = result.rows && result.rows.length > 0 ? result.rows[0] : null;

        if (!row) {
            throw createError(401, 'Credenciales inválidas o usuario inactivo');
        }

        const nombreCompleto = `${row.NOMBRE} ${row.APELLIDO || ''}`.trim();

        res.json({
            success: true,
            usuario: {
                id: row.ID_USUARIO,
                nombre: nombreCompleto,
                email: row.EMAIL,
                rol: row.ROL,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { login };
