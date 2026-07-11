@echo off
setlocal

REM Windows-friendly wrapper so `uvicorn ...` uses the active Python env.
python -m uvicorn %*

