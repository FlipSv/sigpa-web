/**
 * SIGPA — API Gateway
 * Agregador de Salud (Health Checks)
 */
'use strict';

const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');
const { URL } = require('url');
const config = require('../config');

/**
 * Realiza un ping HTTP a un endpoint de servicio downstream
 * @param {string} fullUrl
 * @param {number} timeoutMs
 * @returns {Promise<Object>}
 */
function pingService(fullUrl, timeoutMs = 2500) {
    return new Promise((resolve) => {
        const start = Date.now();
        try {
            const url = new URL(fullUrl);
            const client = url.protocol === 'https:' ? https : http;

            const req = client.get(url, { timeout: timeoutMs }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const elapsed = Date.now() - start;
                    let parsed = null;
                    try { parsed = JSON.parse(data); } catch (e) { parsed = data.slice(0, 100); }

                    resolve({
                        status: res.statusCode >= 200 && res.statusCode < 400 ? 'UP' : 'DEGRADED',
                        statusCode: res.statusCode,
                        responseTimeMs: elapsed,
                        details: parsed
                    });
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    status: 'DOWN',
                    error: 'Timeout de conexión',
                    responseTimeMs: Date.now() - start
                });
            });

            req.on('error', (err) => {
                resolve({
                    status: 'DOWN',
                    error: err.message,
                    responseTimeMs: Date.now() - start
                });
            });
        } catch (err) {
            resolve({
                status: 'DOWN',
                error: err.message,
                responseTimeMs: Date.now() - start
            });
        }
    });
}

/**
 * Manejador del Health Check Agregado
 */
async function getHealth(req, res) {
    const reportingHealthUrl = `${config.services.reporting.url}${config.services.reporting.healthPath}`;
    const coreHealthUrl = `${config.services.coreApi.url}${config.services.coreApi.healthPath}`;

    const [reportingCheck, coreCheck] = await Promise.all([
        pingService(reportingHealthUrl),
        pingService(coreHealthUrl)
    ]);

    const isAllUp = reportingCheck.status === 'UP' && coreCheck.status === 'UP';
    const isDegraded = reportingCheck.status === 'DOWN' || coreCheck.status === 'DOWN';

    res.json({
        status: isAllUp ? 'UP' : (isDegraded ? 'DEGRADED' : 'UP'),
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
        downstream: {
            reportingService: {
                url: config.services.reporting.url,
                ...reportingCheck
            },
            coreApi: {
                url: config.services.coreApi.url,
                ...coreCheck
            }
        }
    });
}

router.get('/health', getHealth);
router.get('/api/health', getHealth);

module.exports = router;
