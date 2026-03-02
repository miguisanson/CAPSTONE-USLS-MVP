@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0import-sql.ps1" %*
endlocal

