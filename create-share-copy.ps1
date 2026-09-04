$ErrorActionPreference = 'Stop'

$outputPath = Join-Path $PSScriptRoot 'Hevy-Progress-Compartir.zip'
$tempRoot = [System.IO.Path]::GetTempPath()
$tempFolder = Join-Path $tempRoot ("hevy-progress-share-" + [guid]::NewGuid().ToString('N'))
$utf8 = New-Object System.Text.UTF8Encoding($false)

try {
    New-Item -ItemType Directory -Path $tempFolder | Out-Null

    $distSource = Join-Path $PSScriptRoot 'dist'
    $distDestination = Join-Path $tempFolder 'dist'

    if (-not (Test-Path -LiteralPath (Join-Path $distSource 'index.html'))) {
        throw 'No existe la version compilada. Ejecuta npm.cmd run build primero.'
    }

    Copy-Item -LiteralPath $distSource -Destination $distDestination -Recurse

    $launcherFiles = @(
        'open-dashboard.ps1',
        'Abrir tablero.bat',
        'README.md'
    )

    foreach ($file in $launcherFiles) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $tempFolder
    }

    [System.IO.File]::WriteAllText(
        (Join-Path $distDestination 'data.js'),
        "window.__HEVY_DATA__ = null;",
        $utf8
    )
    Compress-Archive -Path (Join-Path $tempFolder '*') -DestinationPath $outputPath -Force
    Write-Host "Copia limpia creada correctamente:" -ForegroundColor Green
    Write-Host $outputPath
    Write-Host "No contiene tus CSV ni tus datos de entrenamiento."
} finally {
    if (Test-Path -LiteralPath $tempFolder) {
        Remove-Item -LiteralPath $tempFolder -Recurse -Force
    }
}
