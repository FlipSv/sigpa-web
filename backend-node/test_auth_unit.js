/**
 * SIGPA — Test Unitario de Seguridad (Bcrypt, JWT y Middlewares)
 * Valida la lógica de cifrado y autorización de forma aislada
 */
'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { verificarToken, verificarRol, JWT_SECRET } = require('./src/middlewares/auth.middleware');

async function runUnitTests() {
    console.log('====================================================');
    console.log('  SIGPA — Tests Unitarios de Seguridad (Bcrypt & JWT)');
    console.log('====================================================');

    let passed = 0;
    let failed = 0;

    function assert(cond, msg) {
        if (!cond) throw new Error(msg);
    }

    async function test(name, fn) {
        try {
            await fn();
            console.log(`  ✔ PASS: ${name}`);
            passed++;
        } catch (e) {
            console.error(`  ❌ FAIL: ${name} -> ${e.message}`);
            failed++;
        }
    }

    // --- BCrypt Tests ---
    await test('Bcrypt: Genera hash de 60 caracteres y valida contraseñas', async () => {
        const plain = 'Práctica2026*';
        const hash = await bcrypt.hash(plain, 10);
        assert(hash.startsWith('$2a$') || hash.startsWith('$2b$'), 'Debe tener prefijo bcrypt');
        assert(hash.length === 60, 'El hash bcrypt debe tener longitud 60');
        const match = await bcrypt.compare(plain, hash);
        assert(match === true, 'Bcrypt compare debe ser true con la contraseña correcta');
        const wrong = await bcrypt.compare('ClaveErronea', hash);
        assert(wrong === false, 'Bcrypt compare debe ser false con clave errónea');
    });

    // --- JWT Tests ---
    let sampleToken = null;
    await test('JWT: Firma de token con payload de usuario y verificación', async () => {
        const payload = { id: 1, email: 'director@sigpa.edu', rol: 'DIRECTOR', nombre: 'Ana Director' };
        sampleToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
        assert(typeof sampleToken === 'string' && sampleToken.split('.').length === 3, 'El token debe ser un JWT válido');
        const decoded = jwt.verify(sampleToken, JWT_SECRET);
        assert(decoded.id === 1 && decoded.rol === 'DIRECTOR', 'El token decodificado debe coincidir con el payload');
    });

    // --- Middleware verificarToken Tests ---
    await test('verificarToken: Rechaza petición sin cabecera Authorization (401)', async () => {
        const req = { headers: {} };
        let errCalled = null;
        verificarToken(req, {}, (err) => { errCalled = err; });
        assert(errCalled && errCalled.statusCode === 401, 'Debe llamar next con error 401');
    });

    await test('verificarToken: Rechaza formato que no sea Bearer (401)', async () => {
        const req = { headers: { authorization: 'Basic 123456' } };
        let errCalled = null;
        verificarToken(req, {}, (err) => { errCalled = err; });
        assert(errCalled && errCalled.statusCode === 401, 'Debe llamar next con error 401');
    });

    await test('verificarToken: Acepta Bearer token válido y puebla req.usuario', async () => {
        const req = { headers: { authorization: `Bearer ${sampleToken}` } };
        let errCalled = null;
        verificarToken(req, {}, (err) => { errCalled = err; });
        assert(!errCalled, 'No debe haber error con token válido');
        assert(req.usuario && req.usuario.rol === 'DIRECTOR', 'req.usuario debe tener los datos del token');
    });

    // --- Middleware verificarRol Tests ---
    await test('verificarRol: Permite acceso a usuario con rol autorizado', async () => {
        const req = { usuario: { rol: 'DIRECTOR' } };
        const middleware = verificarRol(['DIRECTOR']);
        let errCalled = null;
        middleware(req, {}, (err) => { errCalled = err; });
        assert(!errCalled, 'Director debe tener acceso');
    });

    await test('verificarRol: Bloquea con 403 Forbidden a usuario sin rol autorizado', async () => {
        const req = { usuario: { rol: 'ESTUDIANTE' } };
        const middleware = verificarRol(['DIRECTOR']);
        let errCalled = null;
        middleware(req, {}, (err) => { errCalled = err; });
        assert(errCalled && errCalled.statusCode === 403, 'Estudiante no puede acceder a ruta Director');
    });

    await test('verificarRol: Soporta lista de múltiples roles y equivalencia Tutor/Coordinador', async () => {
        const req = { usuario: { rol: 'COORDINADOR' } };
        const middleware = verificarRol(['TUTOR']);
        let errCalled = null;
        middleware(req, {}, (err) => { errCalled = err; });
        assert(!errCalled, 'Coordinador debe mapear al rol Tutor');
    });

    console.log(`\n====================================================`);
    console.log(`  Resultado Unitario: ${passed} pasadas, ${failed} fallidas.`);
    console.log(`====================================================`);

    process.exit(failed > 0 ? 1 : 0);
}

runUnitTests();
