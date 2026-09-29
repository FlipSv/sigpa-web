/**
 * SIGPA — Middleware de manejo de errores
 * Centraliza las respuestas de error, equivalente al try/catch en cada handler Java.
 */
'use strict';

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

    const statusCode = err.statusCode || 500;
    const message    = err.message    || 'Error interno del servidor';

    res.status(statusCode).json({ success: false, message });
}

/**
 * Helper: lanza un error con código HTTP personalizado.
 * Uso: throw createError(400, 'Faltan parámetros')
 */
function createError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

module.exports = { errorHandler, createError };
