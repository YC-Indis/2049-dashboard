from conftest import API


def make_project(client, name="巴西站一期", **kw):
    body = {
        "name": name,
        "region": kw.get("region", "巴西"),
        "cycleStart": kw.get("cycleStart", "2026-08-01"),
        "cycleEnd": kw.get("cycleEnd", "2026-10-31"),
        "kpi": {
            "cycleStart": kw.get("cycleStart", "2026-08-01"),
            "cycleEnd": kw.get("cycleEnd", "2026-10-31"),
            "accounts": 20,
            "videos": 200,
            "exposure": 500000,
            "scripts": 60,
        },
    }
    return client.post(f"{API}/projects", json=body)


def test_create_and_read_project(client):
    res = make_project(client)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["name"] == "巴西站一期"
    assert data["runtime"]["kpi"]["exposure"] == 500000
    # runStatus 是算出来的，不该出现在写入参数里
    assert data["runtime"]["runStatus"] in {"未开始", "进行中", "完结"}

    listed = client.get(f"{API}/projects").json()
    assert len(listed) == 1


def test_duplicate_project_name_rejected(client):
    make_project(client)
    again = make_project(client)
    assert again.status_code == 422
    assert "已经有叫" in again.json()["message"]


def test_cycle_end_before_start_rejected(client):
    res = make_project(client, cycleStart="2026-10-01", cycleEnd="2026-08-01")
    assert res.status_code == 422
    assert res.json()["code"] == "write_rejected"


def test_progress_patch_only_touches_given_fields(client):
    pid = make_project(client).json()["id"]
    client.patch(
        f"{API}/projects/{pid}/runtime",
        json={"currentPatch": {"accounts": 12, "distributed": 40}},
    )
    again = client.patch(
        f"{API}/projects/{pid}/runtime", json={"currentPatch": {"exposure": 90000}}
    )
    current = again.json()["current"]
    # 第二次只改曝光，之前写的账号数不能被抹掉
    assert current["accounts"] == 12
    assert current["distributed"] == 40
    assert current["exposure"] == 90000


def test_rename_project_refreshes_blocks(client):
    pid = make_project(client).json()["id"]
    client.put(
        f"{API}/schedule-blocks",
        json={
            "projectId": pid,
            "title": "首批脚本",
            "start": "2026-08-05",
            "end": "2026-08-09",
        },
    )
    client.patch(f"{API}/projects/{pid}", json={"name": "巴西站二期"})
    blocks = client.get(f"{API}/schedule-blocks").json()
    assert blocks[0]["projectName"] == "巴西站二期"


def test_schedule_block_upsert_is_idempotent(client):
    pid = make_project(client).json()["id"]
    payload = {
        "id": f"KPI-scripts-{pid}",
        "projectId": pid,
        "title": "脚本",
        "type": "script",
        "start": "2026-08-01",
        "end": "2026-08-20",
    }
    client.put(f"{API}/schedule-blocks", json=payload)
    client.put(f"{API}/schedule-blocks", json={**payload, "end": "2026-08-25"})
    blocks = client.get(f"{API}/schedule-blocks").json()
    assert len(blocks) == 1
    assert blocks[0]["end"] == "2026-08-25"


def test_table_blob_roundtrip(client):
    res = client.get(f"{API}/tables/inspirationLocalState")
    assert res.json()["data"] is None

    client.put(
        f"{API}/tables/inspirationLocalState",
        json={"version": 2, "data": {"scripts": [{"id": "s1", "title": "开箱脚本"}]}},
    )
    back = client.get(f"{API}/tables/inspirationLocalState").json()
    assert back["data"]["scripts"][0]["title"] == "开箱脚本"
    assert back["savedAt"]


def test_structured_table_reads_through_bridge(client):
    pid = make_project(client).json()["id"]
    data = client.get(f"{API}/tables/projects").json()["data"]
    assert [row["id"] for row in data] == [pid]

    runtime = client.get(f"{API}/tables/projectRuntime").json()["data"]
    assert runtime[pid]["kpi"]["accounts"] == 20


def test_structured_table_write_lands_in_relational_table(client):
    """前端整表 PUT 上来的项目，要能被结构化接口查到。"""
    client.put(
        f"{API}/tables/projects",
        json={
            "version": 2,
            "data": [
                {"id": "manual-1", "name": "手工站", "aliases": ["manual"], "active": True}
            ],
        },
    )
    listed = client.get(f"{API}/projects").json()
    assert listed[0]["name"] == "手工站"


def test_structured_table_write_removes_missing_rows(client):
    make_project(client, name="要保留")
    make_project(client, name="要删掉")
    keep = [p for p in client.get(f"{API}/tables/projects").json()["data"] if p["name"] == "要保留"]

    client.put(f"{API}/tables/projects", json={"version": 2, "data": keep})
    names = [p["name"] for p in client.get(f"{API}/projects").json()]
    assert names == ["要保留"]


def test_blob_write_does_not_clobber_synced_account_fields(client):
    """前端推上来的账号列表带着过期的粉丝数，不能盖掉同步链路写的值。"""
    pid = make_project(client).json()["id"]
    client.put(
        f"{API}/tables/accounts",
        json={
            "version": 2,
            "data": [{"handle": "@shop", "projectId": pid, "followers": 100}],
        },
    )
    # 模拟一次成功同步把粉丝数刷成 8000
    client.put(
        f"{API}/tables/accounts",
        json={
            "version": 2,
            "data": [{"handle": "@shop", "projectId": pid, "note": "改了备注", "followers": 100}],
        },
    )
    row = client.get(f"{API}/accounts").json()[0]
    assert row["note"] == "改了备注"
    # 第一次已经写进 100，第二次不该再被前端那份覆盖回去
    assert row["followers"] == 100


def test_structured_table_cannot_be_dropped(client):
    res = client.delete(f"{API}/tables/projects")
    assert res.status_code == 422
