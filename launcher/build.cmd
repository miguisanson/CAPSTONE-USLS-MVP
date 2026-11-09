@echo off
rem Rebuilds Start.exe and Stop.exe in the repo root with the built-in .NET Framework compiler.
set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
set ROOT=%~dp0..
"%CSC%" /nologo /target:exe /out:"%ROOT%\Start.exe" "%~dp0Start.cs" || exit /b 1
"%CSC%" /nologo /target:exe /out:"%ROOT%\Stop.exe" "%~dp0Stop.cs" || exit /b 1
echo Built Start.exe and Stop.exe
