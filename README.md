# SecureChat E2EE

Ứng dụng chat web thời gian thực với tính năng bảo mật tối đa, áp dụng chuẩn **Mã hóa đầu cuối (End-to-End Encryption - E2EE)**. Mọi tin nhắn cá nhân và nhóm đều được mã hóa ngay tại trình duyệt, máy chủ đóng vai trò chuyển tiếp tín hiệu và hoàn toàn không thể giải mã nội dung.

## ✨ Tính năng chính

- **Đăng ký & Đăng nhập an toàn:** Private key luôn được bảo vệ tại thiết bị bằng mật khẩu người dùng (PBKDF2), không bao giờ gửi lên server dưới dạng bản rõ.
- **Kết bạn qua Chat ID:** Ẩn danh và an toàn.
- **Nhắn tin Cá nhân (1-1):** Tin nhắn văn bản, emoji, GIF, sticker được mã hóa E2EE mượt mà.
- **Quản lý Nhóm bảo mật:**
  - Tạo nhóm và thêm bạn bè.
  - Tự động luân chuyển khóa nhóm an toàn (Group Key Rotation) khi có thay đổi thành viên.
  - Quản trị viên có quyền giải tán nhóm đồng bộ toàn hệ thống.
- **Giao diện Glassmorphism & Neon:** Thiết kế thân thiện, trực quan, hỗ trợ tiếng Việt 100% giống phong cách Telegram.

## 🔒 Công nghệ và Mật mã học

Hệ thống sử dụng các tiêu chuẩn mật mã học hiện đại nhất (`window.crypto.subtle` API ở Frontend) nhằm chống lại các cuộc tấn công đánh chặn (Man-in-the-Middle) và rò rỉ dữ liệu máy chủ:

- **Mã hóa bất đối xứng:** Hệ mật mã đường cong elliptic **ECDH (P-256)**. Thỏa thuận khóa phiên chia sẻ an toàn.
- **Mã hóa đối xứng:** **AES-256-GCM**.
  - *Chat 1-1:* Dùng khóa phiên chia sẻ từ ECDH.
  - *Chat nhóm:* Khóa ngẫu nhiên (AES-256) được Quản trị viên sinh ra và mã hóa bằng Public Key của từng thành viên trước khi phân phối an toàn qua server.
- **Xác thực & Toàn vẹn:** Thuật toán AES-GCM tự động cung cấp mã xác thực (MAC) chống giả mạo gói tin.
- **Giao thức mạng:** Liên lạc thời gian thực qua **WebSockets** kết hợp xác thực bằng JWT, chống Replay Attack.

## 🛠 Kiến trúc hệ thống

- **Backend:** Python, FastAPI, WebSockets, JWT, SQLite.
- **Frontend:** ReactJS, Vite, Lucide-react (Icon).

## 🚀 Chạy ứng dụng (Local)

**Yêu cầu hệ thống:** NodeJS, Python 3.9+.

```powershell
cd D:\My\ATBMTT
.\start.ps1
```

Script `start.ps1` sẽ tự động:
1. Tạo môi trường ảo Python (`.venv`) và cài dependencies.
2. Cài dependency cho Frontend và build React app.
3. Chạy Backend server (FastAPI/Uvicorn).

Sau khi server chạy thành công, truy cập trình duyệt tại:
```text
http://127.0.0.1:8010/
```

## 🧪 Kiểm thử

Chạy các bài kiểm tra bảo mật (Crypto) và WebSocket Relay:

```powershell
# Chạy test thuật toán mật mã
cd frontend
npm run test:crypto

# Chạy test WebSocket (Yêu cầu server đang chạy)
npm run test:relay
```

*Lưu ý: Môi trường Production cần cấu hình biến môi trường `SECURE_CHAT_JWT_SECRET` cho Backend và sử dụng HTTPS/WSS.*
