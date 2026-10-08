@echo off
cd /d "%~dp0"
if not exist node_modules call npm.cmd ci
call npm.cmd run dev
