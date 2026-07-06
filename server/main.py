import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from server import auth, storage
from server.models import (
    ChatPacket,
    FriendRequestAccept,
    FriendRequestCreate,
    FriendRequestReject,
    LoginRequest,
    ProfileUpdate,
    RegisterRequest,
    GroupCreateRequest,
    GroupMemberUpdateRequest,
    GroupKeyUploadRequest,
)
import server.websocket_handler as ws_handler


app = FastAPI(title="Secure Chat App")
storage.init_db()
ADMIN_USERNAMES = {"ADMIN", "admin"}
ADMIN_CHAT_IDS = {item.strip() for item in os.environ.get("SECURE_CHAT_ADMIN_CHAT_IDS", "").split(",") if item.strip()}
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
allowed_origins = ["http://127.0.0.1:5173", "http://localhost:5173"]
if allowed_origins_env:
    allowed_origins.extend([origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_dist = Path("frontend/dist")
legacy_static = Path("static")
if legacy_static.exists():
    app.mount("/static", StaticFiles(directory=str(legacy_static)), name="static")

if frontend_dist.exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

vendor_dir = Path("node_modules/node-forge/dist")
if vendor_dir.exists():
    app.mount("/vendor", StaticFiles(directory=str(vendor_dir)), name="vendor")


@app.get("/")
async def index():
    """Serve React app nếu đã build, fallback về hướng dẫn build."""
    index_file = frontend_dist / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return RedirectResponse(url="/static/real.html")


@app.post("/api/register")
async def register(payload: RegisterRequest):
    """Đăng ký tài khoản, sinh Chat ID và trả JWT."""
    try:
        user = storage.create_user(payload.username.strip(), payload.password, payload.public_key)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    token = auth.create_access_token(user)
    ws_handler.log_event(
        "auth_registered",
        chat_id=user["chat_id"],
        username=user["username"],
        public_key=demo_key_summary(payload.public_key),
        jwt={"len": len(token), "sha256": ws_handler.fingerprint(token, 32)},
        note="Client generated RSA-2048 keypair; server stores public key only",
    )
    return {"access_token": token, "user": sanitize_user(user)}


@app.post("/api/login")
async def login(payload: LoginRequest):
    """Đăng nhập tài khoản và cập nhật public key mới nếu client gửi lên."""
    user = storage.authenticate_user(payload.username.strip(), payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if payload.public_key:
        storage.update_public_key(user["chat_id"], payload.public_key)
        user = storage.get_user_by_chat_id(user["chat_id"])

    token = auth.create_access_token(user)
    ws_handler.log_event(
        "auth_login",
        chat_id=user["chat_id"],
        username=user["username"],
        public_key=demo_key_summary(user.get("public_key")),
        jwt={"len": len(token), "sha256": ws_handler.fingerprint(token, 32)},
        note="Server returned JWT; private key remains in browser localStorage",
    )
    return {"access_token": token, "user": sanitize_user(user)}


@app.get("/api/me")
async def me(request: Request):
    chat_id = auth.get_current_chat_id(request)
    user = storage.get_user_by_chat_id(chat_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": sanitize_user(user)}


@app.patch("/api/me")
async def update_me(payload: ProfileUpdate, request: Request):
    chat_id = auth.get_current_chat_id(request)
    user = storage.update_profile(chat_id, payload.model_dump(exclude_unset=True))
    ws_handler.log_event("profile_updated", chat_id=chat_id)
    return {"user": sanitize_user(user)}


@app.get("/api/users/search")
async def search_user(chat_id: str, request: Request):
    current_chat_id = auth.get_current_chat_id(request)
    user = storage.search_user(chat_id, current_chat_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": sanitize_user(user)}


@app.get("/api/friends")
async def friends(request: Request):
    chat_id = auth.get_current_chat_id(request)
    return {"friends": [sanitize_user(item) for item in storage.list_friends(chat_id)]}


@app.delete("/api/friends/{friend_id}")
async def delete_friend_api(friend_id: str, request: Request):
    chat_id = auth.get_current_chat_id(request)
    success = storage.delete_friend(chat_id, friend_id)
    if not success:
        raise HTTPException(status_code=404, detail="Friendship not found")
    ws_handler.log_event("friend_deleted", user1=chat_id, user2=friend_id)
    return {"status": "success"}


@app.post("/api/friend-requests")
async def create_friend_request(payload: FriendRequestCreate, request: Request):
    chat_id = auth.get_current_chat_id(request)
    try:
        result = storage.create_friend_request(chat_id, payload.chat_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    ws_handler.log_event("friend_request", requester=chat_id, receiver=payload.chat_id, status=result["status"])
    return result


@app.get("/api/friend-requests")
async def friend_requests(request: Request):
    chat_id = auth.get_current_chat_id(request)
    return {"requests": storage.list_friend_requests(chat_id)}


@app.post("/api/friend-requests/accept")
async def accept_friend_request(payload: FriendRequestAccept, request: Request):
    chat_id = auth.get_current_chat_id(request)
    try:
        storage.accept_friend_request(payload.request_id, chat_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    ws_handler.log_event("friend_request_accepted", receiver=chat_id, request_id=payload.request_id)
    return {"status": "accepted"}


@app.post("/api/friend-requests/reject")
async def reject_friend_request(payload: FriendRequestReject, request: Request):
    chat_id = auth.get_current_chat_id(request)
    try:
        storage.reject_friend_request(payload.request_id, chat_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    ws_handler.log_event("friend_request_rejected", receiver=chat_id, request_id=payload.request_id)
    return {"status": "rejected"}


@app.get("/api/public-key/{chat_id}")
async def get_public_key(chat_id: str, request: Request):
    current_chat_id = auth.get_current_chat_id(request)
    if current_chat_id != chat_id and not storage.are_friends(current_chat_id, chat_id):
        raise HTTPException(status_code=403, detail="Users are not friends")
    public_key = storage.get_public_key(chat_id)
    if not public_key:
        raise HTTPException(status_code=404, detail="User not found")
    ws_handler.log_event(
        "public_key_served",
        requester=current_chat_id,
        owner=chat_id,
        public_key=demo_key_summary(public_key),
        note="Server distributes public key for RSA encryption/verification",
    )
    return {"chat_id": chat_id, "public_key": public_key}


@app.get("/api/security-events")
async def security_events(request: Request):
    """Debug API chỉ dành cho admin demo. UI React không dùng endpoint này."""
    require_admin(request)
    return {"events": storage.load_security_events(limit=100)}


@app.get("/api/admin/demo-state")
async def admin_demo_state(request: Request):
    """Snapshot demo cho admin: thuật toán, public key, kết nối và log gần nhất."""
    admin_id = require_admin(request)
    users = storage.list_users_for_admin()
    events = storage.load_security_events(limit=120)
    return {
        "admin": admin_id,
        "crypto": {
            "content_encryption": "AES-256-CBC",
            "key_exchange": "RSA-2048 encrypt AES key with PKCS#1 v1.5",
            "authentication": "RSA-2048 digital signature + SHA-256",
            "integrity": "SHA-256(IV || ciphertext)",
            "server_visibility": "Server sees public keys, encrypted AES keys, IV, ciphertext, hash, signature; server does not see plaintext/private key/raw AES key.",
        },
        "server": {
            "active_users": sorted(ws_handler.active_connections.keys()),
            "active_connection_count": sum(len(items) for items in ws_handler.active_connections.values()),
            "stored_event_count": len(events),
        },
        "users": [
            {
                "chat_id": user["chat_id"],
                "username": user["username"],
                "display_name": user.get("display_name") or user["username"],
                "public_key": demo_key_summary(user.get("public_key")),
                "created_at": user.get("created_at"),
                "updated_at": user.get("updated_at"),
            }
            for user in users
        ],
        "events": events,
    }


# Các API liên quan đến nhóm chat

@app.post("/api/groups")
async def create_group_api(payload: GroupCreateRequest, request: Request):
    chat_id = auth.get_current_chat_id(request)
    group = storage.create_group(payload.name, chat_id, payload.member_ids)
    ws_handler.log_event("group_created", chat_id=chat_id, group_id=group["id"], members=[m["user_id"] for m in group["members"]])
    return group

@app.get("/api/groups")
async def list_groups(request: Request):
    chat_id = auth.get_current_chat_id(request)
    groups = storage.list_user_groups(chat_id)
    return {"groups": groups}

@app.get("/api/groups/{group_id}")
async def get_group_api(group_id: int, request: Request):
    chat_id = auth.get_current_chat_id(request)
    group = storage.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if not any(m["user_id"] == chat_id for m in group["members"]):
        raise HTTPException(status_code=403, detail="Not a member")
    
    key = storage.get_group_key_for_user(group_id, chat_id)
    group["encrypted_key"] = key
    return group

@app.delete("/api/groups/{group_id}")
async def delete_group_api(group_id: int, request: Request):
    chat_id = auth.get_current_chat_id(request)
    group = storage.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    try:
        storage.delete_group(group_id, chat_id)
        # Bắn sự kiện websocket để thông báo nhóm bị giải tán
        ws_handler.log_event("group_deleted", group_id=group_id, admin=chat_id)
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.post("/api/groups/{group_id}/members")
async def add_group_member_api(group_id: int, payload: GroupMemberUpdateRequest, request: Request):
    chat_id = auth.get_current_chat_id(request)
    group = storage.get_group(group_id)
    if not group or not any(m["user_id"] == chat_id and m["role"] == "admin" for m in group["members"]):
        raise HTTPException(status_code=403, detail="Not admin or group not found")
    storage.add_group_member(group_id, payload.user_id)
    ws_handler.log_event("group_member_added", admin=chat_id, group_id=group_id, user_id=payload.user_id)
    return {"status": "success"}

@app.delete("/api/groups/{group_id}/members/{user_id}")
async def remove_group_member_api(group_id: int, user_id: str, request: Request):
    chat_id = auth.get_current_chat_id(request)
    group = storage.get_group(group_id)
    if not group or not any(m["user_id"] == chat_id and m["role"] == "admin" for m in group["members"]):
        raise HTTPException(status_code=403, detail="Not admin or group not found")
    storage.remove_group_member(group_id, user_id)
    ws_handler.log_event("group_member_removed", admin=chat_id, group_id=group_id, user_id=user_id)
    return {"status": "success"}

@app.post("/api/groups/{group_id}/rotate-key")
async def rotate_group_key_api(group_id: int, payload: GroupKeyUploadRequest, request: Request):
    chat_id = auth.get_current_chat_id(request)
    group = storage.get_group(group_id)
    if not group or not any(m["user_id"] == chat_id and m["role"] == "admin" for m in group["members"]):
        raise HTTPException(status_code=403, detail="Not admin or group not found")
    storage.save_group_keys(group_id, payload.encrypted_keys)
    ws_handler.log_event(
        "group_key_rotated",
        admin=chat_id,
        group_id=group_id,
        encrypted_group_keys={
            user_id: {
                "len": len(encrypted_key),
                "sha256": ws_handler.fingerprint(encrypted_key),
                "encrypted_key": encrypted_key,
                "encrypted_key_preview": preview(encrypted_key, 72),
            }
            for user_id, encrypted_key in payload.encrypted_keys.items()
        },
        note="One AES group key is encrypted separately with each member public RSA key",
    )
    return {"status": "success"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket relay xác thực bằng JWT query token."""
    token = websocket.query_params.get("token", "")
    try:
        payload = auth.verify_access_token(token)
        chat_id = payload["sub"]
    except HTTPException:
        await websocket.close(code=4401)
        return

    await ws_handler.connect(websocket, chat_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                raw_packet = json.loads(data)
                parsed_packet = ChatPacket.model_validate(raw_packet)
                packet = parsed_packet.model_dump(exclude_none=True)
                ws_handler.log_event("packet_received_from_client", websocket_user=chat_id, **ws_handler.packet_summary(packet))

                if parsed_packet.sender != chat_id:
                    ws_handler.log_event(
                        "sender_mismatch",
                        websocket_user=chat_id,
                        claimed_sender=parsed_packet.sender,
                        session_id=parsed_packet.session_id,
                    )
                    await websocket.send_json({
                        "type": "nack",
                        "sender": parsed_packet.recipient,
                        "recipient": chat_id,
                        "session_id": parsed_packet.session_id,
                        "timestamp": parsed_packet.timestamp,
                        "reason": "Sender mismatch",
                    })
                    continue

                if parsed_packet.recipient.startswith("group:"):
                    group_id = int(parsed_packet.recipient.split(":")[1])
                    group = storage.get_group(group_id)
                    if not group or not any(m["user_id"] == parsed_packet.sender for m in group["members"]):
                        await websocket.send_json({
                            "type": "nack",
                            "sender": parsed_packet.recipient,
                            "recipient": chat_id,
                            "session_id": parsed_packet.session_id,
                            "timestamp": parsed_packet.timestamp,
                            "reason": "You are not a member of this group",
                        })
                        ws_handler.log_event("relay_rejected_not_group_member", sender=parsed_packet.sender, recipient=parsed_packet.recipient)
                        continue
                elif not storage.are_friends(parsed_packet.sender, parsed_packet.recipient):
                    await websocket.send_json({
                        "type": "nack",
                        "sender": parsed_packet.recipient,
                        "recipient": chat_id,
                        "session_id": parsed_packet.session_id,
                        "timestamp": parsed_packet.timestamp,
                        "reason": "Recipient is not your friend",
                    })
                    ws_handler.log_event(
                        "relay_rejected_not_friends",
                        sender=parsed_packet.sender,
                        recipient=parsed_packet.recipient,
                    )
                    continue

                delivered = await ws_handler.relay_or_store_packet(packet)
                if not delivered:
                    await websocket.send_json({
                        "type": "ack",
                        "sender": parsed_packet.recipient,
                        "recipient": chat_id,
                        "session_id": parsed_packet.session_id,
                        "timestamp": parsed_packet.timestamp,
                        "reason": "Tin nhắn đã được lưu trữ (người nhận đang offline)",
                    })
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON format"})
            except ValidationError as exc:
                ws_handler.log_event("packet_validation_error", chat_id=chat_id)
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid packet schema",
                    "detail": exc.errors(),
                })
    except WebSocketDisconnect:
        ws_handler.disconnect(chat_id, websocket)


def sanitize_user(user: dict) -> dict:
    return {
        "chat_id": user["chat_id"],
        "username": user["username"],
        "display_name": user.get("display_name") or user["username"],
        "bio": user.get("bio", ""),
        "avatar_color": user.get("avatar_color", "#2aabee"),
        "avatar_url": user.get("avatar_url", ""),
        "is_self": user.get("is_self", False),
        "is_friend": user.get("is_friend", False),
        "public_key": user.get("public_key"),
    }


def require_admin(request: Request) -> str:
    chat_id = auth.get_current_chat_id(request)
    user = storage.get_user_by_chat_id(chat_id)
    username = (user or {}).get("username", "")
    if chat_id not in ADMIN_CHAT_IDS and username not in ADMIN_USERNAMES:
        raise HTTPException(status_code=403, detail="Admin only")
    return chat_id


def demo_key_summary(key: str | None) -> dict:
    if not key:
        return {"len": 0, "sha256": ""}
    return {
        "algorithm": "RSA-2048 public key PEM",
        "len": len(key),
        "sha256": ws_handler.fingerprint(key, 32),
        "public_key_pem": key,
        "preview": preview(key.replace("\n", "\\n"), 120),
    }


def preview(value: str, limit: int = 80) -> str:
    if value is None:
        return ""
    text = str(value)
    if len(text) <= limit:
        return text
    half = max(8, (limit - 5) // 2)
    return f"{text[:half]} ... {text[-half:]}"


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    """Cho phép refresh các route React ở production build."""
    index_file = frontend_dist / "index.html"
    if index_file.exists() and not full_path.startswith("api/"):
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Not found")
