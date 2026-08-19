from conftest import API

GOOD = {"userName": "Super", "password": "test-only-passphrase"}


def test_mode_reports_enabled(client):
    assert client.get(f"{API}/auth/mode").json()["enabled"] is True


def test_login_returns_token_and_role(client):
    res = client.post(f"{API}/auth/login", json=GOOD)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["role"] == "R_SUPER"
    assert body["token"].count(".") == 1


def test_admin_gets_lower_role(client):
    body = client.post(
        f"{API}/auth/login", json={"userName": "admin", "password": GOOD["password"]}
    ).json()
    assert body["role"] == "R_ADMIN"


def test_wrong_password_rejected(client):
    res = client.post(f"{API}/auth/login", json={"userName": "Super", "password": "nope"})
    assert res.status_code == 401
    assert res.json()["code"] == "auth_failed"


def test_unknown_user_gives_same_message_as_wrong_password(client):
    # 两种失败必须无法区分，否则可以拿来枚举账号
    bad_user = client.post(f"{API}/auth/login", json={"userName": "ghost", "password": "nope"})
    bad_pass = client.post(f"{API}/auth/login", json={"userName": "Super", "password": "nope"})
    assert bad_user.json()["message"] == bad_pass.json()["message"]


def test_me_requires_token(client):
    assert client.get(f"{API}/auth/me").status_code == 401


def test_me_accepts_issued_token(client):
    token = client.post(f"{API}/auth/login", json=GOOD).json()["token"]
    res = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["roles"] == ["R_SUPER"]


def test_tampered_token_rejected(client):
    token = client.post(f"{API}/auth/login", json=GOOD).json()["token"]
    body, sig = token.split(".")
    # 保留合法签名，只改载荷——想把自己提权成 R_SUPER 的典型手法
    forged = f"{body[:-4]}AAAA.{sig}"
    res = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert res.status_code == 401


def test_expired_token_rejected(client):
    from app.routers.auth import sign_token

    stale = sign_token("super", "R_SUPER", ttl_hours=-1)
    res = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {stale}"})
    assert res.status_code == 401
    assert "过期" in res.json()["message"]
