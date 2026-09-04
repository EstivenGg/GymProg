param([switch]$NoOpen)

$ErrorActionPreference = 'Stop'
$workoutPath = Join-Path $PSScriptRoot 'workout_data.csv'
$measurementPath = Join-Path $PSScriptRoot 'measurement_data.csv'
$distPath = Join-Path $PSScriptRoot 'dist'
$dataPath = Join-Path $distPath 'data.js'
$indexPath = Join-Path $distPath 'index.html'

if (-not (Test-Path -LiteralPath $indexPath)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
        "No se encontro la version compilada del tablero.`n`nEjecuta npm.cmd run build y vuelve a intentarlo.",
        'Hevy Progress',
        'OK',
        'Warning'
    ) | Out-Null
    exit 1
}

if (-not (Test-Path -LiteralPath $workoutPath)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
        "No se encontro workout_data.csv.`n`nPon el archivo exportado por Hevy en esta misma carpeta.",
        'Hevy Progress',
        'OK',
        'Warning'
    ) | Out-Null
    exit 1
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$payload = [ordered]@{
    workout = [System.IO.File]::ReadAllText($workoutPath, $utf8)
    measurements = if (Test-Path -LiteralPath $measurementPath) {
        [System.IO.File]::ReadAllText($measurementPath, $utf8)
    } else { '' }
} | ConvertTo-Json -Compress

[System.IO.File]::WriteAllText($dataPath, "window.__HEVY_DATA__ = $payload;", $utf8)

if (-not $NoOpen) {
    Start-Process -FilePath $indexPath
}
