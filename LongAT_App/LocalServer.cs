using System;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace LongATTestApp
{
    public class LocalServer : IDisposable
    {
        private HttpListener _listener;
        private HardwareEngine _engine;
        private string _webDir;
        private string _scriptsDir;
        private bool _isRunning = false;
        private object? _cachedSpecs = null;

        public int Port { get; private set; } = 8765;

        public LocalServer(HardwareEngine engine, string baseDir)
        {
            _engine = engine;
            _webDir = Path.Combine(baseDir, "web");
            _scriptsDir = Path.Combine(baseDir, "scripts");
            _listener = new HttpListener();
        }

        public void Start()
        {
            try
            {
                _listener.Prefixes.Add($"http://127.0.0.1:{Port}/");
                _listener.Start();
            }
            catch
            {
                Port = 8766;
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://127.0.0.1:{Port}/");
                _listener.Start();
            }

            _isRunning = true;
            Task.Run(ListenLoop);
        }

        private async Task ListenLoop()
        {
            while (_isRunning && _listener.IsListening)
            {
                try
                {
                    var context = await _listener.GetContextAsync();
                    _ = Task.Run(() => HandleRequest(context));
                }
                catch
                {
                    if (!_isRunning) break;
                }
            }
        }

        private void HandleRequest(HttpListenerContext context)
        {
            var req = context.Request;
            var res = context.Response;

            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 200;
                res.Close();
                return;
            }

            var path = req.Url?.AbsolutePath ?? "/";

            try
            {
                if (path == "/api/thermal")
                {
                    SendJson(res, _engine.GetThermalData());
                    return;
                }
                if (path == "/api/battery")
                {
                    SendJson(res, _engine.GetBatteryData());
                    return;
                }
                if (path == "/api/specs")
                {
                    bool refresh = req.QueryString["refresh"] == "true";
                    if (_cachedSpecs == null || refresh)
                    {
                        var raw = RunPowerShell("get_specs.ps1");
                        try { _cachedSpecs = JsonSerializer.Deserialize<object>(raw); } catch { _cachedSpecs = new { Success = false }; }
                    }
                    SendJson(res, _cachedSpecs!);
                    return;
                }
                if (path == "/api/driver_info")
                {
                    SendJson(res, GetDriverInfo());
                    return;
                }
                if (path == "/api/stress_fan")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    var body = reader.ReadToEnd();
                    int duration = 15;
                    try
                    {
                        using var doc = JsonDocument.Parse(body);
                        if (doc.RootElement.TryGetProperty("duration", out var dProp))
                            duration = dProp.GetInt32();
                    }
                    catch {}
                    _engine.StartStressFan(duration);
                    SendJson(res, new { Success = true, Message = $"Đã chạy stress quạt trong {duration}s" });
                    return;
                }
                if (path == "/api/stop_stress")
                {
                    _engine.StopStressFan();
                    SendJson(res, new { Success = true, Message = "Đã dừng kiểm tra quạt" });
                    return;
                }
                if (path == "/api/open_action")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    var body = reader.ReadToEnd();
                    string action = "";
                    string url = "";
                    try
                    {
                        using var doc = JsonDocument.Parse(body);
                        if (doc.RootElement.TryGetProperty("action", out var aProp)) action = aProp.GetString() ?? "";
                        if (doc.RootElement.TryGetProperty("url", out var uProp)) url = uProp.GetString() ?? "";
                    }
                    catch {}

                    if (action == "devmgmt") Process.Start(new ProcessStartInfo("devmgmt.msc") { UseShellExecute = true });
                    else if (action == "winupdate") Process.Start(new ProcessStartInfo("ms-settings:windowsupdate") { UseShellExecute = true });
                    else if (action == "url" && (url.StartsWith("http://") || url.StartsWith("https://"))) Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });

                    SendJson(res, new { Success = true });
                    return;
                }
                if (path == "/api/open_battery_report")
                {
                    var rPath = Path.Combine(Path.GetTempPath(), "LongAT_BatteryReport.html");
                    if (File.Exists(rPath))
                    {
                        Process.Start(new ProcessStartInfo(rPath) { UseShellExecute = true });
                        SendJson(res, new { Success = true, Path = rPath });
                    }
                    else
                    {
                        var p = Process.Start(new ProcessStartInfo("powercfg", $"/batteryreport /output \"{rPath}\"") { UseShellExecute = false, CreateNoWindow = true });
                        p?.WaitForExit(2000);
                        if (File.Exists(rPath))
                        {
                            Process.Start(new ProcessStartInfo(rPath) { UseShellExecute = true });
                            SendJson(res, new { Success = true, Path = rPath });
                        }
                        else
                        {
                            SendJson(res, new { Success = false, Error = "Không thể tạo báo cáo pin" });
                        }
                    }
                    return;
                }
                if (path == "/api/export_report")
                {
                    ExportReport(res);
                    return;
                }

                // Serve static files from web/
                if (path == "/") path = "/index.html";
                var filePath = Path.Combine(_webDir, path.TrimStart('/').Replace('/', '\\'));

                if (File.Exists(filePath))
                {
                    var ext = Path.GetExtension(filePath).ToLower();
                    res.ContentType = ext switch
                    {
                        ".html" => "text/html; charset=utf-8",
                        ".css" => "text/css; charset=utf-8",
                        ".js" => "application/javascript; charset=utf-8",
                        ".png" => "image/png",
                        ".jpg" or ".jpeg" => "image/jpeg",
                        ".svg" => "image/svg+xml",
                        _ => "application/octet-stream"
                    };

                    var bytes = File.ReadAllBytes(filePath);
                    res.ContentLength64 = bytes.Length;
                    res.OutputStream.Write(bytes, 0, bytes.Length);
                    res.Close();
                    return;
                }

                res.StatusCode = 404;
                res.Close();
            }
            catch (Exception ex)
            {
                try
                {
                    res.StatusCode = 500;
                    var errBytes = Encoding.UTF8.GetBytes(ex.Message);
                    res.OutputStream.Write(errBytes, 0, errBytes.Length);
                    res.Close();
                }
                catch {}
            }
        }

        private void SendJson(HttpListenerResponse res, object data)
        {
            var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
            var bytes = Encoding.UTF8.GetBytes(json);
            res.ContentType = "application/json; charset=utf-8";
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        private string RunPowerShell(string scriptName)
        {
            var scriptPath = Path.Combine(_scriptsDir, scriptName);
            if (!File.Exists(scriptPath)) return "{}";

            try
            {
                var p = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{scriptPath}\"",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        StandardOutputEncoding = Encoding.UTF8
                    }
                };
                p.Start();
                var output = p.StandardOutput.ReadToEnd();
                p.WaitForExit(15000);
                return output;
            }
            catch (Exception ex)
            {
                return JsonSerializer.Serialize(new { Success = false, Error = ex.Message });
            }
        }

        private object GetDriverInfo()
        {
            try
            {
                string brand = "", model = "", serial = "", boardMfg = "", boardModel = "", boardSerial = "";

                using (var searcher = new ManagementObjectSearcher("SELECT Manufacturer, Model FROM Win32_ComputerSystem"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        brand = obj["Manufacturer"]?.ToString()?.Trim() ?? "";
                        model = obj["Model"]?.ToString()?.Trim() ?? "";
                        break;
                    }
                }

                using (var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        serial = obj["SerialNumber"]?.ToString()?.Trim() ?? "";
                        break;
                    }
                }

                using (var searcher = new ManagementObjectSearcher("SELECT Manufacturer, Product, SerialNumber FROM Win32_BaseBoard"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        boardMfg = obj["Manufacturer"]?.ToString()?.Trim() ?? "";
                        boardModel = obj["Product"]?.ToString()?.Trim() ?? "";
                        boardSerial = obj["SerialNumber"]?.ToString()?.Trim() ?? "";
                        break;
                    }
                }

                string cleanSerial = serial;
                var low = serial.ToLower();
                if (low is "system serial number" or "to be filled by o.e.m." or "default string" or "00000000" or "none" or "")
                {
                    cleanSerial = (!string.IsNullOrEmpty(boardSerial) && boardSerial.ToLower() != "default string") ? boardSerial : "";
                }

                string oemType = "Generic";
                string driverUrl = "";
                string guide = "";

                var brandLow = brand.ToLower();
                if (brandLow.Contains("dell"))
                {
                    oemType = "Dell";
                    driverUrl = !string.IsNullOrEmpty(cleanSerial)
                        ? $"https://www.dell.com/support/home/vi-vn/product-support/servicetag/{cleanSerial}/drivers"
                        : "https://www.dell.com/support/home/vi-vn/products?app=drivers";
                    guide = "Dell sử dụng Service Tag để tải driver chính xác. Khuyến nghị cài Dell SupportAssist.";
                }
                else if (brandLow.Contains("hp") || brandLow.Contains("hewlett"))
                {
                    oemType = "HP";
                    driverUrl = !string.IsNullOrEmpty(cleanSerial)
                        ? $"https://support.hp.com/vn-en/drivers/search?q={cleanSerial}"
                        : "https://support.hp.com/vn-en/drivers";
                    guide = "HP nhận diện theo Serial Number hoặc Product Number. Dùng HP Support Assistant để tự động cập nhật.";
                }
                else if (brandLow.Contains("lenovo"))
                {
                    oemType = "Lenovo";
                    driverUrl = !string.IsNullOrEmpty(cleanSerial)
                        ? $"https://pcsupport.lenovo.com/vn/en/products/search?query={cleanSerial}"
                        : "https://pcsupport.lenovo.com/vn/en";
                    guide = "Lenovo tự động cập nhật driver theo Serial Number. Cài Lenovo Vantage trên Microsoft Store.";
                }
                else if (brandLow.Contains("acer"))
                {
                    oemType = "Acer";
                    driverUrl = !string.IsNullOrEmpty(cleanSerial)
                        ? $"https://www.acer.com/vn-vi/support/drivers-and-manuals?sn={cleanSerial}"
                        : "https://www.acer.com/vn-vi/support";
                    guide = "Acer tra cứu theo mã SNID hoặc Serial trên tem máy.";
                }
                else if (brandLow.Contains("asus") || boardMfg.ToLower().Contains("asus"))
                {
                    oemType = "ASUS";
                    driverUrl = "https://www.asus.com/vn/support/download-center/";
                    guide = $"ASUS: Tra cứu theo Model [{model}] hoặc số Serial [{cleanSerial}]. Dùng MyASUS / Armoury Crate.";
                }
                else if (brandLow.Contains("msi"))
                {
                    oemType = "MSI";
                    driverUrl = "https://vn.msi.com/support/download/";
                    guide = $"MSI: Tra cứu driver theo model [{model}] hoặc dùng MSI Center.";
                }
                else
                {
                    oemType = $"Desktop PC ({boardMfg})";
                    string q = $"{boardMfg} {boardModel} driver download support";
                    driverUrl = $"https://www.google.com/search?q={Uri.EscapeDataString(q)}";
                    guide = $"Máy tính bàn: Driver chuẩn theo Bo mạch chủ [{boardMfg} {boardModel}].";
                }

                return new
                {
                    Brand = brand,
                    Model = model,
                    Serial = serial,
                    CleanSerial = cleanSerial,
                    BoardManufacturer = boardMfg,
                    BoardModel = boardModel,
                    BoardSerial = boardSerial,
                    OEMType = oemType,
                    DriverURL = driverUrl,
                    Guide = guide
                };
            }
            catch (Exception ex)
            {
                return new { Success = false, Error = ex.Message };
            }
        }

        private void ExportReport(HttpListenerResponse res)
        {
            try
            {
                var desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                var filename = $"LongAT_TestReport_{DateTime.Now:yyyyMMdd_HHmmss}.txt";
                var filepath = Path.Combine(desktop, filename);

                var sb = new StringBuilder();
                sb.AppendLine("============================================================");
                sb.AppendLine("             LONG AT TEST - BÁO CÁO KIỂM TRA MÁY TÍNH");
                sb.AppendLine($"             Thời gian: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
                sb.AppendLine("============================================================");
                sb.AppendLine();

                var rawSpecs = RunPowerShell("get_specs.ps1");
                sb.AppendLine("CHI TIẾT CẤU HÌNH:");
                sb.AppendLine(rawSpecs);

                File.WriteAllText(filepath, sb.ToString(), Encoding.UTF8);
                SendJson(res, new { Success = true, FilePath = filepath });
            }
            catch (Exception ex)
            {
                SendJson(res, new { Success = false, Error = ex.Message });
            }
        }

        public void Dispose()
        {
            _isRunning = false;
            try { _listener.Stop(); _listener.Close(); } catch {}
        }
    }
}
