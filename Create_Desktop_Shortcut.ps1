$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "Long AT Test.lnk"
$TargetDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $TargetDir "LongATTest.exe"
$Shortcut.WorkingDirectory = $TargetDir
$Shortcut.IconLocation = (Join-Path $TargetDir "app.ico")
$Shortcut.Save()

Write-Host "Da cap nhat thanh cong Shortcut 'Long AT Test' tro truc tiep vao LongATTest.exe ngoai man hinh Desktop!" -ForegroundColor Green
