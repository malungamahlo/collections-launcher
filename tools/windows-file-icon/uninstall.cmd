@echo off
rem Double-click to remove the Collections Launcher icon from .collectionLauncher files.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
