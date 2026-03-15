$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $repoRoot "dist"
$outputPath = Join-Path $repoRoot "public\media\press-kit.pdf"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$port = 4321
$url = "http://127.0.0.1:$port/media/press-kit/"

if (-not (Test-Path $chromePath)) {
  throw "Chrome was not found at $chromePath."
}

Push-Location $repoRoot

$server = $null

try {
  npm run build | Out-Host

  if (-not (Test-Path $distDir)) {
    throw "Build output directory not found: $distDir"
  }

  $server = Start-Process -FilePath "python" -ArgumentList "-m", "http.server", "$port", "--bind", "127.0.0.1", "--directory", $distDir -PassThru -WindowStyle Hidden

  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing
      if ($response.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {}
  }

  if (-not $ready) {
    throw "Local preview server did not become ready at $url"
  }

  & $chromePath `
    "--headless=new" `
    "--disable-gpu" `
    "--run-all-compositor-stages-before-draw" `
    "--virtual-time-budget=4000" `
    "--no-pdf-header-footer" `
    "--print-to-pdf=$outputPath" `
    $url

  if (-not (Test-Path $outputPath)) {
    throw "PDF export did not produce $outputPath"
  }
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
  Pop-Location
}
