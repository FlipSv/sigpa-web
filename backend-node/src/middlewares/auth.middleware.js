/**
 * SIGPA — Middleware de Autenticación y Autorización (JWT & Roles)
 * Sistema de Gestión de Prácticas Académicas — UDI
 */
'use strict';

const jwt = require('jsonwebtoken');
const { createError } = require('./errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'sigpa_udi_secret_key_2026_super_segura';

/**
 * Middleware para verificar la validez del token JWT en el encabezado Authorization
 * Formato esperado: Authorization: Bearer <token>
 */
function verificarToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];

        if (!authHeader) {
            throw createError(401, 'Acceso no autorizado: No se proporcionó token de autenticación');
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            throw createError(401, 'Formato de token inválido. Formato esperado: Bearer <token>');
        }

        const token = parts[1];

        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    return next(createError(401, 'La sesión ha expirado. Por favor inicie sesión nuevamente'));
                }
                return next(createError(401, 'Token de autenticación inválido o alterado'));
            }

            // Adjuntar los datos del usuario decodificados a la solicitud
            req.usuario = decoded;
            next();
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Middleware generador para autorizar según uno o más roles permitidos
 * @param {string|string[]} roles - Rol o lista de roles permitidos (ej. ['DIRECTOR', 'TUTOR'])
 */
function verificarRol(roles) {
    const rolesPermitidos = (Array.isArray(roles) ? roles : [roles]).map(r => String(r).toUpperCase().trim());

    return (req, res, next) => {
        if (!req.usuario || !req.usuario.rol) {
            return next(createError(401, 'Usuario no autenticado o información de rol ausente'));
        }

        const userRol = String(req.usuario.rol).toUpperCase().trim();

        // En SIGPA, el rol COORDINADOR tiene los mismos privilegios que TUTOR
        const rolesEfectivos = [userRol];
        if (userRol === 'COORDINADOR') rolesEfectivos.push('TUTOR');
        if (userRol === 'TUTOR') rolesEfectivos.push('COORDINADOR');

        const tienePermiso = rolesEfectivos.some(r => rolesPermitidos.includes(r));

        if (!tienePermiso) {
            return next(createError(403, `Acceso denegado: Se requiere rol ${rolesPermitidos.join(' o ')}. Su rol actual es ${userRol}`));
        }

        next();
    };
}

module.exports = {
    verificarToken,
    verificarRol,
    JWT_SECRET
};
