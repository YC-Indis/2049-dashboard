# Start Dojo local web UI
$ErrorActionPreference = 'Stop'
$nodeDir = 'C:\coding\.tools\node'
if (Test-Path $nodeDir) {
  $env:PATH = "$nodeDir;" + $env:PATH
}
Set-Location (Join-Path $PSScriptRoot '..\dojo-web')
if (-not (Test-Path 'node_modules')) {
  pnpm install
}
pnpm dev
