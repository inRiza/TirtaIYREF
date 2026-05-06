from typing import Optional, List, Dict
import os
from fastapi import APIRouter, File, HTTPException, Request, UploadFile, Query
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import json

import cloudinary
import cloudinary.uploader
import cloudinary.api

from src.core.visual_analyzer import WEIGHTS

router = APIRouter()

def get_analyzer(request: Request):
    if not hasattr(request.app.state, "analyzer"):
        from src.core.visual_analyzer import VisualAnalyzer
        request.app.state.analyzer = VisualAnalyzer()
    return request.app.state.analyzer


def upload_mask_bytes(mask_bytes: bytes, folder: str) -> str:
    result: Dict[str, str] = {}
    error_holder: Dict[str, Exception] = {}

    def _callback(error, res):
        if error or not res:
            error_holder["error"] = error or Exception("Upload failed")
            return
        result["url"] = res.get("secure_url")

    stream = cloudinary.uploader.upload_stream(
        {
            "folder": folder,
            "resource_type": "image",
            "format": "png",
        },
        _callback,
    )
    stream.end(mask_bytes)

    if "error" in error_holder:
        raise error_holder["error"]

    return result.get("url", "")


def aggregate(results: List[Dict]) -> Dict:
    veg    = sum(r["vegetation_ratio"]  for r in results) / len(results)
    imperv = sum(r["impervious_ratio"]  for r in results) / len(results)
    drain  = sum(r["drainage_ratio"]    for r in results) / len(results)

    raw = imperv * WEIGHTS["impervious"] - veg * WEIGHTS["vegetation"] - drain * WEIGHTS["drainage"]
    fri = float(max(0.0, min(1.0, raw / 0.5)))

    if fri < 0.3:
        risk = "LOW"
    elif fri < 0.6:
        risk = "MEDIUM"
    else:
        risk = "HIGH"

    return {
        "fri_score":        round(fri,    4),
        "risk_level":       risk,
        "vegetation_ratio": round(veg,    4),
        "impervious_ratio": round(imperv, 4),
        "drainage_ratio":   round(drain,  4),
    }


@router.get("/models/visual/health")
def health(request: Request):
    return {
        "status": "ok",
        "models_loaded": hasattr(request.app.state, "analyzer")
    }


@router.post("/models/visual/analyze")
async def analyze(request: Request, files: List[UploadFile] = File(...)):
    for f in files:
        if not f.content_type or not f.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"{f.filename} is not an image")

    analyzer = get_analyzer(request)  # ✅ pakai lazy load
    results  = []

    for f in files:
        image_bytes = await f.read()
        results.append(analyzer.analyze(image_bytes))

    if len(results) == 1:
        return {"aggregate": results[0], "per_photo": results}

    return {"aggregate": aggregate(results), "per_photo": results}


@router.post("/models/visual/segment")
async def segment(request: Request, files: List[UploadFile] = File(...)):
    if not os.getenv("CLOUDINARY_URL"):
        raise HTTPException(status_code=500, detail="CLOUDINARY_URL is not set")

    for f in files:
        if not f.content_type or not f.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"{f.filename} is not an image")

    analyzer = get_analyzer(request)  # ✅ pakai lazy load
    metrics: List[Dict] = []
    per_photo: List[Dict] = []

    for f in files:
        image_bytes = await f.read()
        analysis, mask_png = analyzer.analyze_with_mask(image_bytes)
        mask_url = upload_mask_bytes(mask_png, "tirta/segments")
        metrics.append(analysis)
        per_photo.append({
            **analysis,
            "mask_url": mask_url,
        })

    if len(metrics) == 1:
        return {"aggregate": metrics[0], "per_photo": per_photo}

    return {"aggregate": aggregate(metrics), "per_photo": per_photo}


def _get_forecast_path() -> Path:
    base = Path(__file__).resolve().parents[2]
    return base / "flood_history" / "output" / "exports" / "forecast_output.json"


@router.get("/models/forecast")
def get_forecasts(limit: Optional[int] = Query(None, gt=0)):
    p = _get_forecast_path()
    if not p.exists():
        raise HTTPException(status_code=404, detail="forecast_output.json not found")

    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if limit:
        data_copy = dict(data)
        data_copy["data"] = data_copy.get("data", [])[:limit]
        data_copy["record_count"] = len(data_copy["data"])
        return JSONResponse(data_copy)

    return JSONResponse(data)


@router.get("/models/forecast/download")
def download_forecast():
    p = _get_forecast_path()
    if not p.exists():
        raise HTTPException(status_code=404, detail="forecast_output.json not found")
    return FileResponse(str(p), filename=p.name, media_type="application/json")