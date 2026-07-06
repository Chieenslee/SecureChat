# Telegram-style Secure Chat + AI Roadmap

Tài liệu này chốt các quyết định kỹ thuật cho hướng nâng cấp giao diện kiểu Telegram, group chat, emoji/GIF/sticker và AI assistant. Mục tiêu là giữ lõi bảo mật hiện tại, tránh thiết kế mơ hồ trước khi triển khai các phase sau.

## 1. Phạm vi triển khai

Triển khai theo phase, không sửa đồng thời toàn bộ hệ thống:

1. Phase 1: Refactor React UI thành Telegram-style shell.
2. Phase 2: Profile chi tiết, friend search/request/accept/reject.
3. Phase 3: Group chat và group key distribution.
4. Phase 4: Emoji, GIF, sticker.
5. Phase 5: AI assistant có consent rõ ràng.

Phase 1 và Phase 2 giữ chat 1-1 đang chạy ổn, không thay đổi crypto format nếu không cần.

## 2. Crypto Policy

Giữ đúng yêu cầu đề tài:

- RSA-2048 PKCS#1 v1.5 dùng `node-forge`.
- RSAES-PKCS1-v1_5 để mã hóa AES session/group key.
- RSASSA-PKCS1-v1_5 + SHA-256 để ký số.
- AES-256-CBC dùng WebCrypto để mã hóa nội dung.
- SHA-256 dùng để tính `SHA-256(IV || ciphertext)`.
- Signature ký từng message, cover canonical payload gồm sender, recipient/group, session, sequence, timestamp, IV, ciphertext và hash.

Không chuyển sang AES-GCM trong scope đề tài hiện tại vì lệch yêu cầu AES-CBC + SHA-256.

## 3. Group Key Lifecycle

Chọn chính sách sau để tránh mơ hồ:

- Khi tạo nhóm: client owner tạo AES group key.
- Owner mã hóa group key bằng RSA public key của từng member.
- Mỗi member nhận encrypted group key riêng.
- Khi thêm member mới: tạo group key mới từ thời điểm thêm member.
- Tin nhắn trước khi member tham gia vẫn mã hóa bằng key cũ, member mới không decrypt được lịch sử cũ.
- UI hiển thị placeholder: `Tin nhắn này được gửi trước khi bạn tham gia nhóm.`
- Khi remove member hoặc member rời nhóm: rotate group key ngay.
- Key mới chỉ được mã hóa gửi cho các member còn lại.

Known limitation cho MVP Phase 3 nếu chưa làm remove member:

- Nếu chưa có API remove member, tài liệu phải ghi rõ group key chưa xử lý revoke access.
- Không được claim group chat đã có full membership revocation security.

API cần tính trước:

```text
POST   /api/groups
GET    /api/groups
GET    /api/groups/{group_id}
POST   /api/groups/{group_id}/members
DELETE /api/groups/{group_id}/members/{chat_id}
POST   /api/groups/{group_id}/rotate-key
```

## 4. Conversation + Message Schema

Không dùng đồng thời `conversation_id`, `recipient_id`, `group_id` trong `messages` vì dễ mâu thuẫn.

Thiết kế từ Phase 3:

```sql
conversations(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- direct, group, ai
  group_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

conversation_members(
  conversation_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  left_at TEXT,
  PRIMARY KEY(conversation_id, user_id)
)

messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id TEXT NOT NULL,
  packet_json TEXT NOT NULL,
  message_type TEXT NOT NULL, -- text, emoji, gif, sticker, key_packet
  status TEXT NOT NULL,       -- stored, sent, failed
  reply_to_message_id INTEGER,
  created_at TEXT NOT NULL
)

message_receipts(
  message_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  delivered_at TEXT,
  read_at TEXT,
  PRIMARY KEY(message_id, user_id)
)
```

Lý do:

- 1-1 và group dùng chung một khái niệm conversation.
- Message status không scale cho group nếu chỉ có một field `read`.
- `message_receipts` cho phép delivered/read theo từng recipient.

## 5. Preview Và Search Với E2EE

Không thêm `plaintext_preview_encrypted` ở giai đoạn đầu.

Quy tắc:

- Server không render preview vì không có plaintext.
- Sidebar preview do client decrypt message cuối đã load.
- Nếu client chưa decrypt được, hiển thị `Tin nhắn mã hóa`.
- Search trong chat chỉ search trên message đã tải và đã decrypt phía client.
- Không claim full-history encrypted search trong MVP.

## 6. AI Assistant Privacy Rules

AI assistant là chat riêng trong app, không phải Meta AI chính thức.

Quy tắc bắt buộc:

- Server không decrypt tin nhắn E2EE để gửi cho AI.
- Nếu user chọn `Ask AI`, `Summarize`, `Translate`, client phải decrypt message trước.
- UI phải hiện xác nhận trước khi gửi plaintext cho AI.
- Disclosure bắt buộc:

```text
Nội dung này sẽ được gửi tới AI provider và không còn ở trạng thái mã hóa đầu-cuối.
```

`ai_messages` có thể lưu plaintext vì AI cần đọc, nhưng phải ghi rõ đây là vùng dữ liệu không còn E2EE.

Schema dự kiến:

```sql
ai_messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL, -- user, assistant, system
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
)
```

## 7. AI Rate Limit Và Cost Control

Nếu deploy public, AI endpoint phải có rate limit ngay trong Phase 5:

- Giới hạn request/phút theo `user_id`.
- Giới hạn request/ngày hoặc token/ngày theo `user_id`.
- Log usage để kiểm soát chi phí.

API dự kiến:

```text
POST /api/ai/chat
POST /api/ai/summarize
POST /api/ai/translate
POST /api/ai/suggest-reply
GET  /api/ai/usage
```

Nếu chưa có API key:

- AI tab vẫn hiển thị.
- Trạng thái: `AI chưa được cấu hình`.
- Không crash UI.

## 8. AI Streaming Decision

MVP Phase 5 có thể dùng non-streaming JSON để giảm độ phức tạp:

```json
{
  "reply": "..."
}
```

Nếu cần trải nghiệm giống ChatGPT, triển khai ngay bằng SSE thay vì sửa sau:

```text
GET /api/ai/chat/stream
```

Quyết định hiện tại:

- Phase 5 MVP: non-streaming.
- Phase 5.1: SSE streaming nếu còn thời gian.

## 9. Frontend State Management

Không tiếp tục dồn toàn bộ state vào `App.jsx`.

Chọn Context API cho quy mô dự án hiện tại:

```text
frontend/src/state/
├── AuthContext.jsx
├── ChatContext.jsx
├── FriendContext.jsx
├── GroupContext.jsx
└── AiContext.jsx
```

Lý do:

- Không cần thêm Zustand/Redux ở MVP.
- Đủ rõ để tách Sidebar, ChatWindow, Composer, ProfileModal, GroupModal, AiChat.
- Nếu state phức tạp hơn, có thể chuyển riêng ChatContext sang reducer.

## 10. UI Modules

Frontend sau refactor:

```text
frontend/src/
├── App.jsx
├── main.jsx
├── styles.css
├── components/
│   ├── Sidebar.jsx
│   ├── ChatList.jsx
│   ├── ChatWindow.jsx
│   ├── MessageBubble.jsx
│   ├── Composer.jsx
│   ├── EmojiPicker.jsx
│   ├── GifPicker.jsx
│   ├── StickerPicker.jsx
│   ├── ProfileModal.jsx
│   ├── FriendModal.jsx
│   ├── GroupModal.jsx
│   └── AiChat.jsx
├── state/
├── services/
│   ├── api.js
│   ├── socket.js
│   └── ai.js
└── crypto/
    └── secureCrypto.js
```

## 11. Deployment Notes

Single-instance deployment:

- SQLite acceptable.
- In-memory WebSocket map acceptable.

Multi-instance deployment:

- Chuyển DB sang PostgreSQL.
- Thêm Redis pub/sub cho WebSocket relay.
- Hoặc dùng sticky session.

Không claim production-grade multi-instance nếu chưa có Redis/sticky session.

## 12. Next Implementation Order

Thứ tự triển khai tiếp theo:

1. Refactor React thành component + Context.
2. Làm Telegram-style UI shell.
3. Thêm profile fields: `display_name`, `bio`, `avatar_color`, `avatar_url`, `last_seen`.
4. Thêm friend search preview và reject request.
5. Sau khi UI/friend ổn mới bắt đầu group schema.
6. Sau group mới thêm emoji/GIF/sticker.
7. AI assistant làm cuối, có consent và rate limit.
