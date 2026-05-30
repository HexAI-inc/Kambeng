import os
import sys
import time
import mimetypes
from pathlib import Path
import requests

BASE = os.environ.get("BACKEND_URL", "http://127.0.0.1:8001")
IMAGE_PATH = Path(os.environ.get("E2E_IMAGE_PATH", "/home/c_jalloh/Pictures/IMG-20220828-WA0154.jpg"))


def register_and_login(session, wave_number: str, password: str, email: str):
    reg = session.post(f"{BASE}/api/auth/register", json={
        "full_name": "E2E User",
        "email": email,
        "wave_number": wave_number,
        "password": password,
    })
    print("register:", reg.status_code)
    if reg.status_code not in (200, 201):
        print(reg.text)
        raise SystemExit(1)

    login = session.post(f"{BASE}/api/auth/login", json={"username": wave_number, "password": password})
    print("login:", login.status_code)
    if login.status_code != 200:
        print(login.text)
        raise SystemExit(1)
    token = login.json()["data"]["tokens"]["accessToken"]
    return token


def main():
    s = requests.Session()

    wave = "+2207" + str(int(time.time()) % 1000000).rjust(6, '0')
    password = "StrongPass123!"
    email = f"e2e-{int(time.time())}@example.com"

    token = register_and_login(s, wave, password, email)
    headers = {"Authorization": f"Bearer {token}"}

    # Create campaign
    create = s.post(f"{BASE}/api/campaigns/", json={
        "title": "E2E Campaign",
        "description": "Testing DO Spaces uploads",
        "mode": "TARGET",
        "target_amount": 100,
    }, headers=headers)
    print("create campaign:", create.status_code)
    if create.status_code != 201:
        print(create.text)
        raise SystemExit(1)
    slug = create.json()["slug"]

    if not IMAGE_PATH.exists():
        print(f"image not found: {IMAGE_PATH}")
        raise SystemExit(1)

    image_content_type = mimetypes.guess_type(IMAGE_PATH.name)[0] or "image/jpeg"
    image_bytes = IMAGE_PATH.read_bytes()
    print("image bytes:", len(image_bytes))

    # Presign image
    presign = s.post(f"{BASE}/api/uploads/campaigns/{slug}/images/presign", json={
        "filename": IMAGE_PATH.name,
        "content_type": image_content_type,
    }, headers=headers)
    print("presign:", presign.status_code)
    if presign.status_code != 200:
        print(presign.text)
        raise SystemExit(1)

    data = presign.json()
    post_url = data["url"]
    fields = data["fields"]
    public_url = data["public_url"]

    # Upload file to DO Spaces via presigned post
    files = {"file": (IMAGE_PATH.name, image_bytes, image_content_type)}
    resp = requests.post(post_url, data=fields, files=files)
    print("upload to spaces status:", resp.status_code)
    if resp.status_code not in (200, 204):
        # some endpoints return 204/201/201, print body
        print(resp.text)

    # Verify public URL
    head = requests.head(public_url)
    print("public url head:", head.status_code)
    if head.status_code not in (200, 204):
        get = requests.get(public_url)
        print("public url get:", get.status_code)

    # Upload proof via backend (server will put to DO Spaces)
    proof_files = {"file": ("proof.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")}
    proof_resp = s.post(f"{BASE}/api/uploads/proofs/{slug}", headers=headers, files=proof_files)
    print("upload proof:", proof_resp.status_code)
    print(proof_resp.text)


if __name__ == "__main__":
    main()
