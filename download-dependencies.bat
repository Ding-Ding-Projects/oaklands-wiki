@echo off
REM ===========================================================================
REM Oaklands Wiki - dependency fetcher
REM
REM Takes a checkout with nothing installed and obtains everything needed to
REM build. Assumes a fresh Windows install: no Node, no package manager, no
REM build tools. Installs what is missing, verifies what is present, and never
REM asks anyone to go and install something by hand.
REM
REM   download-dependencies.bat        interactive
REM   download-dependencies.bat /s     silent, non-interactive, exits non-zero
REM                                    on the first real failure
REM
REM Installs nothing machine-wide that has a user-scoped form, requests no
REM elevation, and never touches signing material or the persistent execution
REM policy.
REM ===========================================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "SILENT=0"
for %%A in (%*) do (
  if /I "%%~A"=="/s" set "SILENT=1"
  if /I "%%~A"=="--silent" set "SILENT=1"
)
if "%SILENT%"=="1" goto :run
if /I "%SILENT_BUILD%"=="1" set "SILENT=1"

:run
REM A PowerShell switch takes no value from cmd: `-Silent:$([bool]%SILENT%)`
REM reaches the script as the literal string `$([bool]0)` and fails parameter
REM binding, because cmd does not evaluate `$(...)`. Pass the switch or omit it.
set "SWITCHES="
if "%SILENT%"=="1" set "SWITCHES=-Silent"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\download-dependencies.ps1" %SWITCHES%
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo [FAILED] dependency fetch exited with code %RC%
  if "%SILENT%"=="0" pause
  exit /b %RC%
)
if "%SILENT%"=="0" (
  echo.
  echo Dependencies are ready. Run build.bat next.
)
exit /b 0
