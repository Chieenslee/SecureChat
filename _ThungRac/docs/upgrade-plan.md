# Đánh giá & Kế hoạch nâng cấp thành Ứng dụng Chat Thực (100% Real Chat App)

## 1. Đánh giá Hiện trạng (Current State Evaluation)

Hệ thống hiện tại được thiết kế rất tốt cho mục đích **Trình diễn (Demo) & Kiểm thử bảo mật (Lab)**. Để trở thành một ứng dụng chat thực tế phục vụ người dùng cuối (End-user), chúng ta có các ưu/nhược điểm sau:

### Điểm mạnh (Đã sẵn sàng cho thực tế):
- **Cơ chế E2EE (End-to-End Encryption):** Mô hình kết hợp RSA (trao đổi khóa, chữ ký số) và AES-256 (mã hóa luồng dữ liệu) là chuẩn mực trong thực tế.
- **Kiến trúc mạng:** Sử dụng WebSocket cho độ trễ thấp (Real-time), luồng sự kiện rõ ràng.
- **Tính toàn vẹn (Integrity):** Đã có cơ chế Hash (SHA-256) và Signature để chống giả mạo.

### Hạn chế (Cần thay đổi để làm app thật):
- **Giao diện (UI/UX):** Đang mang tính chất "Lab" (hiển thị Server Relay, Packet JSON, các nút tấn công). Người dùng cuối chỉ cần giao diện trực quan (Danh bạ, Khung chat).
- **Mất dữ liệu khi tải lại trang (No Persistence):** Các khóa RSA, AES và lịch sử tin nhắn đều lưu trên RAM. Khi F5 trình duyệt là mất hết, phải tạo lại khóa và trao đổi lại từ đầu.
- **Không có Tin nhắn Offline:** Nếu người nhận (Peer) mất kết nối, tin nhắn không gửi được. Thực tế Server cần lưu tạm (Store & Forward) các gói tin đã mã hóa.
- **Danh bạ & Trạng thái:** Chưa có danh sách bạn bè, không biết ai đang online/offline. Phải gõ tay ID người nhận.
- **Chỉ gửi Text:** Thiếu tính năng gửi hình ảnh, file đính kèm.

---

## 2. Kế hoạch Nâng cấp (Upgrade Roadmap)

Để nâng cấp thành ứng dụng chat 100% thực tế (như Zalo, Telegram, Signal), chúng ta chia làm 4 giai đoạn:

### Giai đoạn 1: Chuyển đổi Giao diện (UI/UX Transformation)
Mục tiêu: Chuyển từ "Màn hình Lab" sang "Màn hình Ứng dụng Chat".
- **Xây dựng UI mới:** Layout chia 2 cột kinh điển:
  - **Cột trái:** Danh sách chat gần đây, Thanh tìm kiếm người dùng, Nút xem Profile cá nhân.
  - **Cột phải:** Khung chat chính, thanh header hiển thị tên và avatar người đang chat, khu vực hiển thị tin nhắn, ô nhập liệu.
- **Loại bỏ/Ẩn các yếu tố kỹ thuật:** Xóa các bảng điều khiển Server Relay, Attack Lab, Packet Preview (Hoặc đưa nó vào mục "Chế độ Nhà phát triển" có thể bật/tắt).

### Giai đoạn 2: Quản lý Trạng thái & Lưu trữ cục bộ (Local Persistence)
Mục tiêu: Giữ lại phiên đăng nhập, khóa mã hóa và lịch sử chat khi tắt trình duyệt.
- **Lưu trữ Khóa (Key Management):** Lưu trữ cặp khóa RSA cá nhân và các session key (AES) vào **IndexedDB** của trình duyệt một cách an toàn. Khi người dùng mở lại web, không cần sinh key mới.
- **Lịch sử tin nhắn:** Mỗi khi giải mã thành công tin nhắn, lưu đoạn text đã giải mã vào IndexedDB. Lần sau mở app lên sẽ load lại toàn bộ lịch sử hội thoại thay vì màn hình trống.

### Giai đoạn 3: Tính năng Backend & Giao tiếp (Core Chat Features)
Mục tiêu: Đảm bảo luồng chat không bị gián đoạn ngay cả khi có một người offline.
- **Danh bạ & Trạng thái Online:** 
  - Thêm API tìm kiếm người dùng trên Server.
  - Server bắn sự kiện (broadcast) qua WebSocket để client biết bạn bè nào đang online/offline (có chấm xanh).
- **Xử lý Tin nhắn Offline (Store-and-Forward):**
  - Nếu A gửi cho B mà B đang offline, Server lưu gói tin (đã mã hóa, Server không đọc được) vào Database.
  - Khi B online, Server tự động đẩy (push) các gói tin này xuống cho B.
- **Đồng bộ hóa phiên (Session Sync):** Xử lý trường hợp có tin nhắn mới hoặc thông báo (Notification/Âm thanh).

### Giai đoạn 4: Tính năng nâng cao (Advanced Features)
Mục tiêu: Bắt kịp các chuẩn ứng dụng chat hiện đại.
- **Gửi File/Hình ảnh an toàn:** 
  - Ở client, đọc file thành dạng byte, mã hóa bằng khóa AES hiện tại.
  - Upload file đã mã hóa lên Server để lưu trữ.
  - Gửi đường link file qua tin nhắn chat. Peer nhận được link, tải về và dùng AES để giải mã ra file gốc.
- **Perfect Forward Secrecy (PFS):** Áp dụng thuật toán **Double Ratchet** (chuẩn của Signal) để liên tục xoay vòng (rotate) khóa AES sau mỗi tin nhắn. Đảm bảo nếu lộ khóa hôm nay, hacker không đọc được tin nhắn hôm qua.

---

## 3. Các bước triển khai ngay lập tức (Next Actions)
Nếu bạn muốn bắt đầu làm ngay, chúng ta nên đi theo trình tự:
1. Tạo một trang HTML/CSS mới (`chat.html`) thuần túy giao diện chat (bỏ các cột lab).
2. Viết lại một script JS mới (ví dụ: `app_chat.js`) kế thừa hàm mã hóa từ `crypto_utils.js` nhưng tích hợp với giao diện mới.
3. Tích hợp thư viện **LocalForage** (hoặc dùng IndexedDB thuần) để lưu khóa RSA xuống trình duyệt để không phải tạo lại khi tải lại trang.