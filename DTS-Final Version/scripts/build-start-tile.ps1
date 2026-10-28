$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$assetDirectory = Join-Path $PSScriptRoot 'start-tile'
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null
Add-Type -AssemblyName System.Drawing
$logo = [Drawing.Image]::FromFile((Join-Path $projectRoot 'public\logo-white.png'))
try {
    foreach ($size in @(150, 70)) {
        $bitmap = [Drawing.Bitmap]::new($size, $size)
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([Drawing.Color]::Transparent)
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            # Leave room for the app name on the medium tile.
            $width = if ($size -eq 150) { 108 } else { 58 }
            $height = [int][Math]::Round($width * $logo.Height / $logo.Width)
            $left = [int][Math]::Round(($size - $width) / 2)
            $top = [int][Math]::Round(($size - $height) / 2)
            if ($size -eq 150) { $top -= 6 }
            $graphics.DrawImage($logo, $left, $top, $width, $height)
            $bitmap.Save((Join-Path $assetDirectory "DTS-$size.png"), [Drawing.Imaging.ImageFormat]::Png)
        } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
} finally { $logo.Dispose() }
@'
<Application xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <VisualElements
    BackgroundColor="#444444"
    ForegroundText="light"
    ShowNameOnSquare150x150Logo="on"
    Square150x150Logo="scripts\start-tile\DTS-150.png"
    Square70x70Logo="scripts\start-tile\DTS-70.png" />
</Application>
'@ | Set-Content -LiteralPath (Join-Path $projectRoot 'DTS.VisualElementsManifest.xml') -Encoding UTF8
Write-Output 'Built larger DTS Start tile artwork.'
