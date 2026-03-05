@echo off
cd /d "%~dp0"
echo Demarrage du backend Partie 1 sur http://localhost:8000 ...
"C:\Users\kuhli\AppData\Local\Python\pythoncore-3.14-64\python.exe" -m uvicorn main:app --reload --port 8000
