import os
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# 必须在 import app 之前设好：db.engine 是模块加载时就建的，
# 晚了就会连到开发用的那个库上，跑一次测试把真数据洗了
_TMP = tempfile.mkdtemp(prefix="dojo-test-")
os.environ["DOJO_DATA_DIR"] = _TMP
os.environ["DOJO_LLM_API_KEY"] = ""
os.environ["RAPIDAPI_KEY"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from app.db import engine, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402

API = "/api/dojo"


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    init_db()
    with TestClient(app) as c:
        yield c
