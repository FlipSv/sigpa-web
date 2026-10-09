/**
 * SIGPA — Middleware Centralizado de Manejo y Sanitización de Errores
 * Centraliza las respuestas de error y protege la información técnica interna de Oracle.
 */
'use strict';

/**
 * Sanitiza mensajes de error técnicos (especialmente de Oracle y del sistema operativo)
 * para evitar divulgar estructuras de tablas, restricciones o rutas del servidor a clientes HTTP.
 */
function sanitizeErrorMessage(err, statusCode) {
    const rawMsg = err.message || '';

    // Si fue un error creado intencionalmente con createError (código < 500), se preserva el mensaje
    if (statusCode < 500 && err.isCustomError) {
        return rawMsg;
    }

    // Mapeo amigable de errores comunes de Oracle Database
    if (rawMsg.includes('ORA-00001')) {
        return 'Ya existe un registro con la misma información única (correo, código o identificador duplicado).';
    }
    if (rawMsg.includes('ORA-02291')) {
        return 'Uno de los elementos relacionados especificados no existe en el sistema.';
    }
    if (rawMsg.includes('ORA-02292')) {
        return 'No es posible completar la operación porque existen otros registros asociados.';
    }
    if (rawMsg.includes('ORA-01400')) {
        return 'Faltan datos obligatorios requeridos por la base de datos.';
    }
    if (rawMsg.includes('ORA-12541') || rawMsg.includes('ORA-12170') || rawMsg.includes('NJS-')) {
        return 'El servicio de base de datos no se encuentra disponible temporalmente. Intente nuevamente en unos instantes.';
    }

    // Para errores 500 no mapeados
    if (statusCode === 500) {
        if (process.env.NODE_ENV === 'production') {
            return 'Ha ocurrido un error interno en el servidor. Por favor comuníquese con el administrador.';
        }
        // En desarrollo, retornar un mensaje conciso pero sin volcar toda la estructura interna
        return rawMsg.replace(/(\r\n|\n|\r)/gm, ' ');
    }

    return rawMsg || 'Ha ocurrido un error en la solicitud.';
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || (err.status ? err.status : 500);

    // Registro interno completo para auditoría y depuración en consola
    console.error(`[ERROR ${statusCode}] ${req.method} ${req.path}:`, err.message);
    if (statusCode === 500 && err.stack) {
        console.error(err.stack);
    }

    const clientMessage = sanitizeErrorMessage(err, statusCode);

    res.status(statusCode).json({
        success: false,
        message: clientMessage,
        ...(process.env.NODE_ENV === 'development' && statusCode === 500 ? { debug: err.message } : {}),
    });
}

/**
 * Helper: lanza un error con código HTTP personalizado y mensaje amigable.
 * Uso: throw createError(400, 'Faltan parámetros')
 */
function createError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.isCustomError = true;
    return err;
}

module.exports = { errorHandler, createError };
