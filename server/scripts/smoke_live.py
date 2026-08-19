"""对着真在跑的服务打一遍主要链路。

pytest 用的是内存里现建的库，测不到进程真正起来之后的样子——CORS、SSE 缓冲、
数据库文件权限这些只有连真服务才暴露。部署完跑一次这个脚本再交付。

    python scripts/smoke_live.py [http://127.0.0.1:8000]
"""

import sys

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE}/api/dojo"

passed = 0
failed: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    global passed
    if condition:
        passed += 1
        print(f"  ok   {label}")
    else:
        failed.append(label)
        print(f"  FAIL {label} {detail}")


def main() -> int:
    with httpx.Client(timeout=30.0) as client:
        print("健康检查")
        res = client.get(f"{API}/health")
        check("服务可达", res.status_code == 200, res.text)
        state = res.json()
        print(f"       模型={'已配置' if state['llm'] else '未配置'} "
              f"RapidAPI={'已配置' if state['rapidapi'] else '未配置'}")

        print("项目 CRUD")
        name = "冒烟测试项目"
        client.request("DELETE", f"{API}/projects/smoke-check", json=None)
        created = client.post(
            f"{API}/projects",
            json={
                "name": name,
                "region": "美国",
                "cycleStart": "2026-08-01",
                "cycleEnd": "2026-12-31",
                "kpi": {
                    "cycleStart": "2026-08-01",
                    "cycleEnd": "2026-12-31",
                    "accounts": 10,
                    "videos": 100,
                    "exposure": 200000,
                    "scripts": 30,
                },
            },
        )
        if created.status_code == 422:
            # 上一次冒烟留下的，先删掉重来
            existing = [p for p in client.get(f"{API}/projects").json() if p["name"] == name]
            for item in existing:
                client.delete(f"{API}/projects/{item['id']}")
            created = client.post(
                f"{API}/projects", json={"name": name, "region": "美国"}
            )
        check("建项目", created.status_code == 201, created.text)
        pid = created.json()["id"]

        check(
            "中文字段没有乱码",
            client.get(f"{API}/projects/{pid}").json()["name"] == name,
        )

        print("排期")
        block = client.put(
            f"{API}/schedule-blocks",
            json={
                "projectId": pid,
                "title": "首批脚本",
                "type": "script",
                "start": "2026-08-05",
                "end": "2026-08-20",
            },
        )
        check("建排期块", block.status_code == 200, block.text)
        bid = block.json()["id"]

        moved = client.patch(
            f"{API}/schedule-blocks/{bid}", json={"start": "2026-08-10", "end": "2026-08-25"}
        )
        check("改期", moved.json()["end"] == "2026-08-25", moved.text)

        bad = client.patch(
            f"{API}/schedule-blocks/{bid}", json={"start": "2026-09-01", "end": "2026-08-01"}
        )
        check("倒挂日期被拒", bad.status_code == 422, bad.text)

        print("整表读写")
        client.put(
            f"{API}/tables/inspirationLocalState",
            json={"version": 2, "data": {"scripts": [{"id": "s1", "title": "开箱脚本"}]}},
        )
        blob = client.get(f"{API}/tables/inspirationLocalState").json()
        check("整表回读一致", blob["data"]["scripts"][0]["title"] == "开箱脚本")
        bridged = client.get(f"{API}/tables/projects").json()["data"]
        check(
            "结构化表能从整表通道读到",
            any(row["id"] == pid for row in bridged),
            str(bridged),
        )

        print("Agent 规则")
        collect = client.post(
            f"{API}/agent/confirm",
            json={"tool": "create_collection", "arguments": {"query": f"{name} unboxing"}},
        )
        check("检索词里的项目名被挡下", collect.status_code == 422, collect.text)

        ok_collect = client.post(
            f"{API}/agent/confirm",
            json={"tool": "create_collection", "arguments": {"query": "unboxing", "days": 30}},
        )
        check("独立检索词放行", ok_collect.status_code == 200, ok_collect.text)

        cancelled = client.post(
            f"{API}/agent/confirm",
            json={
                "tool": "create_task",
                "arguments": {"project": name, "title": "不该建", "date": "2026-09-01"},
                "confirmed": False,
            },
        )
        check("取消不落库", cancelled.json()["executed"] is False)

        print("Agent 对话")
        chat = client.post(f"{API}/agent/chat", json={"message": "现在有几个项目"})
        check("chat 有响应", chat.status_code == 200 and chat.json()["content"], chat.text)
        if chat.json().get("degraded"):
            print("       （未配模型 Key，走的是本地兜底，属预期）")

        print("SSE")
        events: list[str] = []
        with client.stream(
            "POST", f"{API}/agent/stream", json={"message": "账号运营怎么样"}
        ) as res:
            check("流式连接建立", res.status_code == 200)
            for line in res.iter_lines():
                if line.startswith("event:"):
                    events.append(line.split(":", 1)[1].strip())
        check("收到 done 事件", "done" in events, str(events))

        print("清理")
        client.delete(f"{API}/projects/{pid}")
        client.delete(f"{API}/tables/inspirationLocalState")
        check("删项目连带删排期", client.get(f"{API}/schedule-blocks").json() == [])

    print()
    if failed:
        print(f"{passed} 项通过，{len(failed)} 项失败：{'、'.join(failed)}")
        return 1
    print(f"全部 {passed} 项通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
