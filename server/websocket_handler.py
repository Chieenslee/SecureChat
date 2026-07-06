import hashlib
from typing import Any, Dict, Set

from fastapi import WebSocket

from server import storage


# Quản lý kết nối WebSocket đang hoạt động: { "#12345678": {WebSocket, ...} }
active_connections: Dict[str, Set[WebSocket]] = {}


def log_event(event_type: str, **details):
    """Ghi log ra CMD và SQLite, không lưu plaintext hoặc khóa bí mật."""
    storage.save_security_event(event_type, details)


def fingerprint(value: Any, size: int = 16) -> str:
    """Tạo vân tay SHA-256 ngắn để demo dữ liệu mã hóa mà không in toàn bộ secret."""
    if value is None:
        return ""
    raw = str(value).encode("utf-8", errors="ignore")
    return hashlib.sha256(raw).hexdigest()[:size]


def preview(value: Any, limit: int = 120) -> str:
    """Rút gọn chuỗi dài để CMD demo không bị tràn khi gửi ảnh/ghi âm."""
    if value is None:
        return ""
    text = str(value)
    if len(text) <= limit:
        return text
    half = max(12, (limit - 5) // 2)
    return f"{text[:half]} ... {text[-half:]}"


def packet_summary(packet: dict) -> dict:
    """Tóm tắt packet để trình bày trên CMD, tránh lộ plaintext và tránh log quá dài."""
    packet_type = packet.get("type")
    summary = {
        "packet_type": packet_type,
        "sender": packet.get("sender"),
        "recipient": packet.get("recipient"),
        "session_id": packet.get("session_id"),
        "timestamp": packet.get("timestamp"),
        "crypto": "AES-256-CBC + SHA-256 + RSA-2048/PKCS#1 v1.5",
    }

    if packet_type == "handshake":
        encrypted_aes_key = packet.get("encrypted_aes_key") or ""
        summary.update({
            "step": "RSA authenticates metadata and encrypts AES session key",
            "encrypted_aes_key": encrypted_aes_key,
            "encrypted_aes_key_len": len(encrypted_aes_key),
            "encrypted_aes_key_sha256": fingerprint(encrypted_aes_key),
            "metadata_signature_len": len(packet.get("metadata_signature") or ""),
            "metadata_signature_sha256": fingerprint(packet.get("metadata_signature")),
            "metadata_fields": sorted((packet.get("metadata") or {}).keys()),
        })
    elif packet_type == "message":
        cipher = packet.get("cipher") or ""
        summary.update({
            "step": "Server relays ciphertext only; plaintext is not available on server",
            "sequence_number": packet.get("sequence_number"),
            "iv_len": len(packet.get("iv") or ""),
            "iv_sha256": fingerprint(packet.get("iv")),
            "cipher_len": len(cipher),
            "cipher_sha256": fingerprint(cipher),
            "cipher_preview": preview(cipher),
            "hash": packet.get("hash"),
            "signature_len": len(packet.get("signature") or ""),
            "signature_sha256": fingerprint(packet.get("signature")),
        })
    elif packet_type in {"ack", "nack", "error"}:
        summary.update({
            "step": "Receiver/server delivery response",
            "reason": packet.get("reason") or packet.get("message"),
        })

    return summary


async def connect(websocket: WebSocket, chat_id: str):
    await websocket.accept()
    active_connections.setdefault(chat_id, set()).add(websocket)
    log_event("ws_connected", chat_id=chat_id, active_connections=len(active_connections.get(chat_id, set())))
    await deliver_pending_messages(chat_id, websocket)


def disconnect(chat_id: str, websocket: WebSocket):
    connections = active_connections.get(chat_id)
    if connections:
        connections.discard(websocket)
    if connections is not None and not connections:
        del active_connections[chat_id]
    log_event("ws_disconnected", chat_id=chat_id, remaining_connections=len(active_connections.get(chat_id, set())))


async def relay_or_store_packet(packet: dict) -> bool:
    """Relay packet nếu recipient online, nếu offline thì lưu packet đã mã hóa."""
    sender = packet.get("sender")
    recipient = packet.get("recipient")

    if recipient.startswith("group:"):
        group_id = int(recipient.split(":")[1])
        group = storage.get_group(group_id)
        if not group:
            return False

        log_event(
            "group_relay_start",
            group_id=group_id,
            members=len(group["members"]),
            **packet_summary(packet),
        )
            
        delivered_to_anyone = False
        for member in group["members"]:
            member_id = member["user_id"]
            if member_id == sender:
                continue
                
            delivered = await relay_packet(member_id, packet)
            storage.save_message(packet, "delivered" if delivered else "pending", explicit_recipient=member_id)
            if delivered:
                delivered_to_anyone = True
                
        return delivered_to_anyone

    if not storage.are_friends(sender, recipient):
        log_event("relay_rejected_not_friends", sender=sender, recipient=recipient)
        return False

    delivered = await relay_packet(recipient, packet)
    storage.save_message(packet, "delivered" if delivered else "pending")
    return delivered


async def relay_packet(recipient_id: str, packet: dict) -> bool:
    """Gửi packet tới tất cả kết nối đang online của recipient."""
    connections = active_connections.get(recipient_id, set())
    if not connections:
        log_event(
            "packet_stored_offline",
            offline_recipient=recipient_id,
            **packet_summary(packet),
        )
        return False

    delivered = 0
    disconnected = []
    for websocket in list(connections):
        try:
            await websocket.send_json(packet)
            delivered += 1
        except RuntimeError:
            disconnected.append(websocket)

    for websocket in disconnected:
        connections.discard(websocket)

    log_event(
        "packet_relayed",
        relay_recipient=recipient_id,
        delivered_connections=delivered,
        **packet_summary(packet),
    )
    return delivered > 0


async def deliver_pending_messages(chat_id: str, websocket: WebSocket):
    """Đẩy các packet đã mã hóa đang chờ khi user online lại."""
    pending = storage.pending_messages_for(chat_id)
    for item in pending:
        log_event("pending_packet_push", chat_id=chat_id, message_id=item["id"], **packet_summary(item["packet"]))
        await websocket.send_json(item["packet"])
        storage.mark_message_delivered(item["id"])
    if pending:
        log_event("pending_messages_delivered", chat_id=chat_id, count=len(pending))
