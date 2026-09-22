$ErrorActionPreference = "Stop"

docker rm -f pm-app 2>$null
Write-Host "pm-app stopped"
