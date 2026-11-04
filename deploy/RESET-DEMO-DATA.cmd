@echo off
rem Rebuilds the demo data (every tester's change is lost). Resets the Docker site when Docker runs it, else the local file.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0site-reset.ps1"
