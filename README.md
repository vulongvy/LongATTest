<p align="center">
  <img src="logo.png" width="130" height="130" alt="Long AT Test Logo" style="border-radius: 50%;">
</p>

<h1 align="center">⚡ Long AT Test</h1>

<p align="center">
  <b>Phần Mềm Kiểm Tra Toàn Diện Phần Cứng Máy Tính & Laptop Chuẩn Kỹ Thuật Viên</b>
</p>

<p align="center">
  <a href="https://github.com/vulongvy/LongATTest/releases"><img src="https://img.shields.io/github/v/release/vulongvy/LongATTest?style=flat-square&color=blue" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-orange?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/package-winget-0078D4?style=flat-square&logo=windows" alt="Winget">
</p>

---

## 🚀 Cài Đặt Qua Windows Package Manager (Winget)

Bạn có thể cài đặt trực tiếp **Long AT Test** từ Terminal / PowerShell bằng lệnh `winget`:

```powershell
winget install LongAT.LongATTest
```

Để nâng cấp lên phiên bản mới nhất:
```powershell
winget upgrade LongAT.LongATTest
```

Để gỡ cài đặt:
```powershell
winget uninstall LongAT.LongATTest
```

---

## 💾 Tải Trực Tiếp (Direct Download)

Tải phiên bản mới nhất tại [**Releases**](https://github.com/vulongvy/LongATTest/releases):

- 📦 **Bản Cài Đặt (Setup Installer):** `LongATTest-Setup-1.0.0.exe` (Khuyên dùng, tự động tạo Shortcut ngoài Desktop & Start Menu).
- 🗂️ **Bản Portable (Không cần cài đặt):** `LongATTest-1.0.0-win-x64.zip` (Giải nén là chạy ngay).

---

## 🎯 8 Mô-Đun Kiểm Tra Chuẩn Xác

1. **⌨️ Bàn Phím (Key Test) — Độc lập 100%, Bắt Trọn F1 Đến F12:**
   - Tích hợp **Windows Low-Level Keyboard Hook (`WH_KEYBOARD_LL`)**: Bắt trực tiếp mọi phím từ tầng hệ điều hành.
   - **Triệt tiêu hoàn toàn lỗi F12 nhảy DevTools** và **F9 nhảy Immersive Reader**.
   - Bắt trọn vẹn: `F1 -> F12`, phím Windows (`Win`), `Alt`, `Tab`, `PrintScreen`, `Pause`...
   - Mỗi phím bấm đều sáng đèn và **hiển thị số lần bấm nhỏ (1, 2, 3...)** ở góc phải mỗi phím.

2. **🔋 Kiểm Tra Pin & Sạc (Battery Test):**
   - Dung lượng thiết kế gốc (**Design Capacity** - mWh).
   - Dung lượng sạc đầy hiện tại (**Full Charge Capacity** - mWh).
   - Mức pin hiện tại (%) và chu kỳ sạc pin (**Cycle Count**).
   - Tính toán chính xác **Độ chai pin (% Wear Level)** và phân cấp đánh giá.
   - Tự động nhận diện chuẩn xác **Máy tính để bàn (Desktop PC)** cắm điện trực tiếp AC (Nguồn PSU).
   - Nút 1-click mở báo cáo chi tiết **Windows Battery Report (.html)**.

3. **🖥️ Màn Hình LCD (Screen Test):**
   - Nhận diện độ phân giải thực và tần số quét (Hz).
   - Chế độ **Toàn Màn Hình (Fullscreen)** 100% không viền.
   - Bộ màu test điểm chết (Dead / Stuck Pixel), đốm sáng và hở sáng: Trắng, Đen, Đỏ, Lục, Lam, Vàng, Cyan, Magenta, Thang xám 256 cấp, Bảng màu chuẩn SMPTE.

4. **🔊 Kiểm Tra Loa (Speaker Test):**
   - **Loa Trái (Left Channel)** và **Loa Phải (Right Channel)** độc lập.
   - **Stereo** cân bằng hai loa.
   - Quét tần số âm thanh (20Hz – 20,000Hz) phát hiện rè màng loa.
   - Đoạn nhạc mẫu kiểm tra âm lượng tối đa.

5. **🎙️ Kiểm Tra Micro & Ghi Âm Thử (Microphone Test):**
   - Chọn Microphone (Mic laptop, jack 3.5mm, mic USB).
   - Đồng hồ đo âm lượng thực tế (**Live VU Meter 0 – 100%**) và sóng âm (**Oscilloscope**).
   - Nút **"Ghi âm thử 5 giây"** & Nút **"Nghe lại đoạn vừa ghi"** để kiểm tra tiếng xì/rè của mic.

6. **📷 Camera / Webcam (Camera Test):**
   - Hỗ trợ cả Webcam laptop và Camera USB cắm ngoài.
   - Hiển thị độ phân giải camera thực tế (1080p, 720p...) và tốc độ khung hình (FPS).
   - Chụp ảnh kiểm tra, xem lại và tải ảnh về máy (.png), chế độ lật gương (Mirror).

7. **💻 Cấu Hình Máy (System Specs) — ĐÃ CÂN CHỈNH CHUẨN XÁC 100%:**
   - **Card màn hình (GPU):** Đọc chuẩn xác dung lượng **VRAM 12 GB**, phiên bản Driver và độ phân giải.
   - **Bộ nhớ RAM:** Tính chuẩn tổng RAM đã cắm (**32 GB** với 2 thanh x 16GB, bus 3200 MHz), nhận diện đúng hãng sản xuất (Kingston, SSTC... thay vì mã hex).
   - **Ổ đĩa lưu trữ (Disks):** Hiển thị rõ chuẩn thương mại (**SSD 256 GB NVMe**, **HDD 1 TB SATA**, **HDD 6 TB SATA**) kèm dung lượng định dạng khả dụng và tình trạng sức khỏe (Healthy).
   - **Model & Bo mạch chủ:** Nhận diện thông minh bo mạch chủ rời (`PRIME B760M-A D4 (Desktop PC)`) và Serial mainboard.
   - **Bộ vi xử lý (CPU):** Intel Core i5-14400F (10 Cores / 16 Threads, Xung 2.50 GHz, Turbo Boost 4.70 GHz, L3 Cache 20 MB).
   - Nút xuất file cấu hình chi tiết (.txt) ra Desktop.

8. **🏷️ Driver Chuẩn Theo Serial (Driver by Serial):**
   - Nhận diện đúng hãng máy (Dell, HP, Lenovo, ASUS, Acer, MSI, Surface, Desktop PC...).
   - Trích xuất Serial Number / Service Tag từ BIOS / Mainboard.
   - Nút 1-click copy Serial và link trực tiếp đến trang tải driver chính hãng của hãng.

---

## 🛠️ Yêu Cầu Hệ Thống

- Hệ điều hành: Windows 10 (1809 trở lên) hoặc Windows 11 (64-bit).
- Microsoft .NET 8 Runtime (Desktop) hoặc cao hơn.
- Microsoft Edge WebView2 Runtime (đã tích hợp sẵn trên hầu hết các máy Windows 10/11 hiện nay).

---

## 📄 Bản Quyền (License)

Phát hành dưới giấy phép [MIT License](LICENSE).  
Bản quyền © 2026 **Đặng Vũ Long (Long AT)**.
