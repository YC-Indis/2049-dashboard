"""重点覆盖 AGENTS.md 里那几条硬规则。

这些规则以前只写在 system prompt 里，模型心情好就遵守。现在服务端也挡一道，
所以要有测试守着——prompt 可以改，这几条不能松。
"""

from conftest import API
from test_workspace import make_project


def confirm(client, tool, args, ok=True):
    return client.post(
        f"{API}/agent/confirm",
        json={"tool": tool, "arguments": args, "confirmed": ok},
    )


def test_project_write_without_name_is_ambiguous(client):
    make_project(client, name="巴西站一期")
    make_project(client, name="美国站")

    res = confirm(client, "create_task", {"title": "拍摄", "date": "2026-09-01"})
    assert res.status_code == 409
    body = res.json()
    assert body["code"] == "project_ambiguous"
    # 必须把候选列出来给用户挑，不能自己选一个
    assert {c["name"] for c in body["candidates"]} == {"巴西站一期", "美国站"}


def test_single_project_is_inferred(client):
    make_project(client, name="巴西站一期")
    res = confirm(client, "create_task", {"title": "拍摄", "date": "2026-09-01"})
    assert res.status_code == 200
    assert res.json()["result"]["project"] == "巴西站一期"


def test_named_project_wins_over_ambiguity(client):
    make_project(client, name="巴西站一期")
    make_project(client, name="美国站")
    res = confirm(
        client,
        "create_task",
        {"project": "把美国站的拍摄排一下", "title": "拍摄", "date": "2026-09-01"},
    )
    assert res.status_code == 200
    assert res.json()["result"]["project"] == "美国站"


def test_longer_project_name_wins(client):
    make_project(client, name="巴西站")
    make_project(client, name="巴西站二期")
    res = confirm(
        client,
        "create_task",
        {"project": "巴西站二期", "title": "剪辑", "date": "2026-09-02"},
    )
    assert res.json()["result"]["project"] == "巴西站二期"


def test_collection_query_rejects_project_brand(client):
    make_project(client, name="巴西站一期")
    res = confirm(client, "create_collection", {"query": "巴西站一期 unboxing"})
    assert res.status_code == 422
    assert "混进了项目名" in res.json()["message"]


def test_collection_accepts_standalone_keyword(client):
    make_project(client, name="巴西站一期")
    res = confirm(client, "create_collection", {"query": "unboxing", "days": 30, "limit": 20})
    assert res.status_code == 200
    assert res.json()["result"]["query"] == "unboxing"

    state = client.get(f"{API}/tables/inspirationLocalState").json()["data"]
    assert state["sources"][0]["query"] == "unboxing"


def test_missing_arguments_reported_as_field_list(client):
    make_project(client, name="巴西站一期")
    res = confirm(client, "update_progress", {})
    assert res.status_code == 422
    body = res.json()
    assert body["code"] == "tool_argument_missing"
    assert "distributed" in body["missing"]


def test_cancelled_action_is_not_executed_but_audited(client):
    make_project(client, name="巴西站一期")
    res = confirm(client, "create_task", {"title": "别建", "date": "2026-09-01"}, ok=False)
    assert res.json()["executed"] is False
    assert client.get(f"{API}/schedule-blocks").json() == []

    audits = client.get(f"{API}/agent/audits").json()
    assert audits[0]["tool"] == "create_task"
    assert audits[0]["confirmed"] is False


def test_executed_action_is_audited(client):
    make_project(client, name="巴西站一期")
    confirm(client, "create_task", {"title": "拍摄", "date": "2026-09-01"})
    audits = client.get(f"{API}/agent/audits").json()
    assert audits[0]["executed"] is True
    assert audits[0]["ok"] is True


def test_delete_requires_existing_record(client):
    res = confirm(client, "delete_record", {"kind": "inspiration", "id": "nope"})
    assert res.status_code == 404


def test_chat_degrades_without_api_key(client):
    make_project(client, name="巴西站一期")
    res = client.post(f"{API}/agent/chat", json={"message": "现在有几个项目"})
    assert res.status_code == 200
    body = res.json()
    assert body["degraded"] is True
    # 降级也要给真实数字，不能只回一句「服务不可用」
    assert "项目 1 个" in body["content"]


def test_session_keeps_messages(client):
    client.post(f"{API}/agent/chat", json={"message": "你好"})
    session = client.get(f"{API}/agent/session/default").json()
    roles = [m["role"] for m in session["messages"]]
    assert roles[0] == "user"
    assert "assistant" in roles
