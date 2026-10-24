# ==============================================================================
# Long AT Test - Universal Bootstrap Launcher
# Tu dong kiem tra moi truong, tai tai nguyen & thu vien can thiet
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Long AT Test - Bootstrap Launcher"

function Write-Step([string]$Step, [string]$Text) {
    Write-Host "[$Step] " -ForegroundColor Cyan -NoNewline
    Write-Host $Text -ForegroundColor White
}

function Write-Success([string]$Text) {
    Write-Host "  [OK] $Text" -ForegroundColor Green
}

function Write-Notice([string]$Text) {
    Write-Host "  [i]  $Text" -ForegroundColor Yellow
}

function Write-Err([string]$Text) {
    Write-Host "  [X]  $Text" -ForegroundColor Red
}

Clear-Host
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "        LONG AT TEST - CONG CU KIEM TRA PHAN CUNG MAY TINH            " -ForegroundColor Yellow
Write-Host "               Tu Dong Chuan Bi Moi Truong Khoi Chay                  " -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $CurrentDir

# ------------------------------------------------------------------------------
# BUOC 1: Mo khoa file de tranh bi Windows SmartScreen / ZoneId chan
# ------------------------------------------------------------------------------
Write-Step "1/4" "Kiem tra quyen han & mo khoa file thu muc..."
try {
    Get-ChildItem -Path $CurrentDir -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue
    Write-Success "Da giai phong quyen han bao mat file."
} catch {
    Write-Notice "Bo qua mo khoa file."
}

# ------------------------------------------------------------------------------
# BUOC 2: Kiem tra tai nguyen ung dung (EXE, Web, Scripts)
# ------------------------------------------------------------------------------
Write-Step "2/4" "Kiem tra goi tai nguyen ung dung..."
$ExePath = Join-Path $CurrentDir "LongATTest.exe"
$WebPath = Join-Path $CurrentDir "web\index.html"
$ScriptPath = Join-Path $CurrentDir "scripts\get_specs.ps1"

$NeedsDownload = (-not (Test-Path $ExePath)) -or (-not (Test-Path $WebPath)) -or (-not (Test-Path $ScriptPath))

if ($NeedsDownload) {
    Write-Notice "Tai nguyen chua day du (ban sieu nhe). Dang tu dong tai goi tai nguyen..."
    $ReleaseZipUrl = "https://github.com/vulongvy/LongATTest/releases/download/v1.0.0/LongATTest-1.0.0-win-x64.zip"
    $TempZip = Join-Path $env:TEMP "LongATTest_Package.zip"

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Write-Host "  -> Dang tai tu GitHub Releases: LongATTest-1.0.0-win-x64.zip..." -ForegroundColor DarkGray
        
        $WebClient = New-Object System.Net.WebClient
        $WebClient.DownloadFile($ReleaseZipUrl, $TempZip)
        Write-Success "Tai thanh cong! Dang giai nen..."

        Expand-Archive -Path $TempZip -DestinationPath $CurrentDir -Force
        Remove-Item $TempZip -Force -ErrorAction SilentlyContinue
        Write-Success "Da giai nen day du tai nguyen vao thu muc chay."
    } catch {
        Write-Err "Khong the tu dong tai tai nguyen tu GitHub: $($_.Exception.Message)"
        Write-Notice "Ban van co the chay che do Python neu may da co ma nguon web/."
    }
} else {
    Write-Success "Goi tai nguyen da co san day du."
}

# ------------------------------------------------------------------------------
# BUOC 3: Kiem tra WebView2 Runtime
# ------------------------------------------------------------------------------
Write-Step "3/4" "Kiem tra Microsoft Edge WebView2 Runtime..."
$HasWebView2 = $false
$wvRegKey32 = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
$wvRegKey64 = "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
$wvRegUser = "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

if ((Test-Path $wvRegKey32) -or (Test-Path $wvRegKey64) -or (Test-Path $wvRegUser) -or (Test-Path "C:\Program Files (x86)\Microsoft\EdgeWebView\Application")) {
    $HasWebView2 = $true
}

if (-not $HasWebView2) {
    Write-Notice "May chua co WebView2 Runtime. Dang tu dong tai bo cai tu Microsoft..."
    $WvBootstrapper = Join-Path $env:TEMP "MicrosoftEdgeWebview2Setup.exe"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $WvBootstrapper -UseBasicParsing
        Write-Notice "Dang cai dat WebView2 Runtime ngam..."
        $installProc = Start-Process -FilePath $WvBootstrapper -ArgumentList "/silent /install" -Wait -PassThru
        Write-Success "Da cai dat xong WebView2 Runtime!"
        Remove-Item $WvBootstrapper -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Err "Khong the tu dong cai WebView2: $($_.Exception.Message)"
    }
} else {
    Write-Success "WebView2 Runtime da san sang."
}

# ------------------------------------------------------------------------------
# BUOC 4: Kiem tra .NET 8.0 Desktop Runtime
# ------------------------------------------------------------------------------
Write-Step "4/4" "Kiem tra .NET 8.0 Desktop Runtime..."
$HasDotNet8 = $false
if (Test-Path "C:\Program Files\dotnet\shared\Microsoft.WindowsDesktop.App\8.*") {
    $HasDotNet8 = $true
} elseif (Get-Command dotnet -ErrorAction SilentlyContinue) {
    $runtimes = dotnet --list-runtimes 2>$null
    if ($runtimes -match "Microsoft\.WindowsDesktop\.App 8\.") {
        $HasDotNet8 = $true
    }
}

$CanRunExe = $false

if ($HasDotNet8) {
    Write-Success ".NET 8 Desktop Runtime da duoc cai dat san tren may."
    $CanRunExe = $true
} else {
    Write-Notice "May nay CHUA co .NET 8 Desktop Runtime (nguyen nhan khien tool khong chay tren may khac)."
    Write-Host "  -> Nhan [Enter] de TU DONG CAI DAT .NET 8 Runtime tu Microsoft (Khuyen dung cho Standalone App);" -ForegroundColor Cyan
    Write-Host "  -> Hoac nhap 'P' roi Enter de chay ngay che do Python Server: " -ForegroundColor Yellow -NoNewline
    $choice = Read-Host

    if ($choice -ne "P" -and $choice -ne "p") {
        Write-Notice "Dang tai Microsoft .NET 8 Desktop Runtime tu aka.ms/dotnet..."
        $DotNetInstaller = Join-Path $env:TEMP "windowsdesktop-runtime-8.0-win-x64.exe"
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri "https://aka.ms/dotnet/8.0/windowsdesktop-runtime-win-x64.exe" -OutFile $DotNetInstaller -UseBasicParsing
            Write-Notice "Dang cai dat ngam .NET 8 Desktop Runtime..."
            $p = Start-Process -FilePath $DotNetInstaller -ArgumentList "/install /quiet /norestart" -Wait -PassThru
            if (Test-Path "C:\Program Files\dotnet\shared\Microsoft.WindowsDesktop.App\8.*") {
                Write-Success "Cai dat .NET 8 Desktop Runtime thanh cong 100%!"
                $CanRunExe = $true
            } else {
                Write-Notice "Dang thu chay trinh cai dat co giao dien..."
                Start-Process -FilePath $DotNetInstaller -Wait
                $CanRunExe = (Test-Path "C:\Program Files\dotnet\shared\Microsoft.WindowsDesktop.App\8.*")
            }
            Remove-Item $DotNetInstaller -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Err "Loi khi tai hoac cai dat .NET 8: $($_.Exception.Message)"
        }
    }
}

# ------------------------------------------------------------------------------
# KHOI CHAY UNG DUNG
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan

if ($CanRunExe -and (Test-Path $ExePath)) {
    Write-Host ">> DANG KHOI CHAY LONG AT TEST (STANDALONE EXE NATIVE)..." -ForegroundColor Green
    Start-Process -FilePath $ExePath -WorkingDirectory $CurrentDir
    Start-Sleep -Seconds 2
    Write-Host "Ung dung da duoc mo tren man hinh! Ban co the dong cua so nay." -ForegroundColor Gray
} else {
    Write-Notice "Chuyen sang che do du phong: KHOI CHAY BANG PYTHON SERVER..."
    $pyCmd = $null
    if (Get-Command python -ErrorAction SilentlyContinue) { $pyCmd = "python" }
    elseif (Get-Command py -ErrorAction SilentlyContinue) { $pyCmd = "py" }
    elseif (Get-Command python3 -ErrorAction SilentlyContinue) { $pyCmd = "python3" }

    if ($pyCmd -and (Test-Path (Join-Path $CurrentDir "server.py"))) {
        Write-Success "Da tim thay Python: $pyCmd. Dang khoi chay server.py..."
        Start-Process -FilePath $pyCmd -ArgumentList "server.py" -WorkingDirectory $CurrentDir
        Write-Host "May chu Python da khoi dong va tu dong mo trinh duyet ung dung!" -ForegroundColor Green
    } else {
        Write-Err "Khong the khoi chay: May chua co ca .NET 8 Runtime lan Python!"
        Write-Host "Vui long chay lai file Start_Tool.bat va nhan Enter de cai .NET 8 Runtime." -ForegroundColor Yellow
        Write-Host "Nhan phim bat ky de thoat..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}
