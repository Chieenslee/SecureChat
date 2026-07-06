from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=6, max_length=128)
    public_key: str = Field(min_length=64)


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=6, max_length=128)
    public_key: Optional[str] = Field(default=None, min_length=64)


class FriendRequestCreate(BaseModel):
    chat_id: str

    @field_validator("chat_id")
    @classmethod
    def validate_chat_id(cls, value: str) -> str:
        if len(value) != 9 or not value.startswith("#") or not value[1:].isdigit():
            raise ValueError("chat_id must match # + 8 digits")
        return value


class FriendRequestAccept(BaseModel):
    request_id: int


class FriendRequestReject(BaseModel):
    request_id: int


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=80)
    bio: Optional[str] = Field(default=None, max_length=240)
    avatar_color: Optional[str] = Field(default=None, max_length=32)
    avatar_url: Optional[str] = Field(default=None, max_length=400)


class ChatPacket(BaseModel):
    type: str  # handshake, message, ack, nack
    sender: str
    recipient: str
    session_id: str
    encrypted_aes_key: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    metadata_signature: Optional[str] = None
    iv: Optional[str] = None
    cipher: Optional[str] = None
    hash: Optional[str] = None
    signature: Optional[str] = None
    sequence_number: Optional[int] = None
    timestamp: float
    reason: Optional[str] = None


class GroupCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    member_ids: list[str]


class GroupMemberUpdateRequest(BaseModel):
    user_id: str


class GroupKeyUploadRequest(BaseModel):
    encrypted_keys: Dict[str, str]

