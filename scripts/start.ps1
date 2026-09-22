$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env")) {
    Write-Host "No .env found; copying .env.example (add CLAUDE_API_KEY before using AI chat)."
    Copy-Item ".env.example" ".env"
}

docker rm -f pm-app 2>$null
docker build -t pm-app .
docker run -d --name pm-app -p 8000:8000 --env-file .env -v "${PWD}/data:/app/backend/data" pm-app

Write-Host "pm-app running at http://localhost:8000"
