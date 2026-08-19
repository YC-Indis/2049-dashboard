from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_session
from ..schemas.workspace import ProjectCreate, ProjectPatch, RuntimePatch
from ..services import workspace as svc

router = APIRouter(prefix="/projects", tags=["projects"])


def _project_dict(project) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "aliases": project.aliases or [],
        "region": project.region,
        "status": project.status,
        "active": project.active,
    }


@router.get("")
def list_projects(active: bool = False, db: Session = Depends(get_session)) -> list[dict]:
    return [_project_dict(row) for row in svc.list_projects(db, active_only=active)]


@router.get("/{project_id}")
def read_project(project_id: str, db: Session = Depends(get_session)) -> dict:
    project = svc.get_project(db, project_id)
    return {**_project_dict(project), "runtime": svc.runtime_payload(project.runtime)}


@router.post("", status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_session)) -> dict:
    project = svc.create_project(db, body)
    return {**_project_dict(project), "runtime": svc.runtime_payload(project.runtime)}


@router.patch("/{project_id}")
def patch_project(
    project_id: str, body: ProjectPatch, db: Session = Depends(get_session)
) -> dict:
    return _project_dict(svc.update_project(db, project_id, body))


@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_session)) -> dict:
    svc.delete_project(db, project_id)
    return {"ok": True}


@router.get("/{project_id}/runtime")
def read_runtime(project_id: str, db: Session = Depends(get_session)) -> dict | None:
    return svc.runtime_payload(svc.get_runtime(db, project_id))


@router.patch("/{project_id}/runtime")
def patch_runtime(
    project_id: str, body: RuntimePatch, db: Session = Depends(get_session)
) -> dict | None:
    return svc.runtime_payload(svc.patch_runtime(db, project_id, body))
