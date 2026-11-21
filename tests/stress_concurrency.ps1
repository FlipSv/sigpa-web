# SIGPA - Concurrency Stress Test via PowerShell Jobs
Set-Location 'D:\Descargas\PROYECTO_INTEGRADOR'

Write-Host "Starting Job 1 and Job 2 concurrently..."
$j1 = Start-Job -ScriptBlock {
    Set-Location 'D:\Descargas\PROYECTO_INTEGRADOR'
    node sigpa_app/tests/runner.js
}

$j2 = Start-Job -ScriptBlock {
    Set-Location 'D:\Descargas\PROYECTO_INTEGRADOR'
    node sigpa_app/tests/runner.js
}

Wait-Job $j1, $j2 | Out-Null

$res1 = Receive-Job $j1
$res2 = Receive-Job $j2

$text1 = $res1 -join "`n"
$text2 = $res2 -join "`n"

$hasDbLock1 = $text1 -match "database is locked"
$hasDbLock2 = $text2 -match "database is locked"

$pass1 = $text1 -match "SUCCESS: 100% of test cases passed \(203/203\)"
$pass2 = $text2 -match "SUCCESS: 100% of test cases passed \(203/203\)"

Write-Host "Job 1 State: $($j1.State), Passed 203/203: $pass1, HasDbLock: $hasDbLock1"
Write-Host "Job 2 State: $($j2.State), Passed 203/203: $pass2, HasDbLock: $hasDbLock2"

Remove-Job $j1, $j2

if ($pass1 -and $pass2 -and (-not $hasDbLock1) -and (-not $hasDbLock2)) {
    Write-Host "CONCURRENCY TEST PASSED: 100% pass across both concurrent jobs with 0 lock errors."
    exit 0
} else {
    Write-Host "CONCURRENCY TEST FAILED."
    exit 1
}
