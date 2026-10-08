/**
 * SIGPA — Capa de Persistencia y Conexión a Base de Datos
 * Soporte Dual:
 *  1. Oracle Database (Modo Thick / Fail-Fast para entornos con Oracle)
 *  2. SQLite Database (Modo Mock para desarrollo sin Oracle: USE_MOCK_DB=true)
 *
 * Universidad de Investigación y Desarrollo (UDI)
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const isMockMode = process.env.USE_MOCK_DB === 'true' || process.env.USE_MOCK_DB === '1';

// Cargar SQLite si estamos en modo Mock
let sqliteModule = null;
if (isMockMode) {
    sqliteModule = require('./sqlite');
}

// Cargar oracledb solo si no estamos en modo Mock
let oracledb = null;
if (!isMockMode) {
    try {
        oracledb = require('oracledb');
        oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
        oracledb.autoCommit = true;
        oracledb.fetchAsString = [ oracledb.CLOB ];
    } catch (err) {
        console.warn(`[ORACLE] No se pudo cargar el módulo oracledb: ${err.message}`);
    }
}

/**
 * Convierte un valor de tipo CLOB, Stream u Objeto a un string de texto limpio
 */
async function cleanLOB(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);

    // Si es un objeto LOB de Oracle con método getData()
    if (typeof val === 'object' && typeof val.getData === 'function') {
        try {
            const data = await val.getData();
            return typeof data === 'string' ? data : (data ? data.toString('utf8') : '');
        } catch (e) {
            return '';
        }
    }

    // Si es un Stream legible de Node.js
    if (typeof val === 'object' && typeof val.on === 'function') {
        return new Promise((resolve) => {
            let buffer = '';
            val.setEncoding('utf8');
            val.on('data', chunk => buffer += chunk);
            val.on('end', () => resolve(buffer));
            val.on('error', () => resolve(''));
        });
    }

    // Si es un stream interno que no expone on() (ej. _readableState)
    if (typeof val === 'object' && (val._readableState || val._impl)) {
        return '';
    }

    try {
        return JSON.stringify(val);
    } catch (e) {
        return String(val);
    }
}

// ── Inicialización de Modo Thick (Oracle Instant Client / Oracle Home) ───
let isThickInitialized = false;

function resolveInstantClientDir(basePath) {
    if (!basePath || !fs.existsSync(basePath)) return null;

    let target = basePath;
    if (fs.statSync(target).isFile()) {
        target = path.dirname(target);
    }

    // Si oci.dll está directamente en la carpeta
    if (fs.existsSync(path.join(target, 'oci.dll'))) {
        return target;
    }

    // Buscar si hay una subcarpeta tipo instantclient_*
    const subdirs = fs.readdirSync(target, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => path.join(target, d.name));

    for (const sub of subdirs) {
        if (fs.existsSync(path.join(sub, 'oci.dll'))) {
            return sub;
        }
    }

    return target;
}

function initThickClient() {
    if (isMockMode) return;
    if (isThickInitialized || !oracledb) return;

    let rawClientPath = process.env.ORACLE_CLIENT_PATH ? process.env.ORACLE_CLIENT_PATH.trim() : null;
    let clientPath = resolveInstantClientDir(rawClientPath);

    if (clientPath) {
        console.log(`[ORACLE] Inicializando modo Thick con libDir: ${clientPath}`);
        oracledb.initOracleClient({ libDir: clientPath });
    } else {
        console.log('[ORACLE] Inicializando modo Thick desde el PATH del sistema...');
        oracledb.initOracleClient();
    }

    isThickInitialized = true;
    console.log('[ORACLE] ✔ Modo Thick activado correctamente.');
}

// Inicializar cliente al cargar módulo si aplica Oracle
if (!isMockMode) {
    try {
        initThickClient();
    } catch (err) {
        console.warn(`[ORACLE] Aviso al inicializar cliente Thick: ${err.message}`);
    }
}

// Credenciales desde variables de entorno (.env)
const dbConfig = {
    user: process.env.DB_USER || 'SCOTT',
    password: process.env.DB_PASSWORD || 'tiger',
    connectString: process.env.DB_CONNECT_STRING ||
                   `${process.env.ORACLE_HOST || 'localhost'}:${process.env.ORACLE_PORT || '1522'}/${process.env.ORACLE_SID || 'orcl'}`,
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 2,
    poolTimeout: 60,
};

let pool = null;

/**
 * Inicializa la capa de base de datos:
 *  - En modo USE_MOCK_DB=true: inicializa SQLite (sigpa.db).
 *  - En modo Oracle: inicializa el pool de conexiones con política Fail-Fast.
 */
async function initPool() {
    if (isMockMode) {
        return await sqliteModule.initSqlite();
    }

    if (pool) return pool;

    try {
        initThickClient();
    } catch (e) {
        // Ya inicializado o manejado
    }

    console.log('====================================================');
    console.log('  SIGPA — Inicializando Pool de Conexiones Oracle 10g');
    console.log('====================================================');
    console.log(`[ORACLE] Usuario: ${dbConfig.user}`);
    console.log(`[ORACLE] Cadena de conexión: ${dbConfig.connectString}`);

    try {
        pool = await oracledb.createPool(dbConfig);

        // Prueba de conexión inmediata
        const conn = await pool.getConnection();
        const testResult = await conn.execute('SELECT SYSDATE, BANNER FROM v$version WHERE ROWNUM = 1');
        await conn.close();

        console.log('[ORACLE] ✔ Conexión a Oracle establecida con éxito.');
        if (testResult.rows && testResult.rows.length > 0) {
            console.log(`[ORACLE] Versión: ${testResult.rows[0].BANNER || 'Oracle Database'}`);
        }
        console.log('====================================================');
        return pool;
    } catch (err) {
        console.error('\n❌ ERROR CRÍTICO: No se pudo conectar a la base de datos Oracle 10g.');
        console.error(`  Detalle: ${err.message}`);
        console.error('  Verifica que:');
        console.error('    1. El servicio de Oracle 10g (Listener/Database) esté iniciado.');
        console.error('    2. El puerto, host y SID (ej. localhost:1522/orcl o localhost:1521/XE) sean correctos.');
        console.error('    3. El usuario y contraseña en .env sean válidos.');
        console.error('    4. La ruta en ORACLE_CLIENT_PATH apunte a la carpeta del Instant Client de 64 bits.');
        console.error('\n💡 SOLUCIÓN RÁPIDA (MODO MOCK SIN ORACLE):');
        console.error('  Si no tienes Oracle instalado en tu equipo, agrega en tu archivo .env:');
        console.error('    USE_MOCK_DB=true');
        console.error('  Esto activará automáticamente SQLite local (sigpa.db) con todos los datos');
        console.error('  de prueba para programar la interfaz sin bloqueos.\n');
        process.exit(1);
    }
}

/**
 * Cierra las conexiones de forma segura.
 */
async function closePool() {
    if (isMockMode) {
        return await sqliteModule.closeSqlite();
    }

    if (pool) {
        try {
            await pool.close(10);
            pool = null;
            console.log('[ORACLE] Pool de conexiones cerrado.');
        } catch (err) {
            console.error('[ORACLE] Error al cerrar pool:', err.message);
        }
    }
}

/**
 * Ejecuta una consulta SQL.
 * En modo USE_MOCK_DB=true delega a SQLite con traducción de dialecto.
 * En modo Oracle ejecuta contra el pool.
 */
async function executeQuery(sql, binds = {}, options = {}) {
    if (isMockMode) {
        return await sqliteModule.executeSqliteQuery(sql, binds, options);
    }

    if (!pool) {
        await initPool();
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.execute(sql, binds, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            autoCommit: options.autoCommit !== undefined ? options.autoCommit : true,
            fetchInfo: {
                ACTIVIDADES: { type: oracledb.STRING },
                OBSERVACIONES: { type: oracledb.STRING },
                COMENTARIOS: { type: oracledb.STRING },
                DESCRIPCION: { type: oracledb.STRING },
            },
            ...options,
        });

        // Asegurar que cualquier LOB remanente se resuelva a string limpio
        if (result && Array.isArray(result.rows)) {
            for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows[i];
                if (row && typeof row === 'object') {
                    for (const key of Object.keys(row)) {
                        if (row[key] && typeof row[key] === 'object') {
                            row[key] = await cleanLOB(row[key]);
                        }
                    }
                }
            }
        }

        return result;
    } catch (err) {
        console.error(`[ORACLE-QUERY-ERROR] ${err.message}\nSQL: ${sql}`);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error('[ORACLE] Error al liberar conexión:', closeErr.message);
            }
        }
    }
}

/**
 * Ejecuta múltiples operaciones dentro de una transacción atómica protegida.
 */
async function executeTransaction(callback) {
    if (isMockMode) {
        return await sqliteModule.executeSqliteTransaction(callback);
    }

    if (!pool) {
        await initPool();
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (err) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rbErr) {
                console.error('[ORACLE] Error en rollback:', rbErr.message);
            }
        }
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error('[ORACLE] Error al liberar conexión transaccional:', closeErr.message);
            }
        }
    }
}

module.exports = {
    initThickClient,
    initPool,
    closePool,
    cleanLOB,
    executeQuery,
    executeTransaction,
    dbConfig,
    isMockMode,
};
