**HƯỚNG DẪN BỔ SUNG THỰC HIỆN BÀI TẬP LỚN CHO SINH VIÊN** *(Học phần: Nhập môn an toàn bảo mật thông tin - Học kì 3 năm học 2025–2026)* 

1. **BỔ SUNG KỸ THUẬT CHUYÊN MÔN SÂU** 
1. Bổ sung Nâng cấp về Tiêu chuẩn Thuật toán 
- Mã hóa dữ liệu: Khuyến nghị sử dụng các cơ chế mã hóa có xác thực (AEAD) như AES- GCM hoặc ChaCha20-Poly1305 
- Chữ ký số: Chuyển sang sử dụng các tiêu chuẩn mới như RSA-PSS, ECDSA hoặc Ed25519 
- Bảo mật mật khẩu: Tuyệt đối không lưu mật khẩu thô hoặc chỉ hash SHA-256 đơn thuần. Bắt buộc sử dụng các hàm băm chuyên dụng kèm Salt như bcrypt, Argon2id hoặc PBKDF2. 
2. Bổ sung Nâng cấp về Cơ chế Bảo mật Hệ thống (Bắt buộc cho mọi đề tài) Mỗi hệ thống phải được trang bị các cơ chế "phòng thủ" chủ động: 
- Cơ chế chống gửi lại (Anti-replay): Đây là yêu cầu mới quan trọng. Hệ thống phải sử dụng nonce, timestamp, sequence\_number hoặc session\_id để phát hiện và từ chối các gói tin cũ bị kẻ xấu gửi lại. Sinh viên phải có test case chứng minh phát hiện được tấn công replay. 
- Quản lý khóa chuyên nghiệp: Không được hard-code khóa trong code hoặc in khóa/mật khẩu ra màn hình log. Phải mô tả rõ quy trình tạo, trao đổi hoặc dẫn xuất khóa. 
- Ghi log và Xử lý lỗi bảo mật: Hệ thống phải ghi log các sự kiện: đăng nhập, lỗi toàn vẹn (integrity error), lỗi quyền truy cập, dữ liệu hết hạn hoặc phát hiện replay. Log không được chứa thông tin nhạy cảm chưa mã hóa. 
3. Bổ sung Quy trình Kiểm thử (Security Testing) 

Sinh viên phải xây dựng các kịch bản kiểm thử cho tình huống bị tấn công: 

- Test dữ liệu bị sửa đổi: Sửa 1 byte trong ciphertext và chứng minh hệ thống phát hiện được. 
- Test tấn công Replay: Gửi lại một gói tin đã giao dịch thành công và chứng minh hệ thống từ chối. 
- Test quyền truy cập: Thử giải mã bằng sai khóa, sai người nhận hoặc khi dữ liệu đã hết hạn (đối với đề tài gửi file có thời hạn). 
- Benchmark: Đo lường và so sánh hiệu năng (thời gian, kích thước) trước và sau khi nâng cấp hoặc giữa các thuật toán khác nhau. 
4. Bổ sung Yêu cầu về Minh chứng và Tài liệu 
- Threat Model (Mô hình hiểm họa): Phải phân tích được tài sản cần bảo vệ, tác nhân tấn công và các nguy cơ bảo mật cụ thể cho đề tài của mình. 
- Video Demo và GitHub: Video (5-7 phút) phải demo được cả trường hợp chạy đúng và trường hợp hệ thống ngăn chặn tấn công thành công. Lịch sử commit trên GitHub phải thể hiện quá trình làm việc thực tế. 
- Báo cáo bắt buộc phải trình bày rõ ràng, có hình ảnh minh họa, bảng kết quả kiểm thử và link tới mã nguồn. 
2. **SỬA ĐỔI, BỔ SUNG NỘI DUNG QUYỂN BÁO CÁO** Dưới đây là các nội dung bắt buộc phải có trong quyển báo cáo: 
1. Các phần nội dung chính của báo cáo 
- Giới thiệu bài toán: Bối cảnh thực tế, mục tiêu hệ thống và lý do cần bảo mật. 
- Mục tiêu bảo mật cần phân tích các tính chất: tính bí mật, toàn vẹn, xác thực, sẵn sàng và khả năng truy vết. 
- Threat model (Mô hình hiểm họa): Xác định tài sản cần bảo vệ, người dùng hợp lệ, các tác nhân tấn công giả định và nguy cơ bảo mật. 
- Kiến trúc hệ thống: Sơ đồ kiến trúc tổng quan (Client/Server/Cloud...) và mô tả vai trò từng thành phần. 
- Thiết kế giao thức hoặc luồng xử lý: Bắt buộc có Sơ đồ Sequence Diagram hoặc Flowchart mô tả các bước từ khởi tạo, trao đổi khóa đến ghi log. 
- Thuật toán và thư viện sử dụng: Liệt kê các thuật toán mã hóa, hash, chữ ký số; thư viện lập trình và lý do lựa chọn chúng. 
- Mô tả chức năng đã cài đặt: Phân tách rõ giữa chức năng gốc và chức năng nâng cấp. 
- Phân tích mã nguồn: Cấu trúc thư mục, các file chính, các hàm quan trọng và hướng dẫn cách chạy chương trình. 
- Kiểm thử chức năng: Các test case chạy đúng trong điều kiện bình thường kèm ảnh minh họa. 
- Kiểm thử bảo mật: Đây là phần quan trọng, phải có test case cho các tình huống khi dữ liệu bị sửa, sai khóa, sai chữ ký, tấn công replay, hết hạn/sai quyền. 
- Benchmark hiệu năng: Đo lường và so sánh thời gian xử lý, kích thước file…. 
- Kết luận và hướng phát triển: Tổng kết các kết quả, hạn chế và hướng cải tiến. 
2. Điểm mới quan trọng cần lưu ý sinh viên. 
- Sản phẩm đi kèm báo cáo: Quyển báo cáo PDF chỉ là một phần. Sinh viên còn phải nộp kèm Link GitHub, Video demo (5-7 phút), Test report riêng và Benchmark report. 
- Cấu trúc thư mục nộp bài: Tài liệu gợi ý sắp xếp báo cáo trong thư mục /report/ và các tài liệu bổ trợ (threat model, protocol design) trong thư mục /docs/ trên GitHub. 

\-------------------------------------------- 
