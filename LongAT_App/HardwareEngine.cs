using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net.NetworkInformation;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LibreHardwareMonitor.Hardware;

namespace LongATTestApp
{
    public class HardwareEngine : IDisposable
    {
        private Computer? _computer;
        private bool _isComputerOpen = false;
        private CancellationTokenSource? _stressCts;

        public HardwareEngine()
        {
            try
            {
                _computer = new Computer
                {
                    IsCpuEnabled = true,
                    IsGpuEnabled = true,
                    IsMotherboardEnabled = true,
                    IsMemoryEnabled = true,
                    IsStorageEnabled = true,
                    IsBatteryEnabled = true
                };
                _computer.Open();
                _isComputerOpen = true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Error opening LibreHardwareMonitor: " + ex.Message);
            }
        }

        public object GetThermalData()
        {
            float? cpuTemp = null;
            float? cpuLoad = null;
            float? gpuTemp = null;
            float? gpuHotspot = null;
            float? gpuFanPercent = null;
            float? gpuFanRpm = null;
            float? gpuLoad = null;
            float? gpuMemUsed = null;
            float? gpuMemTotal = null;
            string gpuName = "";
            var fanList = new List<object>();
            var diskList = new List<object>();

            if (_isComputerOpen && _computer != null)
            {
                try
                {
                    foreach (var hw in _computer.Hardware)
                    {
                        hw.Update();
                        
                        // Sub-hardware
                        foreach (var sub in hw.SubHardware)
                        {
                            sub.Update();
                            foreach (var s in sub.Sensors)
                            {
                                if (s.SensorType == SensorType.Fan && s.Value.HasValue && s.Value.Value > 0)
                                {
                                    fanList.Add(new { Name = s.Name, RPM = (int)s.Value.Value, Status = $"{s.Value.Value:F0} RPM" });
                                }
                                if (s.SensorType == SensorType.Temperature && s.Value.HasValue)
                                {
                                    if (s.Name.Contains("CPU", StringComparison.OrdinalIgnoreCase) && !cpuTemp.HasValue)
                                        cpuTemp = s.Value.Value;
                                }
                            }
                        }

                        // CPU
                        if (hw.HardwareType == HardwareType.Cpu)
                        {
                            foreach (var s in hw.Sensors)
                            {
                                if (s.SensorType == SensorType.Temperature && s.Value.HasValue)
                                {
                                    if (s.Name.Equals("CPU Package", StringComparison.OrdinalIgnoreCase) ||
                                        s.Name.Equals("Core Max", StringComparison.OrdinalIgnoreCase) ||
                                        s.Name.Equals("Core Average", StringComparison.OrdinalIgnoreCase))
                                    {
                                        cpuTemp = s.Value.Value;
                                    }
                                    else if (!cpuTemp.HasValue)
                                    {
                                        cpuTemp = s.Value.Value;
                                    }
                                }
                                else if (s.SensorType == SensorType.Load && s.Name.Equals("CPU Total", StringComparison.OrdinalIgnoreCase))
                                {
                                    cpuLoad = s.Value;
                                }
                            }
                        }

                        // GPU
                        if (hw.HardwareType == HardwareType.GpuNvidia || hw.HardwareType == HardwareType.GpuAmd || hw.HardwareType == HardwareType.GpuIntel)
                        {
                            gpuName = hw.Name;
                            foreach (var s in hw.Sensors)
                            {
                                if (s.SensorType == SensorType.Temperature)
                                {
                                    if (s.Name.Equals("GPU Core", StringComparison.OrdinalIgnoreCase))
                                        gpuTemp = s.Value;
                                    else if (s.Name.Equals("GPU Hot Spot", StringComparison.OrdinalIgnoreCase))
                                        gpuHotspot = s.Value;
                                }
                                else if (s.SensorType == SensorType.Fan)
                                {
                                    if (s.Value.HasValue)
                                    {
                                        gpuFanRpm = s.Value.Value;
                                        fanList.Add(new { Name = $"{hw.Name} ({s.Name})", RPM = (int)s.Value.Value, Status = $"{s.Value.Value:F0} RPM" });
                                    }
                                }
                                else if (s.SensorType == SensorType.Control && s.Name.Contains("Fan", StringComparison.OrdinalIgnoreCase))
                                {
                                    gpuFanPercent = s.Value;
                                }
                                else if (s.SensorType == SensorType.Load && s.Name.Equals("GPU Core", StringComparison.OrdinalIgnoreCase))
                                {
                                    gpuLoad = s.Value;
                                }
                                else if (s.SensorType == SensorType.SmallData && s.Name.Contains("Memory Used", StringComparison.OrdinalIgnoreCase))
                                {
                                    gpuMemUsed = s.Value;
                                }
                                else if (s.SensorType == SensorType.SmallData && s.Name.Contains("Memory Total", StringComparison.OrdinalIgnoreCase))
                                {
                                    gpuMemTotal = s.Value;
                                }
                            }
                        }

                        // Storage
                        if (hw.HardwareType == HardwareType.Storage)
                        {
                            foreach (var s in hw.Sensors)
                            {
                                if (s.SensorType == SensorType.Temperature && s.Value.HasValue)
                                {
                                    diskList.Add(new { Model = hw.Name, Temperature = (int)s.Value.Value });
                                    break;
                                }
                            }
                        }
                    }
                }
                catch {}
            }

            // Fallback for CPU load via WMI
            if (!cpuLoad.HasValue)
            {
                try
                {
                    using var searcher = new ManagementObjectSearcher("SELECT LoadPercentage FROM Win32_Processor");
                    foreach (var obj in searcher.Get())
                    {
                        cpuLoad = Convert.ToSingle(obj["LoadPercentage"]);
                        break;
                    }
                }
                catch {}
            }

            // Fallback for CPU temp via ACPI ThermalZone
            if (!cpuTemp.HasValue)
            {
                try
                {
                    using var tzSearcher = new ManagementObjectSearcher("SELECT HighPrecisionTemperature, Temperature FROM Win32_PerfFormattedData_Counters_ThermalZoneInformation");
                    foreach (var obj in tzSearcher.Get())
                    {
                        var hp = Convert.ToDouble(obj["HighPrecisionTemperature"]);
                        var t = Convert.ToDouble(obj["Temperature"]);
                        if (hp > 2700)
                            cpuTemp = (float)Math.Round(hp / 10.0 - 273.15, 1);
                        else if (t > 270)
                            cpuTemp = (float)Math.Round(t - 273.15, 1);
                        break;
                    }
                }
                catch {}
            }

            // Fallback for GPU via nvidia-smi
            if (!gpuTemp.HasValue)
            {
                try
                {
                    var p = new Process
                    {
                        StartInfo = new ProcessStartInfo
                        {
                            FileName = "nvidia-smi",
                            Arguments = "--query-gpu=name,temperature.gpu,fan.speed,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits",
                            RedirectStandardOutput = true,
                            UseShellExecute = false,
                            CreateNoWindow = true
                        }
                    };
                    p.Start();
                    var line = p.StandardOutput.ReadLine();
                    p.WaitForExit(1000);
                    if (!string.IsNullOrEmpty(line))
                    {
                        var parts = line.Split(',');
                        if (parts.Length >= 6)
                        {
                            gpuName = parts[0].Trim();
                            gpuTemp = float.Parse(parts[1].Trim());
                            gpuFanPercent = float.Parse(parts[2].Trim());
                            gpuLoad = float.Parse(parts[3].Trim());
                            gpuMemUsed = float.Parse(parts[4].Trim());
                            gpuMemTotal = float.Parse(parts[5].Trim());
                        }
                    }
                }
                catch {}
            }

            if (gpuFanPercent.HasValue && fanList.Count == 0)
            {
                fanList.Add(new { Name = $"{gpuName} Fan", RPM = 0, Status = gpuFanPercent.Value == 0 ? "Zero RPM Idle" : $"{gpuFanPercent.Value:F0}%" });
            }

            return new
            {
                Success = true,
                Timestamp = DateTime.Now.ToString("HH:mm:ss"),
                CPU = new
                {
                    LoadPercent = (int)(cpuLoad ?? 0),
                    TemperatureC = cpuTemp.HasValue ? Math.Round(cpuTemp.Value, 1) : (object?)null,
                    TemperatureF = cpuTemp.HasValue ? Math.Round(cpuTemp.Value * 1.8 + 32, 1) : (object?)null
                },
                GPU = new
                {
                    Name = gpuName,
                    TemperatureC = gpuTemp.HasValue ? (int)gpuTemp.Value : (object?)null,
                    TemperatureF = gpuTemp.HasValue ? Math.Round(gpuTemp.Value * 1.8 + 32, 1) : (object?)null,
                    HotspotC = gpuHotspot.HasValue ? Math.Round(gpuHotspot.Value, 1) : (object?)null,
                    FanPercent = gpuFanPercent.HasValue ? (int)gpuFanPercent.Value : (object?)null,
                    LoadPercent = (int)(gpuLoad ?? 0),
                    MemoryUsedMB = (int)(gpuMemUsed ?? 0),
                    MemoryTotalMB = (int)(gpuMemTotal ?? 0)
                },
                Fans = fanList,
                Disks = diskList
            };
        }

        public object GetBatteryData()
        {
            try
            {
                bool hasBattery = false;
                string name = "No Battery";
                string mfg = "OEM";
                string chemistry = "Li-Ion";
                int designCap = 0;
                int fullChargeCap = 0;
                int remainingPct = 100;
                int cycles = 0;
                string statusText = "Direct AC Power";

                using (var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_Battery"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        hasBattery = true;
                        name = obj["Name"]?.ToString() ?? "Internal Battery";
                        mfg = obj["Manufacturer"]?.ToString() ?? "OEM";
                        if (obj["DesignCapacity"] != null)
                            designCap = Convert.ToInt32(obj["DesignCapacity"]);
                        if (obj["FullChargeCapacity"] != null)
                            fullChargeCap = Convert.ToInt32(obj["FullChargeCapacity"]);
                        if (obj["EstimatedChargeRemaining"] != null)
                            remainingPct = Convert.ToInt32(obj["EstimatedChargeRemaining"]);
                        
                        var statusCode = obj["BatteryStatus"] != null ? Convert.ToInt32(obj["BatteryStatus"]) : 2;
                        statusText = statusCode switch
                        {
                            1 => "Đang dùng pin (Discharging)",
                            2 => "Đang cắm sạc (AC Connected)",
                            3 => "Pin yếu (Low)",
                            4 => "Pin rất yếu (Critical)",
                            5 => "Đang sạc (Charging)",
                            _ => "Đang cắm sạc (AC Connected)"
                        };
                        break;
                    }
                }

                // WMI BatteryStaticData
                if (hasBattery && (designCap == 0 || fullChargeCap == 0))
                {
                    try
                    {
                        using var staticSearcher = new ManagementObjectSearcher("root\\wmi", "SELECT * FROM BatteryStaticData");
                        foreach (var obj in staticSearcher.Get())
                        {
                            if (obj["DesignedCapacity"] != null)
                                designCap = Convert.ToInt32(obj["DesignedCapacity"]);
                            break;
                        }
                    }
                    catch {}

                    try
                    {
                        using var fullSearcher = new ManagementObjectSearcher("root\\wmi", "SELECT * FROM BatteryFullChargedCapacity");
                        foreach (var obj in fullSearcher.Get())
                        {
                            if (obj["FullChargedCapacity"] != null)
                                fullChargeCap = Convert.ToInt32(obj["FullChargedCapacity"]);
                            break;
                        }
                    }
                    catch {}
                }

                // Fallback to powercfg batteryreport
                var reportPath = Path.Combine(Path.GetTempPath(), "LongAT_BatteryReport.html");
                if (hasBattery && (designCap == 0 || fullChargeCap == 0))
                {
                    try
                    {
                        var p = Process.Start(new ProcessStartInfo
                        {
                            FileName = "powercfg",
                            Arguments = $"/batteryreport /output \"{reportPath}\"",
                            CreateNoWindow = true,
                            UseShellExecute = false
                        });
                        p?.WaitForExit(2500);

                        if (File.Exists(reportPath))
                        {
                            var html = File.ReadAllText(reportPath);
                            var matchDesign = System.Text.RegularExpressions.Regex.Match(html, @"DESIGN CAPACITY[\s\S]*?<td[^>]*>([\d,]+)\s*mWh");
                            if (matchDesign.Success) designCap = int.Parse(matchDesign.Groups[1].Value.Replace(",", ""));

                            var matchFull = System.Text.RegularExpressions.Regex.Match(html, @"FULL CHARGE CAPACITY[\s\S]*?<td[^>]*>([\d,]+)\s*mWh");
                            if (matchFull.Success) fullChargeCap = int.Parse(matchFull.Groups[1].Value.Replace(",", ""));

                            var matchCycles = System.Text.RegularExpressions.Regex.Match(html, @"CYCLE COUNT[\s\S]*?<td[^>]*>([\d,]+)</td>");
                            if (matchCycles.Success) cycles = int.Parse(matchCycles.Groups[1].Value.Replace(",", ""));
                        }
                    }
                    catch {}
                }

                if (!hasBattery)
                {
                    return new
                    {
                        Success = true,
                        HasBattery = false,
                        DeviceType = "Desktop PC / Cắm điện trực tiếp",
                        Name = "Không phát hiện pin",
                        Message = "Thiết bị là máy tính để bàn (Desktop PC) - Đang sử dụng nguồn điện trực tiếp AC (Bộ nguồn PSU).",
                        DesignCapacity_mWh = 0,
                        FullChargeCapacity_mWh = 0,
                        CurrentCharge_Percent = 100,
                        WearLevel_Percent = 0,
                        CycleCount = 0,
                        Status = "Nguồn trực tiếp AC (Power Supply)",
                        HealthStatus = "Nguồn điện AC trực tiếp",
                        HealthColor = "#10b981",
                        ReportPath = ""
                    };
                }

                double wearLevel = 0;
                if (designCap > 0 && fullChargeCap > 0)
                {
                    if (fullChargeCap <= designCap)
                        wearLevel = Math.Round(((designCap - fullChargeCap) / (double)designCap) * 100.0, 1);
                    else
                        wearLevel = 0;
                }

                string healthStatus = "Tốt";
                string healthColor = "#10b981";
                if (wearLevel <= 10) { healthStatus = "Xuất sắc (Pin như mới)"; healthColor = "#10b981"; }
                else if (wearLevel <= 20) { healthStatus = "Tốt (Hoạt động ổn định)"; healthColor = "#3b82f6"; }
                else if (wearLevel <= 35) { healthStatus = "Chai nhẹ (Dùng bình thường)"; healthColor = "#f59e0b"; }
                else if (wearLevel <= 50) { healthStatus = "Chai vừa (Thời lượng giảm đáng kể)"; healthColor = "#f97316"; }
                else { healthStatus = "Chai nặng (Nên thay pin mới)"; healthColor = "#ef4444"; }

                return new
                {
                    Success = true,
                    HasBattery = true,
                    DeviceType = "Laptop / Di động",
                    Name = name,
                    Manufacturer = mfg,
                    Chemistry = chemistry,
                    DesignCapacity_mWh = designCap,
                    FullChargeCapacity_mWh = fullChargeCap,
                    CurrentCharge_Percent = remainingPct,
                    WearLevel_Percent = wearLevel,
                    CycleCount = cycles,
                    Status = statusText,
                    HealthStatus = healthStatus,
                    HealthColor = healthColor,
                    ReportPath = reportPath
                };
            }
            catch (Exception ex)
            {
                return new { Success = false, Error = ex.Message };
            }
        }

        public void StartStressFan(int durationSeconds)
        {
            StopStressFan();
            _stressCts = new CancellationTokenSource();
            var token = _stressCts.Token;

            int threadCount = Math.Min(Environment.ProcessorCount, 8);
            var endTime = DateTime.Now.AddSeconds(durationSeconds);

            for (int i = 0; i < threadCount; i++)
            {
                Task.Run(() =>
                {
                    while (!token.IsCancellationRequested && DateTime.Now < endTime)
                    {
                        double x = 0;
                        for (int j = 0; j < 50000; j++)
                        {
                            x += Math.Sqrt(j) * Math.Sin(j);
                        }
                    }
                }, token);
            }
        }

        public void StopStressFan()
        {
            _stressCts?.Cancel();
            _stressCts = null;
        }

        public void Dispose()
        {
            StopStressFan();
            if (_isComputerOpen && _computer != null)
            {
                try { _computer.Close(); } catch {}
                _isComputerOpen = false;
            }
        }
    }
}
