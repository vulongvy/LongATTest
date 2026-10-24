# 📋 CẨM NANG "VIBE CODING" ĐA MÁY TÍNH — LONG AT TEST

Tài liệu hướng dẫn tiếp tục lập trình, chỉnh sửa và đóng gói công cụ **Long AT Test** trên bất kỳ máy tính mới nào.

---

## 1. 🔍 NGUYÊN NHÂN LỖI TRƯỚC ĐÂY KHI CHUYỂN MÁY:
- `LongATTest.bat` gọi trực tiếp `LongATTest.exe` (.NET 8 WPF).
- Máy tính mới chưa cài **.NET 8.0 Desktop Runtime** và **WebView2 Runtime**, do đó app không thể khởi chạy.
- Ngoài ra, file `server.py` trước đó chưa có file `.bat` nhận diện tự động đường dẫn Python của Windows.

---

## 2. ⚡ CÁCH DÙNG 2 FILE KHỞI ĐỘNG MỚI (ĐÃ FIX 100%):

1. **`Start_Tool.bat` (Khuyên Dùng - Tự Động 100%):**
   - Tự động mở khóa file chống Windows Defender chặn.
   - Tự động tải tài nguyên từ GitHub nếu thiếu (chỉ cần file này là tải đủ cả bộ).
   - Tự động kiểm tra và cài đặt ngầm .NET 8 Desktop Runtime & WebView2 nếu máy chưa có.
   - Khởi chạy ứng dụng Standalone EXE Native.

2. **`Run_Python.bat` (Dành Cho Máy Có Sẵn Python):**
   - Tự động dò tìm `python`, `py`, `python3` hoặc thư mục AppData.
   - Chạy máy chủ `server.py` nội bộ (chỉ dùng thư viện chuẩn của Python, không cần cài pip).
   - Tự động mở Microsoft Edge / Google Chrome ở chế độ Native App Window.

---

## 3. 🚀 QUY TRÌNH TIẾP TỤC "VIBE CODING" TRÊN MÁY MỚI:

### Bước 1: Kéo code từ GitHub về
```bash
git clone https://github.com/vulongvy/LongATTest.git
cd LongATTest
```

### Bước 2: Vòng lặp phát triển nhanh (Live Coding Loop)
- **Sửa Giao Diện & Logic Web:** Sửa các file trong thư mục `web/` (`index.html`, `styles.css`, `app.js`). Sau đó chạy `Run_Python.bat`, nhấn `Ctrl + F5` trên trình duyệt để kiểm tra tức thì mà không cần biên dịch lại.
- **Sửa Logic Đo Phần Cứng:** Sửa file trong thư mục `scripts/` (`get_specs.ps1`, `get_battery.ps1`). Chạy thử trực tiếp: `powershell -ExecutionPolicy Bypass -File scripts\get_specs.ps1`.
- **Sửa Tầng Native C#:** Mở thư mục `LongAT_App/` bằng VS Code / Visual Studio, sửa code rồi chạy `dotnet run`.

### Bước 3: Đóng gói lại sau khi sửa
1. Biên dịch Standalone EXE:
   ```powershell
   dotnet publish LongAT_App/LongATTestApp.csproj -c Release -o publish /p:PublishSingleFile=true /p:SelfContained=false
   Copy-Item "publish\LongATTest.exe" -Destination "LongATTest.exe" -Force
   ```
2. Đóng gói bản siêu nhẹ (~232 KB) để gửi cho người khác:
   Chạy lệnh tạo file `dist\LongATTest_QuickStart_v1.0.0.zip`.

---

## 4. 📂 BẢNG CẤU TRÚC FILE CHÍNH:
- `Start_Tool.bat` & `Start_Tool.ps1`: Trình khởi chạy thông minh tự động tải phụ thuộc.
- `Run_Python.bat`: Trình khởi chạy 1-click chế độ Python.
- `server.py`: Backend Python REST API.
- `web/`: Mã nguồn giao diện HTML5, CSS3, JavaScript.
- `scripts/`: Bộ script PowerShell đọc thông số phần cứng.
- `LongAT_App/`: Mã nguồn C# WPF với Low-level Keyboard Hook `WH_KEYBOARD_LL`.
- `installer.iss`: Script tạo bộ cài đặt Inno Setup.
