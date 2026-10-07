#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Long AT Test - Hardware Diagnostic & Testing Suite
Backend Server & Hardware API Bridge
"""

import os
import sys

if sys.platform == 'win32':
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import http.server
import socketserver
import json
import subprocess
import threading
import time
import webbrowser
import urllib.parse
from pathlib import Path

PORT = 8765
BASE_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = BASE_DIR / "scripts"
WEB_DIR = BASE_DIR / "web"

# Cache for static specs
cached_specs = None
stress_process = None
stress_lock = threading.Lock()

def run_powershell(script_name, args=None, timeout=20):
    """Run a PowerShell script from the scripts directory and return stdout."""
    script_path = SCRIPTS_DIR / script_name
    cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script_path)]
    if args:
        cmd.extend(args)
    
    try:
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = 0 # SW_HIDE
        
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore',
            timeout=timeout,
            startupinfo=startupinfo
        )
        return proc.stdout.strip()
    except Exception as e:
        return json.dumps({"Success": False, "Error": str(e)})

def get_system_specs(force_refresh=False):
    global cached_specs
    if cached_specs is None or force_refresh:
        raw = run_powershell("get_specs.ps1", timeout=30)
        try:
            cached_specs = json.loads(raw)
        except Exception:
            cached_specs = {"Success": False, "Raw": raw}
    return cached_specs

def get_battery_info():
    raw = run_powershell("get_battery.ps1", timeout=15)
    try:
        return json.loads(raw)
    except Exception:
        return {"Success": False, "Raw": raw}

def get_thermal_info():
    raw = run_powershell("get_thermal.ps1", timeout=10)
    try:
        return json.loads(raw)
    except Exception:
        return {"Success": False, "Raw": raw}

def compute_driver_info():
    specs = get_system_specs()
    sys_info = specs.get("System", {})
    bios_info = specs.get("BIOS", {})
    board_info = specs.get("Motherboard", {})

    brand = (sys_info.get("Manufacturer") or "").strip()
    model = (sys_info.get("Model") or "").strip()
    serial = (bios_info.get("SerialNumber") or "").strip()
    board_mfg = (board_info.get("Manufacturer") or "").strip()
    board_model = (board_info.get("Product") or "").strip()
    board_serial = (board_info.get("SerialNumber") or "").strip()

    # Normalize manufacturer
    brand_lower = brand.lower()
    oem_type = "generic"
    driver_url = ""
    guide = ""

    # Serial cleanup (ignore generic placeholder serials)
    clean_serial = serial
    if serial.lower() in ["system serial number", "to be filled by o.e.m.", "default string", "00000000", "none", ""]:
        clean_serial = board_serial if board_serial and board_serial.lower() not in ["default string", "to be filled by o.e.m."] else ""

    if "dell" in brand_lower:
        oem_type = "Dell"
        if clean_serial:
            driver_url = f"https://www.dell.com/support/home/vi-vn/product-support/servicetag/{urllib.parse.quote(clean_serial)}/drivers"
        else:
            driver_url = "https://www.dell.com/support/home/vi-vn/products?app=drivers"
        guide = "Dell sử dụng Service Tag (7 ký tự). Bạn có thể tải trực tiếp driver hoặc dùng Dell SupportAssist."
    elif "hp" in brand_lower or "hewlett" in brand_lower:
        oem_type = "HP"
        if clean_serial:
            driver_url = f"https://support.hp.com/vn-en/drivers/search?q={urllib.parse.quote(clean_serial)}"
        else:
            driver_url = "https://support.hp.com/vn-en/drivers"
        guide = "HP nhận diện driver theo Số Serial hoặc Product Number. Khuyến nghị dùng HP Support Assistant."
    elif "lenovo" in brand_lower:
        oem_type = "Lenovo"
        if clean_serial:
            driver_url = f"https://pcsupport.lenovo.com/vn/en/products/search?query={urllib.parse.quote(clean_serial)}"
        else:
            driver_url = "https://pcsupport.lenovo.com/vn/en"
        guide = "Lenovo tự động nhận diện cấu hình theo Serial Number. Có thể cài Lenovo Vantage trên Microsoft Store."
    elif "acer" in brand_lower:
        oem_type = "Acer"
        if clean_serial:
            driver_url = f"https://www.acer.com/vn-vi/support/drivers-and-manuals?sn={urllib.parse.quote(clean_serial)}"
        else:
            driver_url = "https://www.acer.com/vn-vi/support"
        guide = "Acer tra cứu qua mã SNID hoặc Serial Number trên thân máy."
    elif "asus" in brand_lower or "asustek" in brand_lower or "asus" in board_mfg.lower():
        oem_type = "ASUS"
        query_model = model if model and model.lower() != "system product name" else board_model
        driver_url = f"https://www.asus.com/vn/support/download-center/"
        guide = f"ASUS: Tra cứu theo Model [{query_model}] hoặc số Serial [{clean_serial}]. Khuyến nghị dùng MyASUS / Armoury Crate."
    elif "msi" in brand_lower or "micro-star" in brand_lower:
        oem_type = "MSI"
        query_model = model if model and model.lower() != "system product name" else board_model
        driver_url = f"https://vn.msi.com/support/download/"
        guide = f"MSI: Tra cứu driver theo tên dòng máy [{query_model}] hoặc dùng MSI Center."
    elif "surface" in brand_lower or "microsoft" in brand_lower:
        oem_type = "Microsoft Surface"
        driver_url = "https://support.microsoft.com/en-us/surface/download-drivers-and-firmware-for-surface-09bb2e09-2a4b-4cb6-96b9-a028dc35ba77"
        guide = "Microsoft Surface cung cấp gói cài đặt trọn gói Driver & Firmware MSI chuẩn cho từng model."
    elif "apple" in brand_lower:
        oem_type = "Apple"
        driver_url = "https://support.apple.com/boot-camp"
        guide = "Máy Mac chạy Windows: Cài đặt Apple Boot Camp Support Software."
    else:
        # Custom PC / Desktop Motherboard
        oem_type = f"Desktop PC ({board_mfg or 'Motherboard'})"
        query_target = f"{board_mfg} {board_model}".strip() or model
        driver_url = f"https://www.google.com/search?q={urllib.parse.quote(query_target + ' driver download support')}"
        guide = f"Máy tính bàn lắp ráp: Driver chính hãng được cung cấp theo Bo Mạch Chủ (Mainboard) [{query_target}]."

    return {
        "Brand": brand,
        "Model": model,
        "Serial": serial,
        "CleanSerial": clean_serial,
        "BoardManufacturer": board_mfg,
        "BoardModel": board_model,
        "BoardSerial": board_serial,
        "OEMType": oem_type,
        "DriverURL": driver_url,
        "Guide": guide
    }

class LongATRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def log_message(self, format, *args):
        # Quiet standard HTTP logs to keep console clean
        pass

    def end_headers(self):
        # Enable CORS and caching headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/specs":
            refresh = query.get("refresh", ["false"])[0].lower() == "true"
            data = get_system_specs(force_refresh=refresh)
            self.send_json(data)
            return

        elif path == "/api/battery":
            data = get_battery_info()
            self.send_json(data)
            return

        elif path == "/api/thermal":
            data = get_thermal_info()
            self.send_json(data)
            return

        elif path == "/api/driver_info":
            data = compute_driver_info()
            self.send_json(data)
            return

        elif path == "/api/open_battery_report":
            report_path = os.path.expandvars(r"%TEMP%\LongAT_BatteryReport.html")
            if os.path.exists(report_path):
                os.startfile(report_path)
                self.send_json({"Success": True, "Path": report_path})
            else:
                # Generate report on the fly
                subprocess.run(["powercfg", "/batteryreport", "/output", report_path], capture_output=True)
                if os.path.exists(report_path):
                    os.startfile(report_path)
                    self.send_json({"Success": True, "Path": report_path})
                else:
                    self.send_json({"Success": False, "Error": "Không thể tạo báo cáo pin (có thể do máy tính bàn không có pin)"})
            return

        # Serve static files
        return super().do_GET()

    def do_POST(self):
        global stress_process
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_len).decode('utf-8') if content_len > 0 else "{}"
        
        try:
            body_data = json.loads(post_body)
        except Exception:
            body_data = {}

        if path == "/api/stress_fan":
            duration = int(body_data.get("duration", 15))
            duration = max(5, min(duration, 60)) # Clamp between 5s and 60s
            
            with stress_lock:
                if stress_process and stress_process.poll() is None:
                    try:
                        stress_process.terminate()
                    except Exception:
                        pass
                
                script_path = SCRIPTS_DIR / "stress_cpu.ps1"
                cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script_path), "-Duration", str(duration)]
                
                startupinfo = None
                if os.name == 'nt':
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    startupinfo.wShowWindow = 0

                stress_process = subprocess.Popen(cmd, startupinfo=startupinfo)
            
            self.send_json({"Success": True, "Duration": duration, "Message": f"Đã kích hoạt tải quạt trong {duration} giây"})
            return

        elif path == "/api/stop_stress":
            with stress_lock:
                if stress_process and stress_process.poll() is None:
                    try:
                        stress_process.terminate()
                    except Exception:
                        pass
                    stress_process = None
            self.send_json({"Success": True, "Message": "Đã dừng kiểm tra quạt"})
            return

        elif path == "/api/open_action":
            action = body_data.get("action", "")
            if action == "devmgmt":
                subprocess.Popen(["devmgmt.msc"], shell=True)
                self.send_json({"Success": True})
            elif action == "winupdate":
                subprocess.Popen(["start", "ms-settings:windowsupdate"], shell=True)
                self.send_json({"Success": True})
            elif action == "url":
                url = body_data.get("url", "")
                if url.startswith("http://") or url.startswith("https://"):
                    webbrowser.open(url)
                    self.send_json({"Success": True})
                else:
                    self.send_json({"Success": False, "Error": "Invalid URL"})
            else:
                self.send_json({"Success": False, "Error": "Unknown action"})
            return

        elif path == "/api/export_report":
            # Generate comprehensive text inspection report
            specs = get_system_specs()
            battery = get_battery_info()
            thermal = get_thermal_info()
            driver = compute_driver_info()

            desktop_dir = Path(os.path.expanduser("~")) / "Desktop"
            filename = f"LongAT_TestReport_{time.strftime('%Y%m%d_%H%M%S')}.txt"
            filepath = desktop_dir / filename

            lines = [
                "=" * 60,
                "             LONG AT TEST - BÁO CÁO KIỂM TRA MÁY TÍNH",
                f"             Thời gian: {time.strftime('%Y-%m-%d %H:%M:%S')}",
                "=" * 60,
                "",
                "1. THÔNG TIN THIẾT BỊ:",
                f"   - Hãng sản xuất  : {specs.get('System', {}).get('Manufacturer', 'N/A')}",
                f"   - Model          : {specs.get('System', {}).get('Model', 'N/A')}",
                f"   - Serial Number  : {specs.get('BIOS', {}).get('SerialNumber', 'N/A')}",
                f"   - Bo mạch chủ    : {specs.get('Motherboard', {}).get('Product', 'N/A')} ({specs.get('Motherboard', {}).get('Manufacturer', 'N/A')})",
                f"   - Serial Main    : {specs.get('Motherboard', {}).get('SerialNumber', 'N/A')}",
                f"   - BIOS Version   : {specs.get('BIOS', {}).get('Version', 'N/A')} (Ngày: {specs.get('BIOS', {}).get('ReleaseDate', 'N/A')})",
                f"   - Hệ điều hành   : {specs.get('OS', {}).get('Caption', 'N/A')} ({specs.get('OS', {}).get('OSArchitecture', 'N/A')})",
                f"   - Build Windows  : {specs.get('OS', {}).get('BuildNumber', 'N/A')}",
                "",
                "2. CẤU HÌNH PHẦN CỨNG:",
                f"   - Bộ vi xử lý    : {specs.get('CPU', {}).get('Name', 'N/A')}",
                f"   - Số nhân / luồng: {specs.get('CPU', {}).get('NumberOfCores', 'N/A')} Cores / {specs.get('CPU', {}).get('NumberOfLogicalProcessors', 'N/A')} Threads",
                f"   - Xung nhịp      : {specs.get('CPU', {}).get('MaxClockSpeedMHz', 'N/A')} MHz",
                f"   - Tổng RAM       : {specs.get('Memory', {}).get('TotalGB', 'N/A')} GB ({specs.get('Memory', {}).get('UsedSlots', 'N/A')}/{specs.get('Memory', {}).get('TotalSlots', 'N/A')} khe)",
            ]

            sticks = specs.get('Memory', {}).get('Sticks', [])
            for idx, st in enumerate(sticks, 1):
                lines.append(f"     + Khe {idx}: {st.get('CapacityGB')}GB {st.get('Type')} {st.get('SpeedMHz')}MHz - Hãng: {st.get('Manufacturer')} ({st.get('SerialNumber')})")

            lines.append("")
            lines.append("   - Card đồ họa (GPU):")
            for g in specs.get('GPUs', []):
                lines.append(f"     + {g.get('Name')} | VRAM: {g.get('VRAM_GB')}GB | Driver: {g.get('DriverVersion')} | Độ phân giải: {g.get('Resolution')}")

            lines.append("")
            lines.append("   - Ổ cứng lưu trữ:")
            for d in specs.get('Storage', {}).get('PhysicalDisks', []):
                lines.append(f"     + {d.get('Model')} ({d.get('MediaType')} {d.get('BusType')}) - {d.get('SizeGB')} GB | Tình trạng: {d.get('Health')}")

            lines.append("")
            lines.append("3. TÌNH TRẠNG PIN:")
            if battery.get("HasBattery"):
                lines.extend([
                    f"   - Loại pin       : {battery.get('Name')} ({battery.get('Chemistry')})",
                    f"   - Thiết kế       : {battery.get('DesignCapacity_mWh')} mWh",
                    f"   - Sạc đầy        : {battery.get('FullChargeCapacity_mWh')} mWh",
                    f"   - Mức pin hiện tại: {battery.get('CurrentCharge_Percent')}%",
                    f"   - ĐỘ CHAI PIN    : {battery.get('WearLevel_Percent')}%",
                    f"   - Số chu kỳ sạc  : {battery.get('CycleCount')} lần",
                    f"   - Đánh giá       : {battery.get('Status')} - {battery.get('HealthStatus', 'Tốt')}"
                ])
            else:
                lines.append("   - Thiết bị: Máy tính để bàn (Desktop PC) - Cắm điện trực tiếp AC (Không dùng pin)")

            lines.append("")
            lines.append("4. NHIỆT ĐỘ & TẢN NHIỆT:")
            lines.append(f"   - Nhiệt độ CPU   : {thermal.get('CPU', {}).get('TemperatureC', 'N/A')} °C (Tải: {thermal.get('CPU', {}).get('LoadPercent', 0)}%)")
            lines.append(f"   - Nhiệt độ GPU   : {thermal.get('GPU', {}).get('TemperatureC', 'N/A')} °C (Tải: {thermal.get('GPU', {}).get('LoadPercent', 0)}%)")
            
            lines.append("")
            lines.append("5. TRA CỨU DRIVER CHÍNH HÃNG:")
            lines.append(f"   - Hãng phân loại : {driver.get('OEMType')}")
            lines.append(f"   - Serial / Tag   : {driver.get('CleanSerial') or 'N/A'}")
            lines.append(f"   - Link tải driver: {driver.get('DriverURL')}")
            lines.append("")
            lines.append("=" * 60)
            lines.append("      Được tạo bởi phần mềm kiểm tra phần cứng Long AT Test")
            lines.append("=" * 60)

            try:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write("\n".join(lines))
                self.send_json({"Success": True, "FilePath": str(filepath)})
            except Exception as e:
                self.send_json({"Success": False, "Error": str(e)})
            return

        self.send_json({"Success": False, "Error": "Endpoint not found"}, status=404)

def launch_app_window(url):
    """Launch Microsoft Edge in native App mode, or Chrome, or default browser."""
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    for ep in edge_paths:
        if os.path.exists(ep):
            cmd = [ep, f"--app={url}", "--window-size=1380,880"]
            try:
                subprocess.Popen(cmd)
                return
            except Exception:
                pass

    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
    ]
    for cp in chrome_paths:
        if os.path.exists(cp):
            cmd = [cp, f"--app={url}", "--window-size=1380,880"]
            try:
                subprocess.Popen(cmd)
                return
            except Exception:
                pass

    # Fallback to default browser
    webbrowser.open(url)

def main():
    # Warm up specs in background thread
    threading.Thread(target=get_system_specs, daemon=True).start()

    server_address = ('127.0.0.1', PORT)
    
    # Check if port is already in use, or pick another if needed
    try:
        httpd = socketserver.TCPServer(server_address, LongATRequestHandler)
    except OSError:
        # Try port 8766
        httpd = socketserver.TCPServer(('127.0.0.1', PORT + 1), LongATRequestHandler)
        globals()['PORT'] = PORT + 1

    app_url = f"http://127.0.0.1:{PORT}"
    print("=" * 60)
    print("       LONG AT TEST - TOOL KIEM TRA PHAN CUNG MAY TINH")
    print(f"       Ung dung dang chay tai: {app_url}")
    print("=" * 60)

    # Launch UI
    threading.Timer(1.0, lambda: launch_app_window(app_url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nĐang tắt máy chủ Long AT Test...")
        httpd.server_close()

if __name__ == '__main__':
    main()
