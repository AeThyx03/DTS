$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path ([Environment]::GetFolderPath('Windows')) 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework 4 compiler not found.' }
Add-Type -AssemblyName System.Drawing
$sourceImage = [Drawing.Image]::FromFile((Join-Path $projectRoot 'public\favicon.png'))
$iconPath = Join-Path $PSScriptRoot 'dts.ico'
$stream = [IO.File]::Create($iconPath)
$writer = [IO.BinaryWriter]::new($stream)
try {
    $sizes = @(16, 32, 48, 256)
    $images = @()
    foreach ($size in $sizes) {
        $bitmap = [Drawing.Bitmap]::new($size, $size)
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $memory = [IO.MemoryStream]::new()
        try {
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
            $bitmap.Save($memory, [Drawing.Imaging.ImageFormat]::Png)
            $images += ,$memory.ToArray()
        } finally { $memory.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    }
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $dimension = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
        $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$images[$i].Length); $writer.Write([uint32]$offset)
        $offset += $images[$i].Length
    }
    foreach ($image in $images) { $writer.Write([byte[]]$image) }
} finally { $writer.Dispose(); $sourceImage.Dispose() }
& $compiler /nologo /target:winexe /optimize+ /platform:anycpu /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/win32icon:$iconPath" "/out:$(Join-Path $projectRoot 'DTS.exe')" (Join-Path $PSScriptRoot 'DtsLauncher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
& (Join-Path $PSScriptRoot 'build-start-tile.ps1')
Write-Output "Built $(Join-Path $projectRoot 'DTS.exe')"
