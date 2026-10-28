$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$executable = Join-Path $projectRoot 'DTS.exe'
if (-not (Test-Path -LiteralPath $executable)) { throw 'Build DTS.exe first with build-desktop-launcher.ps1.' }
$locations = @($projectRoot, [Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))
$shell = New-Object -ComObject WScript.Shell
foreach ($location in $locations) {
    if (-not (Test-Path -LiteralPath $location)) { New-Item -Path $location -ItemType Directory -Force | Out-Null }
    $shortcutPath = Join-Path $location 'DTS.lnk'
    $shortcut = $shell.CreateShortcut($shortcutPath)
    if ((Test-Path -LiteralPath $shortcutPath) -and $shortcut.TargetPath -ne $executable) {
        throw "A different DTS shortcut already exists at $shortcutPath. It was not overwritten."
    }
    $shortcut.TargetPath = $executable
    $shortcut.WorkingDirectory = $projectRoot
    $shortcut.Description = 'Start DTS on port 3000 and open its local network address.'
    $shortcut.IconLocation = "$executable,0"
    $shortcut.WindowStyle = 1
    $shortcut.Save()
    Write-Output "Created $shortcutPath"
}
