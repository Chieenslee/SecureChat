# Báo Cáo Đồ Án: Ứng Dụng Chat Mã Hóa Đầu Cuối (SecureChat E2EE)
**Môn học:** An Toàn Bảo Mật Thông Tin

## 1. Giới thiệu dự án
Ứng dụng SecureChat là một nền tảng trò chuyện thời gian thực với tính năng bảo mật tối đa, áp dụng chuẩn **Mã hóa đầu cuối (End-to-End Encryption - E2EE)**. Mục tiêu của dự án là đảm bảo rằng mọi thông tin liên lạc (tin nhắn cá nhân và nhóm) chỉ có thể đọc được bởi người gửi và người nhận hợp lệ; máy chủ đóng vai trò chuyển tiếp tín hiệu chứ hoàn toàn không thể giải mã nội dung.

## 2. Các công nghệ và thuật toán bảo mật cốt lõi
Hệ thống sử dụng các tiêu chuẩn mật mã học hiện đại nhằm chống lại các cuộc tấn công đánh chặn (Man-in-the-Middle) và rò rỉ dữ liệu máy chủ:

* **Mã hóa bất đối xứng (Public-Key Cryptography):** Sử dụng hệ mật mã đường cong elliptic **ECDH (Elliptic Curve Diffie-Hellman)** với chuẩn P-256. Mỗi người dùng khi đăng ký sẽ tạo ra một cặp khóa (Private/Public Key). Public key được lưu trữ trên server, còn Private key được mã hóa bằng mật khẩu của người dùng và lưu nội bộ (với chuẩn dẫn xuất khóa PBKDF2).
* **Mã hóa đối xứng (Symmetric Encryption):** Sử dụng **AES-256-GCM**.
  * **Chat 1-1:** Khi hai người dùng kết bạn, ECDH được dùng để thỏa thuận một khóa phiên chia sẻ (Shared Secret) dùng chung cho AES-256-GCM.
  * **Chat Nhóm:** Quản trị viên nhóm sinh ra một khóa nhóm ngẫu nhiên (AES-256). Khóa này được mã hóa bằng Public Key của từng thành viên trong nhóm trước khi gửi lên server.
* **Xác thực toàn vẹn (Integrity & Authentication):** AES-GCM tự động cung cấp mã xác thực thông điệp (MAC) để đảm bảo tin nhắn không bị giả mạo trên đường truyền.
* **WebSockets WSS:** Giao tiếp theo thời gian thực luôn được mã hóa ở lớp vận chuyển TLS/SSL để nhân đôi bảo mật.

## 3. Kiến trúc hệ thống
* **Backend:** Python với FastAPI, quản lý kết nối WebSocket, xác thực JWT và cơ sở dữ liệu SQLite.
* **Frontend:** ReactJS + Vite, cung cấp giao diện người dùng hiện đại theo phong cách "Glassmorphism" và "Neon", giống Telegram. Toàn bộ logic mật mã được xử lý tại phía trình duyệt thông qua API `window.crypto.subtle`.

## 4. Danh sách tính năng và giao diện
1. **Quản lý tài khoản & Danh bạ:**
   - Đăng nhập/Đăng ký an toàn. Private key không bao giờ rời khỏi thiết bị dưới dạng bản rõ.
   - Gửi, nhận và từ chối lời mời kết bạn dựa trên `Chat ID` ẩn danh.
2. **Nhắn tin Cá nhân (1-1):**
   - Các tin nhắn văn bản, Emoji, GIF, Sticker được mã hóa E2EE mượt mà.
3. **Quản lý Nhóm bảo mật:**
   - Tạo nhóm, thêm bạn bè vào nhóm.
   - Cơ chế phát khóa nhóm an toàn (Group Key Rotation) đến từng thành viên.
   - Tính năng giải tán nhóm (chỉ dành cho Quản trị viên).
4. **Giao diện Tiếng Việt hoàn thiện:**
   - Thiết kế thân thiện, trực quan.
   - Căn chỉnh bố cục tinh tế (Icon tìm kiếm, Menu 3 gạch ngang hàng với tên người dùng).
   - Tối ưu hóa trên các thiết bị.

## 5. Các vấn đề đã giải quyết và tối ưu hóa
Trong quá trình triển khai và kiểm thử chuyên sâu, các vấn đề hệ thống cốt lõi đã được khắc phục hoàn toàn:
1. **Lỗi Crash mã hóa nhóm:** Khắc phục thành công sự cố lệch định danh (`chat_id` vs `user_id`) khiến chức năng khởi tạo khóa nhóm bị lỗi (gây ra hiện tượng null key và crash React). 
2. **Quản lý Vòng đời Nhóm:** Phát triển thêm chức năng Giải tán nhóm đồng bộ toàn hệ thống (từ Frontend API cho đến xử lý cơ sở dữ liệu Backend).
3. **Sửa lỗi hiển thị UI/UX:**
   - Dọn dẹp mã nguồn thừa thãi vào thư mục `_ThungRac`.
   - Cập nhật chuẩn hệ thống icon (Lucide-react), tối ưu hiển thị trạng thái trò chuyện trống (`MessageSquare`).
   - Sắp xếp và Việt hóa 100% mã nguồn theo phong cách tự nhiên, chuẩn mực nhất.

## 6. Tổng kết
Dự án SecureChat E2EE là một sản phẩm hoàn thiện, chứng minh được khả năng kết hợp giữa giao diện Web hiện đại và các thuật toán an toàn bảo mật thông tin chuyên sâu. Ứng dụng đáp ứng đủ tiêu chuẩn để bảo vệ quyền riêng tư tuyệt đối cho người dùng.
