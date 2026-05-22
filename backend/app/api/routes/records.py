from fastapi import APIRouter, HTTPException

from app.schemas.records import ApiMessage, RecordCreateRequest
from app.services.records import create_record, list_records


router = APIRouter(tags=["records"])


@router.get("/records", response_model=ApiMessage)
def get_records() -> ApiMessage:
    return ApiMessage(ok=True, message="ok", data={"items": list_records()})


@router.post("/records", response_model=ApiMessage)
def post_record(payload: RecordCreateRequest) -> ApiMessage:
    ok, message, data = create_record(payload.model_dump())
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return ApiMessage(ok=True, message=message, data=data)
