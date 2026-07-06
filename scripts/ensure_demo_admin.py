import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server import storage


DEMO_PUBLIC_KEY = (
    "-----BEGIN PUBLIC KEY-----\n"
    "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALZ8vM9lWjQzL4N1b5zP6x1mK9aY\n"
    "nGqXwY9wFzv4jQ2T1kY7F6f3sV8c9bA0wL1p2s3d4f5g6h7i8j9k0lMCAwEAAQ==\n"
    "-----END PUBLIC KEY-----"
)


def main() -> None:
    username = os.environ.get("SECURE_CHAT_DEMO_ADMIN_USERNAME", "ADMIN")
    password = os.environ.get("SECURE_CHAT_DEMO_ADMIN_PASSWORD", "1234567890")

    storage.init_db()
    user = storage.reset_user_password(username, password)
    if not user:
        user = storage.create_user(username, password, DEMO_PUBLIC_KEY)

    print(f"Demo admin ready: username={username} password={password} chat_id={user['chat_id']}")


if __name__ == "__main__":
    main()
