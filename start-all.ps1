# start-all.ps1
# Build (if needed) and launch the GSD Config Manager.
# The server binds 127.0.0.1 on an OS-assigned port and opens your browser
# at the tokenized URL. Leave this window open while using the tool.
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

function Test-LastCommand {
    if ($LASTEXITCODE -ne 0) {
        throw "Previous command failed with exit code $LASTEXITCODE"
    }
}

# Build the CLI (tsup) and the browser client (vite) if dist is missing or stale.
$needBuild = $false
if (-not (Test-Path "dist/cli.js") -or -not (Test-Path "dist/client/index.html")) {
    $needBuild = $true
}
if (-not $needBuild) {
    # Rebuild if any source file is newer than the built CLI.
    $cliTime = (Get-Item "dist/cli.js").LastWriteTime
    $stale = Get-ChildItem -Recurse -Include *.ts,*.tsx,*.css,*.html -Path "packages","web/src" -ErrorAction SilentlyContinue |
             Where-Object { $_.LastWriteTime -gt $cliTime }
    if ($stale) { $needBuild = $true }
}

if ($needBuild) {
    Write-Host "Building GSD Config Manager (CLI + client)..." -ForegroundColor Cyan
    npm run build
    Test-LastCommand
    Write-Host "Build complete." -ForegroundColor Green
} else {
    Write-Host "Build is up to date. Skipping." -ForegroundColor DarkGray
}

Write-Host "Starting GSD Config Manager ..." -ForegroundColor Cyan
npm run cli:start
