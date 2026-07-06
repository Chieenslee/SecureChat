# Test Cases - Secure Chat Real WebSocket

## TC01 - Ket noi hai client

**Thao tac:**

1. Mo `http://127.0.0.1:8010/` o tab nguoi dung 1.
2. Mo `http://127.0.0.1:8010/` o tab nguoi dung 2.
3. Moi tab nhap ID ca nhan va ID nguoi nhan.
4. Bam `Dang nhap / ket noi` o ca hai tab.

**Ket qua mong doi:**

- Moi tab sinh RSA keypair thanh cong.
- Server luu public key cua hai ID nguoi dung.
- Moi tab mo WebSocket `/ws/{user_id}` thanh cong.

## TC02 - Gui tin nguoi dung 1 sang nguoi dung 2

**Thao tac:**

1. Tai tab nguoi dung 1, nhap noi dung.
2. Bam `Gui bao mat`.

**Ket qua mong doi:**

- Nguoi dung 1 gui handshake va message packet qua server.
- Server relay packet sang nguoi dung 2.
- Nguoi dung 2 verify hash/signature, giai ma AES va hien plaintext.
- Nguoi dung 2 gui ACK ve nguoi dung 1.

## TC03 - Gui tin nguoi dung 2 sang nguoi dung 1

**Thao tac:**

1. Tai tab nguoi dung 2, nhap noi dung.
2. Bam `Gui bao mat`.

**Ket qua mong doi:**

- Nguoi dung 1 nhan duoc plaintext dung.
- Server panel hien packet relay.
- ACK duoc gui ve nguoi dung 2.

## TC04 - Peer offline

**Thao tac:**

1. Chi mo tab nguoi dung 1 va bam `Dang nhap / ket noi`.
2. Gui tin cho ID nguoi nhan khi nguoi do chua ket noi.

**Ket qua mong doi:**

- Neu nguoi nhan chua dang ky public key: client bao khong tim thay public key.
- Neu nguoi nhan da dang ky nhung offline: server gui NACK `User <id> is offline`.

## TC05 - Server log

**Thao tac:** Bam `Xem log server`.

**Ket qua mong doi:**

- Hien JSON security events tu `/security-events`.
- Log khong chua plaintext, AES key hoac RSA private key.

## TC06 - Sua ciphertext

**Thao tac:** Sau khi hai client da ket noi, tai tab nguoi gui bam `Gui packet sua ciphertext`.

**Ket qua mong doi:**

- Packet van di qua WebSocket server.
- Nguoi nhan tinh hash khong khop va gui NACK `Invalid integrity hash`.

## TC07 - Sai chu ky

**Thao tac:** Bam `Gui packet sai chu ky`.

**Ket qua mong doi:**

- Nguoi nhan verify signature that bai.
- Nguoi nhan gui NACK `Invalid message signature`.

## TC08 - Packet het han

**Thao tac:** Bam `Gui packet het han`.

**Ket qua mong doi:**

- Nguoi nhan tu choi packet do timestamp qua cu.
- Nguoi nhan gui NACK `Message expired`.

## TC09 - Replay packet

**Thao tac:** Gui mot tin hop le, sau do bam `Replay packet cuoi`.

**Ket qua mong doi:**

- Nguoi nhan phat hien sequence number da xu ly.
- Nguoi nhan gui NACK `Replay detected`.

## TC10 - Crypto self-test

**Thao tac:**

```powershell
npm run test:crypto
```

**Ket qua mong doi:**

- RSA-2048 PKCS#1 v1.5 ma hoa/giai ma AES key thanh cong.
- RSA/SHA-256 ky va verify thanh cong.
- AES-256-CBC ma hoa/giai ma thong diep thanh cong.
- SHA-256 tra ve hash hex 64 ky tu.

## TC11 - WebSocket relay self-test

**Thao tac:**

```powershell
npm run test:relay
```

**Ket qua mong doi:**

- Script dang ky public key cho `user_a_test` va `user_b_test`.
- Script mo hai WebSocket client that qua `/ws/user_a_test` va `/ws/user_b_test`.
- Packet tu `user_a_test` duoc server relay sang `user_b_test`.
- Neu `user_b_test` mo hai WebSocket cung luc, ca hai connection deu nhan duoc packet.
- Packet co sender gia mao bi server tu choi voi NACK `Sender mismatch`.
