try {
    # 1. CPU Usage
    $cpuLoad = 0
    try {
        $cpu = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($cpu -and $cpu.LoadPercentage -ne $null) {
            $cpuLoad = [int]$cpu.LoadPercentage
        }
    } catch {}

    # 2. CPU / Thermal Zone Temp
    $cpuTemp = $null
    try {
        $tz = Get-CimInstance Win32_PerfFormattedData_Counters_ThermalZoneInformation -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($tz) {
            if ($tz.HighPrecisionTemperature -and $tz.HighPrecisionTemperature -gt 2700) {
                $cpuTemp = [math]::Round(($tz.HighPrecisionTemperature / 10 - 273.15), 1)
            } elseif ($tz.Temperature -and $tz.Temperature -gt 270) {
                $cpuTemp = [math]::Round(($tz.Temperature - 273.15), 1)
            }
        }
        if ($cpuTemp -eq $null) {
            $acpi = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($acpi -and $acpi.CurrentTemperature -gt 2700) {
                $cpuTemp = [math]::Round(($acpi.CurrentTemperature / 10 - 273.15), 1)
            }
        }
    } catch {}

    # 3. GPU Info (NVIDIA SMI & Fallback)
    $gpuTemp = $null
    $gpuFan = $null
    $gpuLoad = $null
    $gpuMemUsed = $null
    $gpuMemTotal = $null
    $gpuName = ""

    try {
        $smi = & nvidia-smi --query-gpu=name,temperature.gpu,fan.speed,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>$null
        if ($smi) {
            $parts = $smi.Split(",")
            if ($parts.Count -ge 6) {
                $gpuName = $parts[0].Trim()
                $gpuTemp = [int]($parts[1].Trim())
                $gpuFan = [int]($parts[2].Trim())
                $gpuLoad = [int]($parts[3].Trim())
                $gpuMemUsed = [int]($parts[4].Trim())
                $gpuMemTotal = [int]($parts[5].Trim())
            }
        }
    } catch {}

    # 4. System Fans
    $fans = @()
    try {
        $sysFans = @(Get-CimInstance Win32_Fan -ErrorAction SilentlyContinue)
        foreach ($f in $sysFans) {
            $fans += [PSCustomObject]@{
                Name = if ($f.Name) { $f.Name } else { "System Fan" }
                RPM = if ($f.DesiredSpeed) { $f.DesiredSpeed } else { 0 }
                Status = if ($f.Status) { $f.Status } else { "OK" }
            }
        }
    } catch {}

    # If GPU fan was detected, add to fans list
    if ($gpuFan -ne $null) {
        $fans += [PSCustomObject]@{
            Name = if ($gpuName) { "$gpuName Fan" } else { "GPU Fan" }
            Percent = $gpuFan
            Status = if ($gpuFan -eq 0) { "Zero RPM Idle" } else { "$gpuFan%" }
        }
    }

    # 5. Disk Temps (if StorageReliabilityCounter accessible)
    $diskTemps = @()
    try {
        $pDisks = Get-PhysicalDisk -ErrorAction SilentlyContinue
        foreach ($pd in $pDisks) {
            try {
                $rel = $pd | Get-StorageReliabilityCounter -ErrorAction Stop
                if ($rel -and $rel.Temperature) {
                    $diskTemps += [PSCustomObject]@{
                        Model = $pd.FriendlyName
                        Temperature = $rel.Temperature
                    }
                }
            } catch {}
        }
    } catch {}

    $result = [PSCustomObject]@{
        Success = $true
        Timestamp = (Get-Date).ToString("HH:mm:ss")
        CPU = [PSCustomObject]@{
            LoadPercent = $cpuLoad
            TemperatureC = $cpuTemp
            TemperatureF = if ($cpuTemp -ne $null) { [math]::Round($cpuTemp * 1.8 + 32, 1) } else { $null }
        }
        GPU = [PSCustomObject]@{
            Name = $gpuName
            TemperatureC = $gpuTemp
            TemperatureF = if ($gpuTemp -ne $null) { [math]::Round($gpuTemp * 1.8 + 32, 1) } else { $null }
            FanPercent = $gpuFan
            LoadPercent = $gpuLoad
            MemoryUsedMB = $gpuMemUsed
            MemoryTotalMB = $gpuMemTotal
        }
        Fans = $fans
        Disks = $diskTemps
    }

    $result | ConvertTo-Json -Depth 4
} catch {
    $errObj = [PSCustomObject]@{
        Success = $false
        Error = $_.Exception.Message
    }
    $errObj | ConvertTo-Json
}
