# Benchmark Report — Secure Chat App

## Mục tiêu

Đo thời gian xử lý các thao tác mật mã trong ứng dụng:

- RSA-2048 PKCS#1 v1.5: tạo khóa, mã hóa/giải mã khóa AES, ký số, xác minh chữ ký.
- AES-256-CBC: mã hóa/giải mã nội dung tin nhắn.
- SHA-256: tính hash toàn vẹn `SHA-256(IV || ciphertext)`.

## Môi trường đo

| Thông tin | Giá trị |
| --- | --- |
| Hệ điều hành | Windows |
| Runtime | Node.js (crypto module cho AES/SHA-256, node-forge cho RSA) |
| CPU | (đo trên máy phát triển) |
| Lệnh chạy | `npm run test:crypto` |

## Kết quả tạo khóa

| Thao tác | Thời gian (ms) |
| --- | --- |
| RSA-2048 key generation (sender) | 53,32 |
| RSA-2048 key generation (receiver) | 20,63 |
| AES-256 key generation | 4,22 |
| RSA encrypt AES key (PKCS#1 v1.5) | 13,41 |
| RSA decrypt AES key (PKCS#1 v1.5) | 50,21 |

## Kết quả mã hóa/giải mã tin nhắn

| Kích thước | AES encrypt | SHA-256 | RSA sign | RSA verify | AES decrypt |
| --- | --- | --- | --- | --- | --- |
| 128 B | 1,64 ms | 0,93 ms | 37,51 ms | 1,63 ms | 0,70 ms |
| 1 KB | 0,47 ms | 0,38 ms | 32,99 ms | 1,27 ms | 0,65 ms |
| 10 KB | 0,54 ms | 0,19 ms | 32,89 ms | 1,49 ms | 0,27 ms |

## Nhận xét

1. **RSA sign là thao tác chậm nhất** (~33–38 ms), do phải tính SHA-256 digest rồi ký bằng private key 2048-bit. Tuy nhiên, RSA chỉ dùng để ký payload metadata và message (không ký từng byte dữ liệu), nên không ảnh hưởng hiệu năng thực tế.

2. **AES-256-CBC encrypt/decrypt rất nhanh** (<2 ms cho mọi kích thước), phù hợp để mã hóa nội dung tin nhắn trong thời gian thực.

3. **SHA-256 hash cực nhanh** (<1 ms), chi phí tính toàn vẹn không đáng kể.

4. **RSA verify nhanh hơn RSA sign rất nhiều** (~1,5 ms vs ~35 ms), vì verify dùng public key (exponent nhỏ 0x10001) trong khi sign dùng private key.

5. **RSA key exchange** (encrypt AES key): ~13 ms encrypt, ~50 ms decrypt. Thao tác này chỉ diễn ra 1 lần trong handshake nên không ảnh hưởng trải nghiệm.

6. **Kích thước tin nhắn không ảnh hưởng nhiều** đến thời gian AES/SHA-256 trong phạm vi kiểm tra (128 B – 10 KB), cho thấy overhead chủ yếu nằm ở khởi tạo API, không phải dữ liệu.

## Kết luận

Tổ hợp AES-256-CBC + RSA-2048 + SHA-256 đảm bảo hiệu năng tốt cho ứng dụng chat tin nhắn văn bản. Tổng thời gian xử lý mỗi tin nhắn (encrypt + hash + sign) khoảng **35–40 ms**, đủ nhanh để người dùng không cảm nhận độ trễ.
