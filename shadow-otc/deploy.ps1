# Shadow OTC - Production Deploy Script
# Always targets shadow-otc project (shadowotc.xyz)
# Usage:  .\deploy.ps1
#    or:  npm run deploy   (from frontend/)

$ErrorActionPreference = "Stop"

$DEPLOY_DIR   = "C:\tmp\shadow-deploy"
$FRONTEND_DIR = "$PSScriptRoot\frontend"

# ── correct project.json (never changes) ──────────────────
$PROJECT_JSON = '{"projectId":"prj_2rxFa047XUVEDLBsq91RcVSXZdEf","orgId":"team_xrxP9olwBbwMkxOvrzydGxvZ","projectName":"shadow-otc","settings":{"framework":"vite","devCommand":null,"installCommand":null,"buildCommand":null,"outputDirectory":null,"rootDirectory":null,"directoryListing":false,"nodeVersion":"24.x"}}'

# ── Vercel Build Output API config (SPA rewrites) ─────────
$OUTPUT_CONFIG = '{"version":3,"routes":[{"src":"/assets/(.*)","dest":"/assets/$1"},{"src":"/(.*\\..*)","dest":"/$1"},{"src":"/(.*)","dest":"/index.html"}]}'

Write-Host ""
Write-Host "[1/4] Building frontend..." -ForegroundColor Cyan
Set-Location $FRONTEND_DIR
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

Write-Host ""
Write-Host "[2/4] Preparing deploy folder..." -ForegroundColor Cyan

# Ensure .vercel dir exists and write correct project.json
New-Item -ItemType Directory -Force -Path "$DEPLOY_DIR\.vercel" | Out-Null
[System.IO.File]::WriteAllText("$DEPLOY_DIR\.vercel\project.json", $PROJECT_JSON)

# Clean and recreate output dir
Remove-Item -Recurse -Force "$DEPLOY_DIR\.vercel\output" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$DEPLOY_DIR\.vercel\output\static" | Out-Null
[System.IO.File]::WriteAllText("$DEPLOY_DIR\.vercel\output\config.json", $OUTPUT_CONFIG)

Write-Host ""
Write-Host "[3/4] Copying build output..." -ForegroundColor Cyan
Copy-Item -Path "$FRONTEND_DIR\dist\*" -Destination "$DEPLOY_DIR\.vercel\output\static\" -Recurse -Force

$fileCount = (Get-ChildItem "$DEPLOY_DIR\.vercel\output\static" -Recurse -File).Count
Write-Host "  $fileCount files staged" -ForegroundColor Gray

Write-Host ""
Write-Host "[4/4] Deploying to shadowotc.xyz..." -ForegroundColor Cyan
Set-Location $DEPLOY_DIR
npx vercel deploy --prebuilt --prod --yes
if ($LASTEXITCODE -ne 0) { throw "Vercel deploy failed" }

Write-Host ""
Write-Host "Done - shadowotc.xyz is live!" -ForegroundColor Green
