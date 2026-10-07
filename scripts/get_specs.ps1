try {
    $sys = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    $bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
    $bb = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue
    $cpu = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    $rams = @(Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue)
    $memArray = Get-CimInstance Win32_PhysicalMemoryArray -ErrorAction SilentlyContinue | Select-Object -First 1
    $gpus = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $net = @(Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled = True" -ErrorAction SilentlyContinue)
    $bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue

    # 1. ACCURATE RAM CALCULATION
    $totalRamBytes = ($rams | Measure-Object -Property Capacity -Sum).Sum
    $totalInstalledGB = if ($totalRamBytes -and $totalRamBytes -gt 0) { [math]::Round($totalRamBytes / 1GB) } else { [math]::Round($sys.TotalPhysicalMemory / 1GB) }
    $usableRamGB = if ($sys.TotalPhysicalMemory) { [math]::Round($sys.TotalPhysicalMemory / 1GB, 1) } else { $totalInstalledGB }

    $ramSticks = @()
    foreach ($r in $rams) {
        $capGB = if ($r.Capacity) { [math]::Round($r.Capacity / 1GB) } else { 0 }
        $mfg = if ($r.Manufacturer) { $r.Manufacturer.Trim() } else { "Unknown" }
        $part = if ($r.PartNumber) { $r.PartNumber.Trim() } else { "" }

        # Clean hex manufacturer codes (e.g. 0x0F37)
        if ($mfg -match "^0x" -or [string]::IsNullOrWhiteSpace($mfg)) {
            if ($part -match "^SSTC") { $mfg = "SSTC" }
            elseif ($part -match "^KVR|^KF") { $mfg = "Kingston" }
            elseif ($part -match "^CT") { $mfg = "Crucial" }
            elseif ($part -match "^CM") { $mfg = "Corsair" }
            elseif ($part -match "^F4-") { $mfg = "G.Skill" }
            elseif ($part -match "^AD") { $mfg = "ADATA" }
            elseif ($part -match "^TED") { $mfg = "TeamGroup" }
            else { $mfg = if ($part) { "OEM ($part)" } else { "Standard" } }
        }

        $memTypeStr = switch ($r.SMBIOSMemoryType) {
            20 { "DDR" }
            21 { "DDR2" }
            24 { "DDR3" }
            26 { "DDR4" }
            30 { "LPDDR4" }
            34 { "DDR5" }
            35 { "LPDDR5" }
            default { "DDR4" }
        }

        $ramSticks += [PSCustomObject]@{
            Slot = if ($r.DeviceLocator) { $r.DeviceLocator } else { $r.BankLabel }
            CapacityGB = $capGB
            CapacityFormatted = "$($capGB) GB"
            SpeedMHz = $r.Speed
            Type = $memTypeStr
            Manufacturer = $mfg
            PartNumber = $part
            SerialNumber = if ($r.SerialNumber) { $r.SerialNumber.Trim() } else { "" }
        }
    }

    # 2. ACCURATE GPU VRAM CALCULATION
    $gpuList = @()
    foreach ($g in $gpus) {
        $name = $g.Name
        $driverVersion = $g.DriverVersion
        $vramGB = 0

        # Try registry 64-bit qwMemorySize
        try {
            $regLines = & reg query "HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}" /s /v HardwareInformation.qwMemorySize 2>$null
            foreach ($line in $regLines) {
                if ($line -match "HardwareInformation\.qwMemorySize\s+REG_QWORD\s+0x([0-9a-fA-F]+)") {
                    $bytes = [Convert]::ToInt64($matches[1], 16)
                    if ($bytes -gt 0) {
                        $vramGB = [math]::Round($bytes / 1GB, 1)
                        break
                    }
                }
            }
        } catch {}

        # Try nvidia-smi if NVIDIA
        if ($vramGB -le 4 -and $name -match "NVIDIA") {
            try {
                $smiMem = & nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>$null
                if ($smiMem) {
                    $vramGB = [math]::Round([int]$smiMem / 1024, 1)
                }
            } catch {}
        }

        # Fallback to AdapterRAM
        if ($vramGB -eq 0 -and $g.AdapterRAM -and $g.AdapterRAM -gt 0) {
            $vramGB = [math]::Round($g.AdapterRAM / 1GB, 1)
        }

        $res = if ($g.CurrentHorizontalResolution) { "$($g.CurrentHorizontalResolution) x $($g.CurrentVerticalResolution) @ $($g.CurrentRefreshRate)Hz" } else { "N/A" }
        
        $gpuList += [PSCustomObject]@{
            Name = $name
            DriverVersion = $driverVersion
            VRAM_GB = $vramGB
            Resolution = $res
            Status = $g.Status
        }
    }

    # 3. ACCURATE STORAGE & DISKS
    $physDisks = @()
    try {
        $pDisks = Get-PhysicalDisk -ErrorAction SilentlyContinue
        foreach ($d in $pDisks) {
            $rawGB = if ($d.Size) { [math]::Round($d.Size / 1GB, 1) } else { 0 }
            
            # Commercial size marketing label
            $commSize = ""
            if ($rawGB -ge 5000) { $commSize = "6 TB" }
            elseif ($rawGB -ge 3500) { $commSize = "4 TB" }
            elseif ($rawGB -ge 1800) { $commSize = "2 TB" }
            elseif ($rawGB -ge 900) { $commSize = "1 TB" }
            elseif ($rawGB -ge 450) { $commSize = "512 GB" }
            elseif ($rawGB -ge 220) { $commSize = "256 GB" }
            elseif ($rawGB -ge 110) { $commSize = "128 GB" }
            else { $commSize = "$rawGB GB" }

            $physDisks += [PSCustomObject]@{
                DeviceId = $d.DeviceId
                Model = $d.FriendlyName
                MediaType = if ($d.MediaType) { $d.MediaType.ToString() } else { "Disk" }
                BusType = if ($d.BusType) { $d.BusType.ToString() } else { "SATA" }
                CommercialSize = $commSize
                SizeGB = $rawGB
                Health = if ($d.HealthStatus) { $d.HealthStatus.ToString() } else { "Healthy" }
                OperationalStatus = if ($d.OperationalStatus) { ($d.OperationalStatus -join ", ") } else { "OK" }
                SerialNumber = if ($d.SerialNumber) { $d.SerialNumber.Trim() } else { "" }
            }
        }
    } catch {}

    # Logical Partitions
    $logicalDisks = @()
    $logicals = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType = 3" -ErrorAction SilentlyContinue)
    foreach ($l in $logicals) {
        $totalGB = if ($l.Size) { [math]::Round($l.Size / 1GB, 1) } else { 0 }
        $freeGB = if ($l.FreeSpace) { [math]::Round($l.FreeSpace / 1GB, 1) } else { 0 }
        $logicalDisks += [PSCustomObject]@{
            DriveLetter = $l.DeviceID
            VolumeName = if ($l.VolumeName) { $l.VolumeName } else { "Partition" }
            TotalGB = $totalGB
            FreeGB = $freeGB
            UsedGB = [math]::Round($totalGB - $freeGB, 1)
            PercentFree = if ($totalGB -gt 0) { [math]::Round(($freeGB / $totalGB) * 100, 1) } else { 0 }
            FileSystem = $l.FileSystem
        }
    }

    # 4. CLEAN SYSTEM & BOARD LABELS
    $rawSysModel = if ($sys.Model) { $sys.Model.Trim() } else { "PC" }
    $rawBoardProduct = if ($bb.Product) { $bb.Product.Trim() } else { "" }
    $rawSysSerial = if ($bios.SerialNumber) { $bios.SerialNumber.Trim() } else { "" }
    $rawBoardSerial = if ($bb.SerialNumber) { $bb.SerialNumber.Trim() } else { "" }

    $displayModel = $rawSysModel
    if ($rawSysModel.ToLower() -match "system product name|default string|to be filled") {
        $displayModel = if ($rawBoardProduct) { "$rawBoardProduct (Desktop PC)" } else { "Desktop PC" }
    }

    $displaySerial = $rawSysSerial
    if ($rawSysSerial.ToLower() -match "system serial number|default string|to be filled|00000000") {
        $displaySerial = if ($rawBoardSerial) { $rawBoardSerial } else { "N/A" }
    }

    # 5. NETWORK
    $netList = @()
    foreach ($n in $net) {
        $ips = if ($n.IPAddress) { ($n.IPAddress -join ", ") } else { "" }
        $netList += [PSCustomObject]@{
            Name = $n.Description
            MAC = $n.MACAddress
            IP = $ips
        }
    }

    $maxSlots = if ($memArray -and $memArray.MemoryDevices) { $memArray.MemoryDevices } else { $rams.Count }

    $result = [PSCustomObject]@{
        Success = $true
        Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        System = [PSCustomObject]@{
            Manufacturer = if ($sys.Manufacturer) { $sys.Manufacturer.Trim() } else { "Unknown" }
            Model = $displayModel
            RawModel = $rawSysModel
            SystemType = $sys.SystemType
            TotalPhysicalMemoryGB = $usableRamGB
        }
        BIOS = [PSCustomObject]@{
            Manufacturer = if ($bios.Manufacturer) { $bios.Manufacturer.Trim() } else { "Unknown" }
            SerialNumber = $displaySerial
            Version = $bios.SMBIOSBIOSVersion
            ReleaseDate = if ($bios.ReleaseDate) { $bios.ReleaseDate.ToString() } else { "" }
        }
        Motherboard = [PSCustomObject]@{
            Manufacturer = if ($bb.Manufacturer) { $bb.Manufacturer.Trim() } else { "Unknown" }
            Product = $rawBoardProduct
            SerialNumber = $rawBoardSerial
        }
        CPU = [PSCustomObject]@{
            Name = if ($cpu.Name) { $cpu.Name.Trim() } else { "Intel Processor" }
            NumberOfCores = $cpu.NumberOfCores
            NumberOfLogicalProcessors = $cpu.NumberOfLogicalProcessors
            MaxClockSpeedMHz = $cpu.MaxClockSpeed
            L3CacheSizeKB = $cpu.L3CacheSize
        }
        Memory = [PSCustomObject]@{
            TotalGB = $totalInstalledGB
            TotalFormatted = "$($totalInstalledGB) GB ($($rams.Count) sticks)"
            UsableGB = $usableRamGB
            UsedSlots = $rams.Count
            TotalSlots = $maxSlots
            Sticks = $ramSticks
        }
        GPUs = $gpuList
        Storage = [PSCustomObject]@{
            PhysicalDisks = $physDisks
            Partitions = $logicalDisks
        }
        Network = $netList
        OS = [PSCustomObject]@{
            Caption = $os.Caption
            Version = $os.Version
            BuildNumber = $os.BuildNumber
            OSArchitecture = $os.OSArchitecture
            InstallDate = if ($os.InstallDate) { $os.InstallDate.ToString() } else { "" }
        }
        HasBattery = ($bat -ne $null -and $bat.Count -gt 0)
    }

    $result | ConvertTo-Json -Depth 6
} catch {
    $errObj = [PSCustomObject]@{
        Success = $false
        Error = $_.Exception.Message
    }
    $errObj | ConvertTo-Json
}
