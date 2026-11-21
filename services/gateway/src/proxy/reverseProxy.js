/**
 * SIGPA — API Gateway
 * Reverse Proxy Engine con Resiliencia y Fail-Fast
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * Crea un middleware de proxy reverso hacia el servicio destino
 * @param {string} targetBaseUrl - URL base del microservicio destino (ej: http://localhost:5001)
 * @param {Object} [options]
 * @param {number} [options.timeout=10000] - Timeout en milisegundos
 * @returns {Function} Express middleware
 */
function createReverseProxy(targetBaseUrl, options = {}) {
    const timeout = options.timeout || 10000;

    return (req, res, next) => {
        try {
            const targetUrl = new URL(req.originalUrl || req.url, targetBaseUrl);
            const isHttps = targetUrl.protocol === 'https:';
            const client = isHttps ? https : http;

            // Filtrar cabeceras hop-by-hop según RFC 7230
            const headers = { ...req.headers };
            delete headers['host'];
            delete headers['connection'];
            delete headers['keep-alive'];
            delete headers['proxy-authenticate'];
            delete headers['proxy-authorization'];
            delete headers['te'];
            delete headers['trailer'];
            delete headers['transfer-encoding'];
            delete headers['upgrade'];

            headers['host'] = targetUrl.host;
            headers['x-forwarded-for'] = req.ip || req.connection.remoteAddress || '127.0.0.1';
            headers['x-forwarded-proto'] = req.protocol || 'http';
            headers['x-forwarded-host'] = req.headers['host'] || targetUrl.host;

            let bodyPayload = null;
            const isModificationMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());

            if (isModificationMethod && req.body !== undefined && req.body !== null) {
                if (Buffer.isBuffer(req.body)) {
                    bodyPayload = req.body;
                    headers['content-length'] = bodyPayload.length;
                } else if (typeof req.body === 'object') {
                    bodyPayload = Buffer.from(JSON.stringify(req.body));
                    headers['content-type'] = 'application/json';
                    headers['content-length'] = bodyPayload.length;
                } else if (typeof req.body === 'string') {
                    bodyPayload = Buffer.from(req.body);
                    headers['content-length'] = bodyPayload.length;
                }
            } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
                bodyPayload = Buffer.from(JSON.stringify(req.body));
                headers['content-type'] = 'application/json';
                headers['content-length'] = bodyPayload.length;
            }

            if (!bodyPayload && !req.readable) {
                delete headers['content-length'];
            }

            const requestOptions = {
                hostname: targetUrl.hostname,
                port: targetUrl.port || (isHttps ? 443 : 80),
                path: targetUrl.pathname + targetUrl.search,
                method: req.method,
                headers: headers,
                timeout: timeout
            };

            const proxyReq = client.request(requestOptions, (proxyRes) => {
                // Configurar código de estado y cabeceras recibidas del upstream
                res.status(proxyRes.statusCode);

                for (const [key, value] of Object.entries(proxyRes.headers)) {
                    if (['connection', 'transfer-encoding'].includes(key.toLowerCase())) continue;
                    res.setHeader(key, value);
                }

                proxyRes.pipe(res);
            });

            proxyReq.on('timeout', () => {
                proxyReq.destroy(new Error('Downstream service request timeout'));
            });

            proxyReq.on('error', (err) => {
                if (res.headersSent) {
                    return;
                }

                console.error(`[GATEWAY-PROXY] Error enrutando a ${targetBaseUrl}:`, err.message);

                // 502 Bad Gateway / 503 Service Unavailable
                res.status(502).json({
                    success: false,
                    error: 'Servicio no disponible',
                    details: `No fue posible conectar con el microservicio downstream (${err.code || err.message})`,
                    target: targetBaseUrl
                });
            });

            if (bodyPayload) {
                proxyReq.write(bodyPayload);
                proxyReq.end();
            } else if (req.readable) {
                req.pipe(proxyReq);
            } else {
                proxyReq.end();
            }
        } catch (error) {
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Error interno en enrutador de API Gateway: ' + error.message
                });
            }
        }
    };
}

module.exports = {
    createReverseProxy
};
