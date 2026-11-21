/**
 * SIGPA — API Gateway
 * Middleware de Autenticación Perimetral JWT
 */
'use strict';

const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('../config');

// Rutas públicas que no requieren autenticación perimetral
const PUBLIC_PATHS = [
    '/health',
    '/api/health',
    '/api/login',
    '/api/auth/login',
    '/api/v1/reports/health',
    '/api/v1/reports/docs'
];

/**
 * Determina si la ruta solicitada es pública
 * @param {string} url - URL pathname o path completo
 * @returns {boolean}
 */
function isPublicPath(url) {
    if (!url || typeof url !== 'string') return false;

    let cleanUrl = url;
    try {
        cleanUrl = decodeURIComponent(url);
    } catch (e) {
        cleanUrl = url;
    }

    const rawPath = cleanUrl.split('?')[0];
    const normalized = path.posix.normalize(rawPath).replace(/\/+$/, '') || '/';

    // Coincidencia exacta o prefijos públicos
    if (PUBLIC_PATHS.some(p => normalized === p || normalized.startsWith(p + '/'))) {
        return true;
    }

    return false;
}

/**
 * Intenta verificar un token contra los secretos configurados
 * @param {string} token
 * @returns {Object|null}
 */
function verifyTokenWithSecrets(token) {
    for (const secret of config.jwtSecrets) {
        try {
            const decoded = jwt.verify(token, secret);
            return decoded;
        } catch (err) {
            // Probar siguiente secreto si hay múltiples
            continue;
        }
    }
    return null;
}

/**
 * Middleware de Autenticación Perimetral JWT en Gateway
 */
function perimeterAuth(req, res, next) {
    // Sanitizar cabeceras de identidad del cliente no confiables para prevenir spoofing
    delete req.headers['x-user-id'];
    delete req.headers['x-user-role'];
    delete req.headers['X-User-Id'];
    delete req.headers['X-User-Role'];

    // Los preflights OPTIONS siempre pasan para permitir CORS
    if (req.method === 'OPTIONS') {
        return next();
    }

    // Rutas públicas omiten verificación JWT
    const requestUrl = req.originalUrl || req.url || req.path;
    if (isPublicPath(requestUrl) || isPublicPath(req.path) || isPublicPath(req.url)) {
        return next();
    }

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            error: 'Token de autorización inválido o ausente'
        });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            success: false,
            error: 'Formato de token inválido. Se espera: Bearer <token>'
        });
    }

    const token = parts[1];
    const decoded = verifyTokenWithSecrets(token);

    if (!decoded) {
        return res.status(401).json({
            success: false,
            error: 'Token de autorización inválido o expirado'
        });
    }

    // Inyección de cabeceras de identidad de usuario antes del forwarding
    const userId = decoded.id || decoded.usuario_id || decoded.id_usuario || decoded.sub || '';
    const userRole = decoded.rol || decoded.role || '';

    req.user = decoded;
    req.headers['x-user-id'] = String(userId);
    req.headers['x-user-role'] = String(userRole);
    req.headers['authorization'] = `Bearer ${token}`;

    next();
}

module.exports = {
    perimeterAuth,
    isPublicPath,
    verifyTokenWithSecrets
};
