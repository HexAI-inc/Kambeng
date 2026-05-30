import mimetypes
import os
from pathlib import Path

import requests


BASE = os.environ.get("BACKEND_URL", "http://127.0.0.1:8001")
CAMPAIGN_SLUG = os.environ.get("CAMPAIGN_SLUG", "e2e-campaign-2a1af1")
IMAGE_PATH = Path(os.environ.get("PROOF_IMAGE_PATH", "/home/c_jalloh/Pictures/WhatsApp Image 2026-01-04 at 00.48.14.jpeg"))


def main() -> None:
    if not IMAGE_PATH.exists():
        raise SystemExit(f"image not found: {IMAGE_PATH}")

    session = requests.Session()
    login = session.post(
        f"{BASE}/api/auth/login",
        json={"username": "+2207000000", "password": "AdminPass123!"},
    )
    print("login:", login.status_code)
    if login.status_code != 200:
        print(login.text)
        raise SystemExit(1)

    token = login.json()["data"]["tokens"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    content_type = mimetypes.guess_type(IMAGE_PATH.name)[0] or "image/jpeg"
    file_bytes = IMAGE_PATH.read_bytes()
    print("bytes:", len(file_bytes), "content_type:", content_type)

    upload = session.post(
        f"{BASE}/api/uploads/proofs/{CAMPAIGN_SLUG}",
        headers=headers,
        data={
            "description": "Expenditure proof upload",
            "document_type": "OTHER",
            "visibility": "PUBLIC",
        },
        files={"file": (IMAGE_PATH.name, file_bytes, content_type)},
    )
    print("upload:", upload.status_code)
    print(upload.text)
    if upload.status_code not in (200, 201):
        raise SystemExit(1)

    proofs = session.get(f"{BASE}/api/uploads/proofs/{CAMPAIGN_SLUG}", headers=headers)
    print("proofs:", proofs.status_code)
    print(proofs.text)


if __name__ == "__main__":
    main()