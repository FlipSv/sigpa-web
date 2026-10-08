/**
 * SIGPA — Middlewares de Limitación de Tasa (Rate Limiting)
 * Protección contra ataques de fuerza bruta, DoS y abuso de endpoints.
 */
'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Limiter estricto para autenticación (/api/login):
 * Máximo 10 intentos por ventana de 15 minutos por dirección IP.
 */
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Máximo 10 peticiones
    standardHeaders: true, // Retorna RateLimit-* en cabeceras
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Demasiados intentos de inicio de sesión desde esta dirección IP. Por seguridad, intente nuevamente en 15 minutos.'
    },
    skipSuccessfulRequests: false,
});

/**
 * Limiter general para las rutas de la API (/api/*):
 * Máximo 300 peticiones por ventana de 15 minutos por dirección IP.
 */
const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 300, // Máximo 300 peticiones
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Límite de solicitudes alcanzado. Por favor espere unos momentos antes de continuar.'
    }
});

module.exports = {
    loginRateLimiter,
    apiRateLimiter,
};
