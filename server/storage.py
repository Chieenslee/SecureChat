import base64
import hashlib
import hmac
import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional


DB_PATH = Path("data/secure_chat.sqlite3")
_db_lock = Lock()
CHAT_ID_MAX_RETRIES = 32


def init_db() -> None:
    """Tạo schema SQLite cho tài khoản, bạn bè, tin nhắn và log."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS app_users (
                chat_id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT,
                bio TEXT,
                avatar_color TEXT,
                avatar_url TEXT,
                last_seen TEXT,
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                public_key TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS friend_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requester_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(requester_id, receiver_id)
            );

            CREATE TABLE IF NOT EXISTS friendships (
                user_a TEXT NOT NULL,
                user_b TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY(user_a, user_b)
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                name TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS conversation_members (
                conversation_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                joined_at TEXT NOT NULL,
                left_at TEXT,
                PRIMARY KEY(conversation_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS group_member_keys (
                conversation_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                encrypted_key TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY(conversation_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id TEXT NOT NULL,
                recipient_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                packet_json TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                delivered_at TEXT,
                acked_at TEXT
            );

            CREATE TABLE IF NOT EXISTS security_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                time TEXT NOT NULL,
                event_type TEXT NOT NULL,
                details_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_messages_recipient_status
                ON messages(recipient_id, status);
            CREATE INDEX IF NOT EXISTS idx_security_events_time
                ON security_events(time);
            """
        )
        _ensure_user_profile_columns(conn)


def create_user(username: str, password: str, public_key: str) -> Dict[str, Any]:
    """Tạo tài khoản mới và sinh chat_id dạng # + 8 chữ số."""
    now = _utc_now()
    salt = secrets.token_bytes(16)
    password_hash = _hash_password(password, salt)

    with _db_lock:
        with _connect() as conn:
            existing = conn.execute(
                "SELECT 1 FROM app_users WHERE username = ?",
                (username,),
            ).fetchone()
            if existing:
                raise ValueError("Username already exists")

            for _ in range(CHAT_ID_MAX_RETRIES):
                chat_id = generate_chat_id()
                try:
                    conn.execute(
                        """
                        INSERT INTO app_users (
                            chat_id, username, display_name, avatar_color,
                            password_salt, password_hash,
                            public_key, created_at, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            chat_id,
                            username,
                            username,
                            pick_avatar_color(username),
                            base64.b64encode(salt).decode("ascii"),
                            password_hash,
                            public_key,
                            now,
                            now,
                        ),
                    )
                    return get_user_by_chat_id(chat_id, conn=conn)
                except sqlite3.IntegrityError:
                    continue

    raise RuntimeError("Could not generate unique chat id")


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Xác thực username/password bằng PBKDF2-HMAC-SHA256."""
    with _db_lock:
        with _connect() as conn:
            row = conn.execute(
                "SELECT * FROM app_users WHERE username = ?",
                (username,),
            ).fetchone()

    if not row:
        return None

    salt = base64.b64decode(row["password_salt"])
    expected = row["password_hash"]
    actual = _hash_password(password, salt)
    if not hmac.compare_digest(expected, actual):
        return None
    return _row_to_user(row)


def update_public_key(chat_id: str, public_key: str) -> None:
    """Cập nhật public key khi client sinh lại RSA key."""
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """
                UPDATE app_users
                SET public_key = ?, updated_at = ?
                WHERE chat_id = ?
                """,
                (public_key, _utc_now(), chat_id),
            )


def reset_user_password(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Reset mật khẩu cho tài khoản demo/admin."""
    now = _utc_now()
    salt = secrets.token_bytes(16)
    password_hash = _hash_password(password, salt)
    with _db_lock:
        with _connect() as conn:
            row = conn.execute(
                "SELECT chat_id FROM app_users WHERE username = ?",
                (username,),
            ).fetchone()
            if not row:
                return None
            conn.execute(
                """
                UPDATE app_users
                SET password_salt = ?, password_hash = ?, updated_at = ?
                WHERE username = ?
                """,
                (
                    base64.b64encode(salt).decode("ascii"),
                    password_hash,
                    now,
                    username,
                ),
            )
            return get_user_by_chat_id(row["chat_id"], conn=conn)


def update_profile(chat_id: str, profile: Dict[str, Any]) -> Dict[str, Any]:
    """Cập nhật thông tin hồ sơ người dùng."""
    allowed = {
        "display_name": profile.get("display_name"),
        "bio": profile.get("bio"),
        "avatar_color": profile.get("avatar_color"),
        "avatar_url": profile.get("avatar_url"),
    }
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """
                UPDATE app_users
                SET display_name = COALESCE(?, display_name),
                    bio = COALESCE(?, bio),
                    avatar_color = COALESCE(?, avatar_color),
                    avatar_url = COALESCE(?, avatar_url),
                    updated_at = ?
                WHERE chat_id = ?
                """,
                (
                    allowed["display_name"],
                    allowed["bio"],
                    allowed["avatar_color"],
                    allowed["avatar_url"],
                    _utc_now(),
                    chat_id,
                ),
            )
            row = conn.execute(
                """
                SELECT chat_id, username, display_name, bio, avatar_color,
                       avatar_url, public_key, created_at, updated_at, last_seen
                FROM app_users WHERE chat_id = ?
                """,
                (chat_id,),
            ).fetchone()
    return _row_to_user(row)


def get_user_by_chat_id(chat_id: str, conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
    query = """
        SELECT chat_id, username, display_name, bio, avatar_color,
               avatar_url, public_key, created_at, updated_at, last_seen
        FROM app_users WHERE chat_id = ?
    """
    if conn:
        row = conn.execute(query, (chat_id,)).fetchone()
        return _row_to_user(row) if row else None

    with _db_lock:
        with _connect() as local_conn:
            row = local_conn.execute(query, (chat_id,)).fetchone()
    return _row_to_user(row) if row else None


def get_public_key(chat_id: str) -> Optional[str]:
    user = get_user_by_chat_id(chat_id)
    return user["public_key"] if user else None


def search_user(chat_id: str, viewer_id: str) -> Optional[Dict[str, Any]]:
    """Tìm user bằng Chat ID và kèm trạng thái quan hệ."""
    user = get_user_by_chat_id(chat_id)
    if not user:
        return None
    user["is_self"] = chat_id == viewer_id
    user["is_friend"] = are_friends(chat_id, viewer_id) if chat_id != viewer_id else False
    return user


def create_friend_request(requester_id: str, receiver_id: str) -> Dict[str, Any]:
    """Tạo lời mời kết bạn bằng Chat ID."""
    if requester_id == receiver_id:
        raise ValueError("Cannot add yourself")
    if not get_user_by_chat_id(receiver_id):
        raise LookupError("Chat ID not found")
    if are_friends(requester_id, receiver_id):
        raise ValueError("Already friends")

    now = _utc_now()
    with _db_lock:
        with _connect() as conn:
            reverse = conn.execute(
                """
                SELECT id FROM friend_requests
                WHERE requester_id = ? AND receiver_id = ? AND status = 'pending'
                """,
                (receiver_id, requester_id),
            ).fetchone()
            if reverse:
                accept_friend_request(reverse["id"], requester_id, conn=conn)
                return {"status": "accepted", "request_id": reverse["id"]}

            conn.execute(
                """
                INSERT INTO friend_requests (requester_id, receiver_id, status, created_at, updated_at)
                VALUES (?, ?, 'pending', ?, ?)
                ON CONFLICT(requester_id, receiver_id) DO UPDATE SET
                    status = 'pending',
                    updated_at = excluded.updated_at
                """,
                (requester_id, receiver_id, now, now),
            )
            request_id = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    return {"status": "pending", "request_id": request_id}


def list_friend_requests(chat_id: str) -> List[Dict[str, Any]]:
    with _db_lock:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT fr.id, fr.requester_id, fr.receiver_id, fr.status, fr.created_at,
                       u.username AS requester_username
                FROM friend_requests fr
                JOIN app_users u ON u.chat_id = fr.requester_id
                WHERE fr.receiver_id = ? AND fr.status = 'pending'
                ORDER BY fr.id DESC
                """,
                (chat_id,),
            ).fetchall()
    return [dict(row) for row in rows]


def accept_friend_request(request_id: int, receiver_id: str, conn: Optional[sqlite3.Connection] = None) -> None:
    """Chấp nhận lời mời kết bạn và tạo friendship hai chiều dạng chuẩn hóa."""
    local_conn = conn
    close_conn = False
    if local_conn is None:
        local_conn = _connect()
        close_conn = True

    try:
        row = local_conn.execute(
            """
            SELECT requester_id, receiver_id FROM friend_requests
            WHERE id = ? AND receiver_id = ? AND status = 'pending'
            """,
            (request_id, receiver_id),
        ).fetchone()
        if not row:
            raise LookupError("Friend request not found")

        user_a, user_b = normalize_pair(row["requester_id"], row["receiver_id"])
        now = _utc_now()
        local_conn.execute(
            "INSERT OR IGNORE INTO friendships (user_a, user_b, created_at) VALUES (?, ?, ?)",
            (user_a, user_b, now),
        )
        local_conn.execute(
            "UPDATE friend_requests SET status = 'accepted', updated_at = ? WHERE id = ?",
            (now, request_id),
        )
        if close_conn:
            local_conn.commit()
    finally:
        if close_conn:
            local_conn.close()


def reject_friend_request(request_id: int, receiver_id: str) -> None:
    """Từ chối lời mời kết bạn."""
    with _db_lock:
        with _connect() as conn:
            cursor = conn.execute(
                """
                UPDATE friend_requests
                SET status = 'rejected', updated_at = ?
                WHERE id = ? AND receiver_id = ? AND status = 'pending'
                """,
                (_utc_now(), request_id, receiver_id),
            )
            if cursor.rowcount == 0:
                raise LookupError("Friend request not found")


def list_friends(chat_id: str) -> List[Dict[str, Any]]:
    with _db_lock:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT u.chat_id, u.username, u.display_name, u.bio, u.avatar_color,
                       u.avatar_url, u.public_key, u.created_at, u.updated_at, u.last_seen
                FROM friendships f
                JOIN app_users u ON u.chat_id = CASE
                    WHEN f.user_a = ? THEN f.user_b
                    ELSE f.user_a
                END
                WHERE f.user_a = ? OR f.user_b = ?
                ORDER BY u.username COLLATE NOCASE
                """,
                (chat_id, chat_id, chat_id),
            ).fetchall()
    return [dict(row) for row in rows]


def list_users_for_admin() -> List[Dict[str, Any]]:
    """Liệt kê user cho màn admin demo, chỉ chứa public key và metadata công khai."""
    with _db_lock:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT chat_id, username, display_name, public_key, created_at, updated_at
                FROM app_users
                ORDER BY username COLLATE NOCASE
                """
            ).fetchall()
    return [dict(row) for row in rows]


def are_friends(first_id: str, second_id: str) -> bool:
    user_a, user_b = normalize_pair(first_id, second_id)
    with _db_lock:
        with _connect() as conn:
            row = conn.execute(
                "SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?",
                (user_a, user_b),
            ).fetchone()
    return bool(row)


def delete_friend(first_id: str, second_id: str) -> bool:
    user_a, user_b = normalize_pair(first_id, second_id)
    with _db_lock:
        with _connect() as conn:
            cursor = conn.execute(
                "DELETE FROM friendships WHERE user_a = ? AND user_b = ?",
                (user_a, user_b),
            )
            return cursor.rowcount > 0


def save_message(packet: Dict[str, Any], status: str, explicit_recipient: Optional[str] = None) -> int:
    now = _utc_now()
    recip = explicit_recipient or packet["recipient"]
    with _db_lock:
        with _connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO messages (
                    sender_id, recipient_id, session_id, packet_json,
                    status, created_at, delivered_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    packet["sender"],
                    recip,
                    packet["session_id"],
                    json.dumps(packet, ensure_ascii=False),
                    status,
                    now,
                    now if status == "delivered" else None,
                ),
            )
            return int(cursor.lastrowid)


def pending_messages_for(chat_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    with _db_lock:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT id, packet_json FROM messages
                WHERE recipient_id = ? AND status = 'pending'
                ORDER BY id ASC
                LIMIT ?
                """,
                (chat_id, limit),
            ).fetchall()
    return [{"id": row["id"], "packet": json.loads(row["packet_json"])} for row in rows]


def mark_message_delivered(message_id: int) -> None:
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                "UPDATE messages SET status = 'delivered', delivered_at = ? WHERE id = ?",
                (_utc_now(), message_id),
            )


def save_security_event(event_type: str, details: Dict[str, Any]) -> Dict[str, Any]:
    """Ghi log bảo mật tối giản và in ra CMD."""
    event = {"time": _utc_now(), "type": event_type, **details}
    print(f"\n[DEMO::{event_type.upper()}]", flush=True)
    print(json.dumps(details, ensure_ascii=False, indent=2), flush=True)
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                """
                INSERT INTO security_events (time, event_type, details_json)
                VALUES (?, ?, ?)
                """,
                (event["time"], event_type, json.dumps(details, ensure_ascii=False)),
            )
    return event


def load_security_events(limit: int = 100) -> List[Dict[str, Any]]:
    with _db_lock:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT time, event_type, details_json
                FROM security_events
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    return [
        {"time": row["time"], "type": row["event_type"], **json.loads(row["details_json"])}
        for row in reversed(rows)
    ]


def generate_chat_id() -> str:
    return f"#{secrets.randbelow(100_000_000):08d}"


def pick_avatar_color(seed: str) -> str:
    colors = ["#2aabee", "#19a974", "#7c3aed", "#f97316", "#e11d48", "#0891b2"]
    return colors[sum(ord(char) for char in seed) % len(colors)]


def normalize_pair(first_id: str, second_id: str) -> tuple[str, str]:
    return tuple(sorted((first_id, second_id)))


def _hash_password(password: str, salt: bytes) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 160_000)
    return base64.b64encode(digest).decode("ascii")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_user_profile_columns(conn: sqlite3.Connection) -> None:
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(app_users)").fetchall()}
    columns = {
        "display_name": "TEXT",
        "bio": "TEXT",
        "avatar_color": "TEXT",
        "avatar_url": "TEXT",
        "last_seen": "TEXT",
    }
    for name, column_type in columns.items():
        if name not in existing:
            conn.execute(f"ALTER TABLE app_users ADD COLUMN {name} {column_type}")
    conn.execute("UPDATE app_users SET display_name = username WHERE display_name IS NULL")
    rows = conn.execute("SELECT chat_id, username FROM app_users WHERE avatar_color IS NULL").fetchall()
    for row in rows:
        conn.execute(
            "UPDATE app_users SET avatar_color = ? WHERE chat_id = ?",
            (pick_avatar_color(row["username"]), row["chat_id"]),
        )


def _row_to_user(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "chat_id": row["chat_id"],
        "username": row["username"],
        "display_name": row["display_name"] or row["username"],
        "bio": row["bio"] or "",
        "avatar_color": row["avatar_color"] or pick_avatar_color(row["username"]),
        "avatar_url": row["avatar_url"] or "",
        "public_key": row["public_key"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "last_seen": row["last_seen"] or "",
    }


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Các hàm chức năng cho nhóm chat

def create_group(name: str, creator_id: str, member_ids: List[str]) -> Dict[str, Any]:
    now = _utc_now()
    with _db_lock:
        with _connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO conversations (type, name, created_at, updated_at)
                VALUES ('group', ?, ?, ?)
                """,
                (name, now, now),
            )
            conv_id = int(cursor.lastrowid)
            
            conn.execute(
                """
                INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
                VALUES (?, ?, 'admin', ?)
                """,
                (conv_id, creator_id, now),
            )
            for m_id in member_ids:
                if m_id != creator_id:
                    conn.execute(
                        """
                        INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
                        VALUES (?, ?, 'member', ?)
                        """,
                        (conv_id, m_id, now),
                    )
            return get_group(conv_id, conn=conn)


def get_group(conv_id: int, conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
    query_group = "SELECT * FROM conversations WHERE id = ? AND type = 'group'"
    query_members = "SELECT user_id, role, joined_at FROM conversation_members WHERE conversation_id = ? AND left_at IS NULL"
    
    if conn:
        g_row = conn.execute(query_group, (conv_id,)).fetchone()
        if not g_row:
            return None
        m_rows = conn.execute(query_members, (conv_id,)).fetchall()
        return {
            "id": g_row["id"],
            "type": g_row["type"],
            "name": g_row["name"],
            "created_at": g_row["created_at"],
            "updated_at": g_row["updated_at"],
            "members": [{"user_id": r["user_id"], "role": r["role"], "joined_at": r["joined_at"]} for r in m_rows]
        }

    with _db_lock:
        with _connect() as local_conn:
            g_row = local_conn.execute(query_group, (conv_id,)).fetchone()
            if not g_row:
                return None
            m_rows = local_conn.execute(query_members, (conv_id,)).fetchall()
            return {
                "id": g_row["id"],
                "type": g_row["type"],
                "name": g_row["name"],
                "created_at": g_row["created_at"],
                "updated_at": g_row["updated_at"],
                "members": [{"user_id": r["user_id"], "role": r["role"], "joined_at": r["joined_at"]} for r in m_rows]
            }

def delete_group(conv_id: int, requesting_user_id: str) -> bool:
    with _db_lock:
        with _connect() as conn:
            # Verify if requesting user is admin
            role_row = conn.execute(
                "SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL",
                (conv_id, requesting_user_id)
            ).fetchone()
            if not role_row or role_row["role"] != "admin":
                raise ValueError("Only admin can delete the group")

            # Xóa toàn bộ liên kết và dữ liệu của nhóm
            conn.execute("DELETE FROM group_member_keys WHERE conversation_id = ?", (conv_id,))
            conn.execute("DELETE FROM messages WHERE recipient_id = ?", (f"group:{conv_id}",))
            conn.execute("DELETE FROM conversation_members WHERE conversation_id = ?", (conv_id,))
            conn.execute("DELETE FROM conversations WHERE id = ? AND type = 'group'", (conv_id,))
            return True


def list_user_groups(user_id: str) -> List[Dict[str, Any]]:
    with _db_lock:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT c.id, c.type, c.name, c.created_at, c.updated_at
                FROM conversations c
                JOIN conversation_members cm ON c.id = cm.conversation_id
                WHERE cm.user_id = ? AND cm.left_at IS NULL AND c.type = 'group'
                ORDER BY c.updated_at DESC
                """,
                (user_id,),
            ).fetchall()
            
            groups = []
            for r in rows:
                m_rows = conn.execute(
                    "SELECT user_id, role, joined_at FROM conversation_members WHERE conversation_id = ? AND left_at IS NULL",
                    (r["id"],)
                ).fetchall()
                groups.append({
                    "id": r["id"],
                    "type": r["type"],
                    "name": r["name"],
                    "created_at": r["created_at"],
                    "updated_at": r["updated_at"],
                    "members": [{"user_id": m["user_id"], "role": m["role"], "joined_at": m["joined_at"]} for m in m_rows]
                })
            return groups


def add_group_member(conv_id: int, user_id: str) -> None:
    now = _utc_now()
    with _db_lock:
        with _connect() as conn:
            # Kiểm tra xem đã từng rời nhóm trước đó chưa
            existing = conn.execute(
                "SELECT left_at FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
                (conv_id, user_id)
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE conversation_members SET left_at = NULL, joined_at = ?, role = 'member' WHERE conversation_id = ? AND user_id = ?",
                    (now, conv_id, user_id)
                )
            else:
                conn.execute(
                    """
                    INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
                    VALUES (?, ?, 'member', ?)
                    """,
                    (conv_id, user_id, now),
                )
            conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conv_id))


def remove_group_member(conv_id: int, user_id: str) -> None:
    now = _utc_now()
    with _db_lock:
        with _connect() as conn:
            conn.execute(
                "UPDATE conversation_members SET left_at = ? WHERE conversation_id = ? AND user_id = ?",
                (now, conv_id, user_id)
            )
            conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conv_id))


def save_group_keys(conv_id: int, encrypted_keys: Dict[str, str]) -> None:
    now = _utc_now()
    with _db_lock:
        with _connect() as conn:
            for user_id, encrypted_key in encrypted_keys.items():
                conn.execute(
                    """
                    INSERT INTO group_member_keys (conversation_id, user_id, encrypted_key, created_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(conversation_id, user_id) DO UPDATE SET
                        encrypted_key = excluded.encrypted_key,
                        created_at = excluded.created_at
                    """,
                    (conv_id, user_id, encrypted_key, now)
                )


def get_group_key_for_user(conv_id: int, user_id: str) -> Optional[str]:
    with _db_lock:
        with _connect() as conn:
            row = conn.execute(
                "SELECT encrypted_key FROM group_member_keys WHERE conversation_id = ? AND user_id = ?",
                (conv_id, user_id)
            ).fetchone()
            return row["encrypted_key"] if row else None
