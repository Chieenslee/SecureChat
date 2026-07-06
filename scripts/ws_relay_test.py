import asyncio
import json
import os
import time
from urllib import error, request

import websockets


BASE_URL = os.environ.get("SECURE_CHAT_BASE_URL", "http://127.0.0.1:8010")
WS_URL = os.environ.get("SECURE_CHAT_WS_URL", "ws://127.0.0.1:8010")
PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\n" + ("A" * 80) + "\n-----END PUBLIC KEY-----"


def post_json(path, payload, token=None):
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    http_request = request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers=headers,
        method="POST",
    )
    with request.urlopen(http_request, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def get_json(path, token):
    http_request = request.Request(
        f"{BASE_URL}{path}",
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with request.urlopen(http_request, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def register_or_login(username):
    payload = {"username": username, "password": "password123", "public_key": PUBLIC_KEY}
    try:
        return post_json("/api/register", payload)
    except error.HTTPError as exc:
        if exc.code != 409:
            raise
        return post_json("/api/login", payload)


def build_packet(sender, recipient, packet_type="message", reason=None):
    now = int(time.time() * 1000)
    return {
        "type": packet_type,
        "sender": sender,
        "recipient": recipient,
        "session_id": "relay-test-session",
        "metadata": {
            "sender": sender,
            "recipient": recipient,
            "session_id": "relay-test-session",
        },
        "metadata_signature": "dummy-metadata-signature",
        "iv": "dummy-iv",
        "cipher": "dummy-cipher",
        "hash": "0" * 64,
        "signature": "dummy-signature",
        "sequence_number": 1,
        "timestamp": now,
        "reason": reason,
    }


async def run_relay_test():
    user_a = register_or_login(f"user_a_{int(time.time())}")
    user_b = register_or_login(f"user_b_{int(time.time())}")
    user_a_id = user_a["user"]["chat_id"]
    user_b_id = user_b["user"]["chat_id"]
    user_a_token = user_a["access_token"]
    user_b_token = user_b["access_token"]

    post_json("/api/friend-requests", {"chat_id": user_b_id}, user_a_token)
    requests = get_json("/api/friend-requests", user_b_token)["requests"]
    request_id = next(item["id"] for item in requests if item["requester_id"] == user_a_id)
    post_json("/api/friend-requests/accept", {"request_id": request_id}, user_b_token)

    async with websockets.connect(f"{WS_URL}/ws?token={user_a_token}") as user_a_ws:
        async with websockets.connect(f"{WS_URL}/ws?token={user_b_token}") as user_b_ws:
            async with websockets.connect(f"{WS_URL}/ws?token={user_b_token}") as user_b_second_ws:
                valid_packet = build_packet(user_a_id, user_b_id)
                await user_a_ws.send(json.dumps(valid_packet))
                relayed_packet = json.loads(await asyncio.wait_for(user_b_ws.recv(), timeout=5))
                relayed_second_packet = json.loads(
                    await asyncio.wait_for(user_b_second_ws.recv(), timeout=5)
                )

                if relayed_packet["sender"] != user_a_id:
                    raise AssertionError("User B did not receive packet from User A")
                if relayed_packet["recipient"] != user_b_id:
                    raise AssertionError("Relayed packet recipient mismatch")
                if relayed_second_packet["session_id"] != valid_packet["session_id"]:
                    raise AssertionError("Second User B connection did not receive packet")

                mismatch_packet = build_packet("#00000000", user_b_id)
                await user_a_ws.send(json.dumps(mismatch_packet))
                nack_packet = json.loads(await asyncio.wait_for(user_a_ws.recv(), timeout=5))

                if nack_packet["type"] != "nack":
                    raise AssertionError("Server did not reject sender mismatch")
                if nack_packet.get("reason") != "Sender mismatch":
                    raise AssertionError(f"Unexpected NACK reason: {nack_packet.get('reason')}")

    print(
        json.dumps(
            {
                "status": "ok",
                "server": BASE_URL,
                "checked": [
                    "register/login with jwt",
                    "friend request by #id",
                    "websocket jwt auth",
                    "friend-only relay",
                    "multiple websocket connections for one user",
                    "sender mismatch nack",
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(run_relay_test())
