/**
 * SIGPA — AuthController (Oracle 10g + Bcrypt + JWT)
 * Sistema de Gestión de Prácticas Académicas — UDI
 *
 * Endpoint: POST /api/login
 * Seguridad:
 *  - Cifrado unidireccional con bcryptjs (cost factor 10)
 *  - Firma de tokens de sesión con jsonwebtoken (JWT)
 *  - Compatibilidad y migración automática transparente para contraseñas heredadas
 */
'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');
const { createError } = require('../middlewares/errorHandler');
const { JWT_SECRET } = require('../middlewares/auth.middleware');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

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
            SELECT ID_USUARIO, NOMBRE, APELLIDO, EMAIL, CONTRASENA, ROL, ACTIVO
            FROM USUARIO
            WHERE LOWER(EMAIL) = LOWER(:email)
        `;

        const result = await executeQuery(sql, {
            email: email.trim(),
        });

        const row = result.rows && result.rows.length > 0 ? result.rows[0] : null;

        if (!row) {
            throw createError(401, 'Credenciales inválidas');
        }

        if (row.ACTIVO !== 'S') {
            throw createError(401, 'Usuario inactivo. Por favor contacte a la dirección de programa.');
        }

        const contrasenaIngresada = String(contrasena).trim();
        const hashAlmacenado = row.CONTRASENA || '';
        let passwordValida = false;

        // Comprobar si la contraseña guardada es un hash bcrypt ($2a$, $2b$ o $2y$)
        const esBcryptHash = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hashAlmacenado);

        if (esBcryptHash) {
            passwordValida = await bcrypt.compare(contrasenaIngresada, hashAlmacenado);
        } else {
            // Compatibilidad y migración para contraseñas heredadas en texto plano
            if (hashAlmacenado === contrasenaIngresada) {
                passwordValida = true;
                // Auto-migración a hash bcrypt seguro en Oracle
                try {
                    const nuevoHash = await bcrypt.hash(contrasenaIngresada, 10);
                    await executeQuery(
                        `UPDATE USUARIO SET CONTRASENA = :hash WHERE ID_USUARIO = :id`,
                        { hash: nuevoHash, id: row.ID_USUARIO }
                    );
                    console.log(`[AUTH] Contraseña de usuario ${row.EMAIL} migrada exitosamente a bcrypt.`);
                } catch (migrErr) {
                    console.warn('[AUTH] Advertencia en auto-migración de contraseña:', migrErr.message);
                }
            }
        }

        if (!passwordValida) {
            throw createError(401, 'Credenciales inválidas');
        }

        const nombreCompleto = `${row.NOMBRE} ${row.APELLIDO || ''}`.trim();

        // Generar JSON Web Token (JWT)
        const tokenPayload = {
            id: row.ID_USUARIO,
            nombre: nombreCompleto,
            email: row.EMAIL,
            rol: row.ROL,
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        });

        res.json({
            success: true,
            token,
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

/**
 * GET /api/perfil
 * Retorna la información del usuario autenticado a partir de su JWT
 */
async function perfil(req, res, next) {
    try {
        res.json({
            success: true,
            usuario: req.usuario,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    login,
    perfil,
};
