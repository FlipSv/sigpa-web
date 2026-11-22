/**
 * SIGPA — Concurrency Stress Test
 * Spawns two instances of the master test runner concurrently
 * to verify complete SQLite process isolation and zero database lock collisions.
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');

function runInstance(id) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const runnerPath = path.resolve(__dirname, 'runner.js');
        const proc = spawn(process.execPath, [runnerPath], {
            cwd: path.resolve(__dirname, '../..'),
            env: { ...process.env, NODE_ENV: 'test', USE_MOCK_DB: 'true' },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
            const durationMs = Date.now() - startTime;
            const hasDbLock = (stdout + stderr).includes('database is locked');
            const totalMatch = stdout.match(/TOTAL SUITE ACCUMULATOR\s+(\d+)\s+(\d+)\s+(\d+)/);
            const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
            const passed = totalMatch ? parseInt(totalMatch[2], 10) : 0;
            const failed = totalMatch ? parseInt(totalMatch[3], 10) : 0;

            resolve({
                id,
                pid: proc.pid,
                exitCode: code,
                durationMs,
                total,
                passed,
                failed,
                hasDbLock,
                stdout,
                stderr,
            });
        });
    });
}

async function main() {
    console.log('================================================================================');
    console.log('      SIGPA — Concurrency Stress Test: 2 Parallel Runner Instances');
    console.log('================================================================================');
    console.log('Launching Instance 1 and Instance 2 simultaneously...\n');

    const start = Date.now();
    const [res1, res2] = await Promise.all([runInstance(1), runInstance(2)]);
    const totalElapsed = Date.now() - start;

    console.log(`Instance 1 [PID ${res1.pid}]: Exit code = ${res1.exitCode}, Passed = ${res1.passed}/${res1.total}, Failed = ${res1.failed}, HasDbLock = ${res1.hasDbLock}, Duration = ${(res1.durationMs / 1000).toFixed(2)}s`);
    console.log(`Instance 2 [PID ${res2.pid}]: Exit code = ${res2.exitCode}, Passed = ${res2.passed}/${res2.total}, Failed = ${res2.failed}, HasDbLock = ${res2.hasDbLock}, Duration = ${(res2.durationMs / 1000).toFixed(2)}s`);
    console.log(`Total concurrent elapsed time: ${(totalElapsed / 1000).toFixed(2)}s`);
    console.log('================================================================================');

    const success = res1.exitCode === 0 && res2.exitCode === 0 &&
                    res1.passed === 203 && res2.passed === 203 &&
                    !res1.hasDbLock && !res2.hasDbLock;

    if (success) {
        console.log('✔ CONCURRENCY VERIFIED: Both runner instances passed 203/203 with 0 lock errors.');
        process.exit(0);
    } else {
        console.error('✖ CONCURRENCY FAILED: Race condition or lock error detected.');
        if (res1.stderr) console.error('Instance 1 Stderr:\n', res1.stderr);
        if (res2.stderr) console.error('Instance 2 Stderr:\n', res2.stderr);
        process.exit(1);
    }
}

main();
