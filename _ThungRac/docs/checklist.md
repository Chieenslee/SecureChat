# Checklist triển khai đề tài 16

## 1. Yêu cầu thuật toán

- [x] AES-256-CBC để mã hóa nội dung tin nhắn.
- [x] IV ngẫu nhiên 16 byte cho mỗi lần mã hóa.
- [x] RSA-2048 để bảo vệ khóa AES.
- [x] RSA PKCS#1 v1.5 bằng `node-forge`.
- [x] SHA-256 để kiểm tra toàn vẹn.
- [x] Chữ ký số RSA/SHA-256 cho metadata và message payload.
- [x] Không hard-code AES key, RSA key hoặc IV.

## 2. Luồng giao thức

- [x] Client tự sinh RSA keypair.
- [x] Client đăng ký public key lên server.
- [x] Client lấy public key của peer từ server.
- [x] Handshake có `session_id`, metadata, encrypted AES key và metadata signature.
- [x] Message packet có IV, ciphertext, hash, signature, timestamp và sequence number.
- [x] Receiver verify metadata signature.
- [x] Receiver decrypt AES key bằng RSA private key.
- [x] Receiver kiểm tra timestamp trước khi decrypt message.
- [x] Receiver chống replay bằng sequence number.
- [x] Receiver verify SHA-256 hash.
- [x] Receiver verify RSA signature.
- [x] Receiver decrypt AES-CBC và hiển thị plaintext.
- [x] ACK/NACK đi qua server relay.

## 3. Server relay

- [x] FastAPI server.
- [x] Serve frontend tại `/`.
- [x] WebSocket endpoint `/ws/{user_id}`.
- [x] API đăng ký public key `/register`.
- [x] API lấy public key `/public-key/{user_id}`.
- [x] API xem security log `/security-events`.
- [x] Server validate packet schema bằng Pydantic.
- [x] Server chặn sender mismatch.
- [x] Server chỉ relay packet, không decrypt plaintext.
- [x] Server log không chứa plaintext, AES key hoặc RSA private key.
- [x] Lưu public key và log vào SQLite thay vì RAM.
- [x] Hỗ trợ nhiều kết nối cho cùng một user.

## 4. Giao diện chạy thật

- [x] React web chat thật qua WebSocket.
- [x] Refactor React thành component: `Sidebar`, `ChatWindow`, `Composer`, `MessageBubble`, `AuthView`.
- [x] Tách state chat/auth/friend vào `ChatContext`.
- [x] Giao diện shell kiểu Telegram: sidebar chat list, topbar, timeline, composer.
- [x] Đăng ký/đăng nhập tài khoản.
- [x] Hồ sơ chi tiết: display name, bio, avatar color.
- [x] Modal cập nhật hồ sơ.
- [x] Chat ID dạng `#` + 8 chữ số do server sinh.
- [x] Kết bạn bằng Chat ID.
- [x] Search/preview user trước khi gửi lời mời kết bạn.
- [x] Chấp nhận hoặc từ chối lời mời kết bạn.
- [x] Chỉ chat được khi đã là bạn bè.
- [x] Không hiển thị log/packet trên trang chat.
- [x] Log bảo mật hiển thị ở CMD/server terminal.
- [x] Đăng nhập bằng ID cá nhân, không dùng ID mẫu mặc định.
- [x] Có thể nhập ID người nhận thủ công hoặc truyền qua query string.
- [x] Cột client hiện tại để nhập user/peer và gửi tin.
- [x] Cột server ở giữa hiển thị packet relay.
- [x] Cột peer hiển thị tin nhận.
- [x] Không còn nút mở nhanh ID mẫu cố định.
- [x] Nút xem server log.
- [x] Hiển thị ACK/NACK counter.
- [x] Hiển thị packet gần nhất đã rút gọn dữ liệu nhạy cảm.

## 5. Kiểm thử bảo mật

- [x] Gửi tin hợp lệ từ người dùng 1 -> người dùng 2.
- [x] Gửi tin hợp lệ từ người dùng 2 -> người dùng 1.
- [x] Peer offline hoặc chưa có public key.
- [x] Sửa ciphertext và nhận NACK integrity.
- [x] Sai chữ ký và nhận NACK signature.
- [x] Packet hết hạn và nhận NACK expired.
- [x] Replay packet và nhận NACK replay.
- [x] Sender mismatch được server từ chối.
- [x] Crypto self-test bằng `npm run test:crypto`.
- [x] Tự động hóa test WebSocket relay bằng `npm run test:relay`.
- [x] WebSocket xác thực bằng JWT.
- [x] Tin nhắn offline được lưu dạng packet mã hóa.

## 6. Tài liệu và báo cáo

- [x] README hướng dẫn chạy.
- [x] Báo cáo chính `report/bao_cao_bai_tap_lon.md`.
- [x] Threat model.
- [x] Protocol design.
- [x] Roadmap Telegram UI + group + AI tại `docs/telegram-ai-roadmap.md`.
- [x] Test cases.
- [x] Benchmark report.
- [x] Checklist triển khai.
- [x] Chèn ảnh chụp màn hình chạy thật vào báo cáo.
- [x] Xuất báo cáo sang PDF tại `submission/bao_cao_bai_tap_lon.pdf`.
- [ ] Thêm link GitHub sau khi upload vào `submission/submission-links.md`.
- [ ] Thêm link video trình bày 5-7 phút vào `submission/submission-links.md`.

## 7. Lệnh kiểm tra trước khi nộp

```powershell
npm run check:js
npm run build
npm run test:crypto
npm run test:relay
.\.venv\Scripts\python.exe -m py_compile server\main.py server\models.py server\storage.py server\auth.py server\websocket_handler.py scripts\ws_relay_test.py scripts\export_report.py
```

File nộp đã tạo:

- `submission/screenshot-secure-chat.png`
- `submission/bao_cao_bai_tap_lon.html`
- `submission/bao_cao_bai_tap_lon.pdf`
- `submission/submission-links.md`

Cập nhật link sau khi upload:

```powershell
.\.venv\Scripts\python.exe scripts\set_submission_links.py --github "https://github.com/..." --video "https://..."
```

## 8. Kịch bản trình bày đề xuất

1. Chạy server bằng `.\start.ps1`.
2. Người dùng 1 mở `http://127.0.0.1:8010/`, nhập ID cá nhân và ID người nhận.
3. Người dùng 2 mở `http://127.0.0.1:8010/`, nhập ID cá nhân và ID người nhận ngược lại.
4. Bấm `Đăng nhập / kết nối` ở cả hai tab.
5. Người dùng 1 gửi tin hợp lệ cho người dùng 2.
6. Người dùng 2 gửi tin hợp lệ ngược lại.
7. Bấm `Gửi packet sửa ciphertext`.
8. Bấm `Gửi packet sai chữ ký`.
9. Bấm `Gửi packet hết hạn`.
10. Gửi tin hợp lệ rồi bấm `Replay packet cuối`.
11. Bấm `Xem log server`.
12. Chạy `npm run test:crypto` trong terminal.
13. Chạy `npm run test:relay` để kiểm tra server relay và sender mismatch.
