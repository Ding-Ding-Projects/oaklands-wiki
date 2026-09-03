# Oaklands Wiki - dependency fetcher.
#
# Obtains every dependency the project needs to build, from the ecosystem's
# canonical upstream, into a user-scoped or project-local location. Checks
# before installing, reports each phase honestly, and is safe to re-run.
#
# It deliberately requires no administrator rights: everything it installs has a
# user-scoped form. It installs no secret, no credential and no signing material,
# and it never changes the machine's persistent execution policy.

[CmdletBinding()]
param([switch]$Silent)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$script:phase = 0
function Write-Phase([string]$text) {
  $script:phase++
  Write-Host ""
  Write-Host "[$script:phase] $text" -ForegroundColor Cyan
}
function Write-Detail([string]$text) { Write-Host "    $text" }
function Fail([string]$what, [string]$why, [string]$tried) {
  Write-Host ""
  Write-Host "[FAILED] $what" -ForegroundColor Red
  Write-Host "    reason:  $why"
  if ($tried) { Write-Host "    tried:   $tried" }
  exit 1
}

$started = Get-Date

# --- Node -------------------------------------------------------------------
Write-Phase "Node.js (>= 22)"
$node = Get-Command node -ErrorAction SilentlyContinue
$nodeOk = $false
if ($node) {
  $version = (& node --version) -replace '^v', ''
  $major = [int]($version -split '\.')[0]
  if ($major -ge 22) {
    Write-Detail "found v$version at $($node.Source)"
    $nodeOk = $true
  } else {
    Write-Detail "found v$version, which is older than the required v22"
  }
}
if (-not $nodeOk) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Fail "Node.js is missing" "no compatible Node was found and winget is unavailable to install one" "PATH lookup for node and winget"
  }
  Write-Detail "installing OpenJS.NodeJS.LTS for the current user via winget"
  & winget install --id OpenJS.NodeJS.LTS --scope user --silent --accept-source-agreements --accept-package-agreements | Out-Host
  # winget writes PATH for FUTURE shells, so this process still cannot see the
  # new binary. Refresh it here or the very next command fails in a way that
  # reads as "the install failed" when it in fact succeeded.
  $env:PATH = [Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' +
              [Environment]::GetEnvironmentVariable('PATH', 'User')
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { Fail "Node.js is missing" "winget reported success but node is still not on PATH" "winget install OpenJS.NodeJS.LTS" }
  Write-Detail "installed $((& node --version))"
}

# --- npm --------------------------------------------------------------------
Write-Phase "npm"
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { Fail "npm is missing" "npm ships with Node but was not found on PATH" "PATH lookup for npm" }
Write-Detail "found $((& npm --version)) at $($npm.Source)"

# --- Project dependencies ---------------------------------------------------
Write-Phase "Project dependencies"
if (-not (Test-Path (Join-Path $root 'package-lock.json'))) {
  Fail "package-lock.json is missing" "the exact dependency set cannot be installed without the lockfile" "checked the repository root"
}
$needsInstall = $true
if (Test-Path (Join-Path $root 'node_modules')) {
  # A warm tree is only reused when the lockfile has not moved since.
  $lockTime = (Get-Item (Join-Path $root 'package-lock.json')).LastWriteTimeUtc
  $modTime = (Get-Item (Join-Path $root 'node_modules')).LastWriteTimeUtc
  if ($modTime -gt $lockTime) {
    Write-Detail "node_modules is newer than the lockfile; reusing it"
    $needsInstall = $false
  } else {
    Write-Detail "lockfile is newer than node_modules; reinstalling"
  }
}
if ($needsInstall) {
  Write-Detail "npm ci --no-audit --no-fund"
  & npm ci --no-audit --no-fund | Out-Host
  if ($LASTEXITCODE -ne 0) { Fail "dependency install failed" "npm ci exited with $LASTEXITCODE" "npm ci --no-audit --no-fund" }
}

# --- Post-install assertion -------------------------------------------------
# The guard above decides whether to install; this decides whether the install
# actually worked. Without it an interrupted install hands a half-populated tree
# to a build that fails much later and much less legibly.
Write-Phase "Verifying the installed tree"
foreach ($required in @('vite', 'react', 'react-dom', 'typescript', 'node-html-parser')) {
  $modulePath = Join-Path $root "node_modules\$required"
  if (-not (Test-Path $modulePath)) {
    Fail "dependency tree is incomplete" "node_modules\$required is missing after install" "npm ci"
  }
  Write-Detail "$required present"
}

$elapsed = (Get-Date) - $started
Write-Host ""
Write-Host ("[OK] dependencies ready in {0:mm}m {0:ss}s" -f $elapsed) -ForegroundColor Green
exit 0
