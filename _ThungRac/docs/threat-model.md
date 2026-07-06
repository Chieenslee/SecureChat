# Threat Model - Secure Chat

## Tai san can bao ve

| Tai san | Mo ta | Bien phap bao ve |
| --- | --- | --- |
| Plaintext | Noi dung tin nhan | AES-256-CBC tai client |
| AES session key | Khoa ma hoa tin nhan | RSA public key cua nguoi nhan |
| RSA private key | Khoa ky/giai ma | Chi giu trong RAM cua client |
| Message packet | Du lieu truyen qua relay | SHA-256 + RSA signature |
| Session state | Sequence number, session ID | Luu trong client state |

## Tac nhan tan cong

| Tac nhan | Muc tieu | Cach ung dung phat hien |
| --- | --- | --- |
| Ke sua du lieu | Sua ciphertext | Hash mismatch -> NACK |
| Ke gia mao | Sua signature | Signature invalid -> NACK |
| Ke replay | Gui lai packet cu | Sequence number cu -> NACK |
| Sai nguoi nhan | Chuyen packet cho user khac | Decrypt AES key fail -> NACK |
| Packet cu | Gui packet het han | Timestamp expired -> NACK |

## Gia dinh bao mat

Server duoc tin tuong trong viec phan phoi public key. Trong he thong thuc te, can bo sung fingerprint hoac QR code de nguoi dung xac minh public key ngoai kenh, giam nguy co MITM.

## Dieu khong duoc log

- Plaintext.
- AES key.
- RSA private key.
- Mat khau hoac token.
