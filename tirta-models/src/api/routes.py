from typing import Optional, List, Dict
from fastapi import APIRouter, File, HTTPException, Request, UploadFile, Query
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import json

from src.core.visual_analyzer import WEIGHTS

router = APIRouter()


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
    return {"status": "ok", "models_loaded": request.app.state.analyzer is not None}


@router.post("/models/visual/analyze")
async def analyze(request: Request, files: List[UploadFile] = File(...)):
    for f in files:
        if not f.content_type or not f.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"{f.filename} is not an image")

    analyzer = request.app.state.analyzer
    results  = []
    for f in files:
        image_bytes = await f.read()
        results.append(analyzer.analyze(image_bytes))

    if len(results) == 1:
        return {"aggregate": results[0], "per_photo": results}

    return {"aggregate": aggregate(results), "per_photo": results}


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
 
