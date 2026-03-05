@echo off
echo ====================================================
echo  AlternApp Backend v2.0 — FastAPI + Supabase
echo ====================================================
cd /d "%~dp0"
call .venv\Scripts\activate
uvicorn main:app --reload --port 8000 --host 127.0.0.1
pause
