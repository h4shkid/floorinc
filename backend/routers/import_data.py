import tempfile
from pathlib import Path
from fastapi import APIRouter, UploadFile, File
from database import sync_to_cloud
from models import ImportResponse
from services.csv_importer import import_inventory, import_sales

router = APIRouter(prefix="/api/import", tags=["import"])


@router.post("/inventory", response_model=ImportResponse)
async def upload_inventory(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    result = import_inventory(tmp_path)
    Path(tmp_path).unlink(missing_ok=True)
    sync_to_cloud()
    return ImportResponse(**result)


@router.post("/sales", response_model=ImportResponse)
async def upload_sales(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    result = import_sales(tmp_path)
    Path(tmp_path).unlink(missing_ok=True)
    sync_to_cloud()
    return ImportResponse(**result)
