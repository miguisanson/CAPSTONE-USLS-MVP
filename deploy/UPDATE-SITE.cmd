@echo off
rem Gets the latest code and rebuilds the Docker site. See deploy\DOCKER.md.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0site-update.ps1"
