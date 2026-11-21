/**
 * SIGPA — API Gateway Standalone Integration Test
 */
'use strict';

const http = require('http');
const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sigpa_secret_key_2026';
process.env.JWT_SECRET = JWT_SECRET;

// Create dummy downstream core service
const mockCore = express();
mockCore.use(express.json());
mockCore.post('/api/login', (req, res) => {
    res.json({ success: true, message: 'login passed' });
});
mockCore.get('/api/estudiante/perfil', (req, res) => {
    res.json({
        success: true,
        userId: req.headers['x-user-id'],
        userRole: req.headers['x-user-role']
    });
});

function makeRequest(port, options, bodyData = null) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            hostname: '127.0.0.1',
            port,
            path: options.path,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(reqOptions, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                let json = null;
                try {
                    json = JSON.parse(buffer.toString('utf8'));
                } catch (e) {
                    // Not JSON
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    buffer,
                    json
                });
            });
        });

        req.on('error', reject);

        if (bodyData) {
            const str = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
            req.write(str);
        }
        req.end();
    });
}

async function runTests() {
    console.log('====================================================');
    console.log('  SIGPA — Tests Unitarios/Integración API Gateway');
    console.log('====================================================');

    const coreServer = http.createServer(mockCore);
    await new Promise(resolve => coreServer.listen(0, '127.0.0.1', resolve));
    const corePort = coreServer.address().port;
    process.env.CORE_API_URL = `http://127.0.0.1:${corePort}`;

    const app = require('../src/app');
    const gwServer = http.createServer(app);
    await new Promise(resolve => gwServer.listen(0, '127.0.0.1', resolve));
    const gwPort = gwServer.address().port;

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`  ✔ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
            failed++;
        }
    }

    try {
        await test('Gateway Health check responde 200', async () => {
            const res = await makeRequest(gwPort, { path: '/health' });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.json.service, 'api-gateway');
        });

        await test('Petición protegida sin token retorna 401', async () => {
            const res = await makeRequest(gwPort, { path: '/api/estudiante/perfil' });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.json.success, false);
        });

        await test('Petición con token malformado retorna 401', async () => {
            const res = await makeRequest(gwPort, {
                path: '/api/estudiante/perfil',
                headers: { 'Authorization': 'Bearer bad_token_123' }
            });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.json.success, false);
        });

        await test('Petición pública a /api/login no requiere token', async () => {
            const res = await makeRequest(gwPort, {
                path: '/api/login',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, { email: 'test@sigpa.edu', contrasena: '1234' });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.json.success, true);
        });

        const validToken = jwt.sign(
            { id: 42, usuario_id: 42, rol: 'DIRECTOR', email: 'director@sigpa.edu' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        await test('Petición con token válido inyecta headers de identidad a downstream', async () => {
            const res = await makeRequest(gwPort, {
                path: '/api/estudiante/perfil',
                headers: { 'Authorization': `Bearer ${validToken}` }
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.json.success, true);
            assert.strictEqual(String(res.json.userId), '42');
            assert.strictEqual(res.json.userRole, 'DIRECTOR');
        });

        await test('Intento de Auth Bypass por Path Traversal es bloqueado con 401', async () => {
            const res = await makeRequest(gwPort, {
                path: '/api/login/../api/estudiante/perfil'
            });
            assert.strictEqual(res.status, 401);
        });

    } finally {
        await new Promise(resolve => gwServer.close(resolve));
        await new Promise(resolve => coreServer.close(resolve));
    }

    console.log('====================================================');
    console.log(`  Resultado API Gateway: ${passed} pasadas, ${failed} fallidas.`);
    console.log('====================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Error no capturado en tests de gateway:', err);
    process.exit(1);
});
