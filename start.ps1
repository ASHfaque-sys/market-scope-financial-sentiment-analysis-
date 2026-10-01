$ErrorActionPreference = 'Stop'
$projectDirectory = Join-Path $PSScriptRoot 'market-scope'
Push-Location -LiteralPath $projectDirectory
try {
    if (-not (Test-Path -LiteralPath 'node_modules')) {
        npm install
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. See market-scope/README.md for the Windows fallback.' }
    }
    node scripts/run-framework.mjs dev
} finally {
    Pop-Location
}
