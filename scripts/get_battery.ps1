try {
    $bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
    $batStatic = Get-CimInstance -Namespace root/wmi -ClassName BatteryStaticData -ErrorAction SilentlyContinue | Select-Object -First 1
    $batFull = Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity -ErrorAction SilentlyContinue | Select-Object -First 1
    $batStatus = Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus -ErrorAction SilentlyContinue | Select-Object -First 1

    $hasBattery = ($bat -ne $null -or $batStatic -ne $null)

    if ($hasBattery) {
        $designCap = 0
        if ($batStatic -and $batStatic.DesignedCapacity -gt 0) {
            $designCap = [int]$batStatic.DesignedCapacity
        } elseif ($bat -and $bat.DesignCapacity -gt 0) {
            $designCap = [int]$bat.DesignCapacity
        }

        $fullChargeCap = 0
        if ($batFull -and $batFull.FullChargedCapacity -gt 0) {
            $fullChargeCap = [int]$batFull.FullChargedCapacity
        } elseif ($bat -and $bat.FullChargeCapacity -gt 0) {
            $fullChargeCap = [int]$bat.FullChargeCapacity
        }

        $cycleCount = 0
        $chemistry = if ($bat -and $bat.Chemistry) { $bat.Chemistry } else { "Li-Ion" }
        $reportFile = "$env:TEMP\LongAT_BatteryReport.html"

        if ($designCap -eq 0 -or $fullChargeCap -eq 0) {
            try {
                powercfg /batteryreport /output $reportFile | Out-Null
                if (Test-Path $reportFile) {
                    $html = Get-Content $reportFile -Raw -ErrorAction SilentlyContinue
                    if ($html -match 'DESIGN CAPACITY[\s\S]*?<td[^>]*>([\d,]+)\s*mWh') {
                        $designCap = [int]($matches[1] -replace ',', '')
                    }
                    if ($html -match 'FULL CHARGE CAPACITY[\s\S]*?<td[^>]*>([\d,]+)\s*mWh') {
                        $fullChargeCap = [int]($matches[1] -replace ',', '')
                    }
                    if ($html -match 'CYCLE COUNT[\s\S]*?<td[^>]*>([\d,]+)</td>') {
                        $cycleCount = [int]($matches[1] -replace ',', '')
                    }
                    if ($html -match 'CHEMISTRY[\s\S]*?<td[^>]*>([A-Za-z0-9-]+)</td>') {
                        $chemistry = $matches[1]
                    }
                }
            } catch {}
        }

        $wearLevel = 0
        if ($designCap -gt 0 -and $fullChargeCap -gt 0) {
            if ($fullChargeCap -le $designCap) {
                $wearLevel = [math]::Round((($designCap - $fullChargeCap) / $designCap) * 100, 1)
            } else {
                $wearLevel = 0
            }
        }

        $chargeRemaining = if ($bat -and $bat.EstimatedChargeRemaining) { $bat.EstimatedChargeRemaining } else { 100 }
        
        $statusCode = if ($bat -and $bat.BatteryStatus) { $bat.BatteryStatus } else { 2 }
        $statusText = switch ($statusCode) {
            1 { "Discharging" }
            2 { "AC Connected" }
            3 { "Low" }
            4 { "Critical" }
            5 { "Charging" }
            default { "AC Connected" }
        }

        $result = [PSCustomObject]@{
            Success = $true
            HasBattery = $true
            DeviceType = "Laptop"
            Name = if ($bat -and $bat.Name) { $bat.Name } else { "Internal Battery" }
            Manufacturer = if ($bat -and $bat.Manufacturer) { $bat.Manufacturer } else { "OEM Battery" }
            Chemistry = $chemistry
            DesignCapacity_mWh = $designCap
            FullChargeCapacity_mWh = $fullChargeCap
            CurrentCharge_Percent = $chargeRemaining
            WearLevel_Percent = $wearLevel
            CycleCount = $cycleCount
            Status = $statusText
            ReportPath = $reportFile
        }
        $result | ConvertTo-Json
    } else {
        $result = [PSCustomObject]@{
            Success = $true
            HasBattery = $false
            DeviceType = "Desktop"
            Name = "No Battery Detected"
            Message = "Desktop PC - Powered directly by AC Supply"
            DesignCapacity_mWh = 0
            FullChargeCapacity_mWh = 0
            CurrentCharge_Percent = 100
            WearLevel_Percent = 0
            CycleCount = 0
            Status = "Direct AC Power"
            ReportPath = ""
        }
        $result | ConvertTo-Json
    }
} catch {
    $errObj = [PSCustomObject]@{
        Success = $false
        Error = $_.Exception.Message
    }
    $errObj | ConvertTo-Json
}
