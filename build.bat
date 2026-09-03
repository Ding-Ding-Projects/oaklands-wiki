@echo off
REM ===========================================================================
REM Oaklands Wiki - one-click build
REM
REM Takes a checkout with nothing installed and produces the built site. It
REM fetches its own dependencies rather than assuming a tree is already there,
REM so nobody has to know download-dependencies.bat exists or run it first.
REM
REM   build.bat        interactive; offers to open the result when it finishes
REM   build.bat /s     silent, non-interactive, exits non-zero on the first
REM                    real failure
REM
REM There is deliberately no build-installer.bat: this repository ships a
REM website and no installed application. That exemption is recorded in
REM docs/delivery/README.md rather than left as a silent gap.
REM ===========================================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "SILENT=0"
for %%A in (%*) do (
  if /I "%%~A"=="/s" set "SILENT=1"
  if /I "%%~A"=="--silent" set "SILENT=1"
)
if /I "%SILENT_BUILD%"=="1" set "SILENT=1"

echo === Oaklands Wiki build ===
echo.

REM --- Dependencies (this script fetches its own; that is the whole point) ---
if "%SILENT%"=="1" (
  call "%~dp0download-dependencies.bat" /s
) else (
  call "%~dp0download-dependencies.bat"
)
if not "%ERRORLEVEL%"=="0" (
  echo [FAILED] dependencies could not be prepared
  if "%SILENT%"=="0" pause
  exit /b 1
)

REM --- Build -----------------------------------------------------------------
echo.
echo [build] client bundle, server bundle, then prerender every route
call npm run build
if not "%ERRORLEVEL%"=="0" (
  echo [FAILED] build exited with %ERRORLEVEL%
  if "%SILENT%"=="0" pause
  exit /b 1
)

REM --- Verify the artifact, not the config -----------------------------------
if not exist "%~dp0dist\index.html" (
  echo [FAILED] dist\index.html was not produced
  if "%SILENT%"=="0" pause
  exit /b 1
)

echo.
echo [OK] built into dist\
for /f %%C in ('dir /b /s "%~dp0dist\*.html" ^| find /c /v ""') do echo      %%C HTML page^(s^)

if "%SILENT%"=="1" exit /b 0

echo.
set /p RUNIT="Open the built site in your browser? [y/N] "
if /I "!RUNIT!"=="y" (
  call npx vite preview
)
exit /b 0
