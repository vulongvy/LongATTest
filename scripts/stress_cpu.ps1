param(
    [int]$Duration = 10
)

$stopTime = (Get-Date).AddSeconds($Duration)
$cores = [System.Environment]::ProcessorCount
$threads = [System.Math]::Min($cores, 8)

$jobs = @()
for ($i = 0; $i -lt $threads; $i++) {
    $jobs += [powershell]::Create().AddScript({
        param($until)
        while ((Get-Date) -lt $until) {
            $x = 0
            for ($j = 0; $j -lt 50000; $j++) {
                $x += [System.Math]::Sqrt($j) * [System.Math]::Sin($j)
            }
        }
    }).AddArgument($stopTime)
}

$asyncHandles = @()
foreach ($j in $jobs) {
    $asyncHandles += $j.BeginInvoke()
}

while ((Get-Date) -lt $stopTime) {
    Start-Sleep -Milliseconds 500
}

foreach ($j in $jobs) {
    try { $j.Dispose() } catch {}
}

Write-Output "Stress test completed"
