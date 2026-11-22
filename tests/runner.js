/**
 * SIGPA — Master Unified E2E Test Runner
 * 
 * Standalone orchestrator that executes all four test tiers:
 *   Tier 1 — Feature Coverage (75 tests)
 *   Tier 2 — Boundary & Corner Cases (75 tests)
 *   Tier 3 — Cross-Feature Combinations (19 tests)
 *   Tier 4 — Real-World Application Scenarios (34 tests)
 * 
 * Aggregates results, outputs a structured summary table per tier,
 * verifies 100% pass threshold, and exits with code 0 on all pass.
 */
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const TIERS = [
    {
        name: 'Tier 1: Feature Coverage',
        file: path.resolve(__dirname, 'e2e/tier1_feature_coverage.test.js'),
        minExpected: 75,
    },
    {
        name: 'Tier 2: Boundary & Corner Cases',
        file: path.resolve(__dirname, 'e2e/tier2_boundaries_corners.test.js'),
        minExpected: 75,
    },
    {
        name: 'Tier 3: Pairwise Combinations',
        file: path.resolve(__dirname, 'e2e/tier3_pairwise_combinations.test.js'),
        minExpected: 16,
    },
    {
        name: 'Tier 4: Real-World Scenarios',
        file: path.resolve(__dirname, 'e2e/tier4_real_world_scenarios.test.js'),
        minExpected: 8,
    },
];

function runTier(tier) {
    const startTime = Date.now();
    const result = spawnSync(process.execPath, ['--test', tier.file], {
        env: {
            ...process.env,
            NODE_ENV: 'test',
            USE_MOCK_DB: 'true',
        },
        encoding: 'utf8',
    });
    const durationMs = Date.now() - startTime;

    const stdout = (result.stdout || '') + (result.stderr || '');

    // Parse counts from Node.js native test runner output
    const testsMatch = stdout.match(/ℹ tests\s+(\d+)/);
    const passMatch = stdout.match(/ℹ pass\s+(\d+)/);
    const failMatch = stdout.match(/ℹ fail\s+(\d+)/);

    const totalTests = testsMatch ? parseInt(testsMatch[1], 10) : 0;
    const passedTests = passMatch ? parseInt(passMatch[1], 10) : 0;
    const failedTests = failMatch ? parseInt(failMatch[1], 10) : 0;

    const isSuccess = result.status === 0 && failedTests === 0 && totalTests >= tier.minExpected;

    return {
        name: tier.name,
        file: path.basename(tier.file),
        totalTests,
        passedTests,
        failedTests,
        durationMs,
        success: isSuccess,
        exitCode: result.status,
        output: stdout,
    };
}

function formatRow(col1, col2, col3, col4, col5) {
    return (
        col1.padEnd(38) +
        col2.padStart(8) +
        col3.padStart(8) +
        col4.padStart(8) +
        col5.padStart(12)
    );
}

function main() {
    console.log('\n================================================================================');
    console.log('         SIGPA — Unified Automated E2E Test Suite Orchestrator');
    console.log('       Universidad de Investigación y Desarrollo (UDI) — 2026');
    console.log('================================================================================\n');

    const results = [];
    let allPassed = true;
    const suiteStartTime = Date.now();

    for (const tier of TIERS) {
        process.stdout.write(`▶ Running ${tier.name}... `);
        const res = runTier(tier);
        results.push(res);

        if (res.success) {
            console.log(`✔ PASS (${res.passedTests}/${res.totalTests} passed in ${(res.durationMs / 1000).toFixed(2)}s)`);
        } else {
            allPassed = false;
            console.log(`✖ FAIL (${res.failedTests} failed, code ${res.exitCode})`);
            console.error('\n--- Failure Output ---');
            console.error(res.output);
            console.error('----------------------\n');
        }
    }

    const totalSuiteDuration = Date.now() - suiteStartTime;

    // Structured Summary Table
    console.log('\n================================================================================');
    console.log('                            FINAL EXECUTION SUMMARY                             ');
    console.log('================================================================================');
    console.log(formatRow('Test Suite Tier', 'Total', 'Pass', 'Fail', 'Duration'));
    console.log('-'.repeat(74));

    let sumTotal = 0;
    let sumPass = 0;
    let sumFail = 0;

    for (const r of results) {
        sumTotal += r.totalTests;
        sumPass += r.passedTests;
        sumFail += r.failedTests;
        const durStr = `${(r.durationMs / 1000).toFixed(2)}s`;
        console.log(formatRow(r.name, String(r.totalTests), String(r.passedTests), String(r.failedTests), durStr));
    }

    console.log('='.repeat(74));
    console.log(formatRow('TOTAL SUITE ACCUMULATOR', String(sumTotal), String(sumPass), String(sumFail), `${(totalSuiteDuration / 1000).toFixed(2)}s`));
    console.log('================================================================================\n');

    if (allPassed && sumFail === 0) {
        console.log(`✔ SUCCESS: 100% of test cases passed (${sumPass}/${sumTotal}). 0 failures.`);
        console.log('Status: VERIFIED — Meets all acceptance thresholds for Tiers 1-4.\n');
        process.exit(0);
    } else {
        console.error(`✖ ERROR: Test suite failed with ${sumFail} failing tests.`);
        process.exit(1);
    }
}

main();
