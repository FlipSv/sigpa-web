/**
 * SIGPA — Test Helper: Ephemeral SQLite Test Database Manager
 * 
 * Manages an isolated ephemeral SQLite database file (sigpa_test_<id>.db)
 * seeded with schema and initial test data, and cleanly removes it on suite teardown.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

class TestDbManager {
    constructor() {
        this.dbPath = null;
        this.sqliteModule = null;
        process.on('exit', () => {
            this._cleanupFiles();
        });
    }

    /**
     * Initializes a new isolated ephemeral SQLite database for test execution.
     * @param {string} [id] - Optional custom run or suite identifier
     * @returns {Promise<string>} - Absolute path to the ephemeral database file
     */
    async setup(id = '') {
        const uniqueToken = `${process.pid}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const runId = id ? `${id}_${uniqueToken}` : uniqueToken;
        this.dbPath = path.resolve(os.tmpdir(), `sigpa_test_${runId}.db`);

        // Resolve sqlite module relative to project
        this.sqliteModule = require('../../backend-node/src/config/sqlite');

        // Close any previous open instance to avoid lock conflicts
        await this.sqliteModule.closeSqlite();

        // Enforce mock mode and ephemeral db path
        process.env.USE_MOCK_DB = 'true';
        process.env.SQLITE_DB_PATH = this.dbPath;

        // Clean up any pre-existing stale file if present
        this._cleanupFiles();

        // Initialize schema, oracle compatibility functions, and seeds
        await this.sqliteModule.initSqlite();

        return this.dbPath;
    }

    /**
     * Resets the ephemeral database by purging and re-seeding.
     */
    async reset() {
        if (this.sqliteModule) {
            await this.sqliteModule.closeSqlite();
            this._cleanupFiles();
            await this.sqliteModule.initSqlite();
        }
    }

    /**
     * Closes the connection and purges the ephemeral database file and journals.
     */
    async teardown() {
        if (this.sqliteModule) {
            await this.sqliteModule.closeSqlite();
        }
        for (let attempt = 0; attempt < 5; attempt++) {
            this._cleanupFiles();
            if (!this.dbPath || !fs.existsSync(this.dbPath)) break;
            await new Promise((r) => setTimeout(r, 40));
        }
        this.dbPath = null;
    }

    _cleanupFiles() {
        if (this.dbPath) {
            const files = [this.dbPath, `${this.dbPath}-wal`, `${this.dbPath}-shm`];
            for (const f of files) {
                try {
                    if (fs.existsSync(f)) {
                        fs.unlinkSync(f);
                    }
                } catch (e) {
                    // Ignore transient file lock cleanup errors on process exit
                }
            }
        }
    }

    getDbPath() {
        return this.dbPath;
    }
}

const testDb = new TestDbManager();

module.exports = {
    testDb,
    setupTestDb: (id) => testDb.setup(id),
    teardownTestDb: () => testDb.teardown(),
    resetTestDb: () => testDb.reset(),
    getTestDbPath: () => testDb.getDbPath(),
};
