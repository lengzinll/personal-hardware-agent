import urllib.parse
import httpx
from fastapi import APIRouter, Response, HTTPException
from database import get_db_stats, get_logs
from services.ollama_service import get_ollama_models

router = APIRouter(prefix="/api", tags=["System"])

@router.get("/stats")
def read_stats():
    stats = get_db_stats()
    return {"success": True, "data": stats}

@router.get("/logs")
def read_logs(limit: int = 50):
    logs = get_logs(limit=limit)
    return {"success": True, "data": logs}

@router.get("/ollama/models")
async def read_ollama_models():
    models = await get_ollama_models()
    return {"success": True, "models": models}

@router.get("/tts")
async def text_to_speech(text: str = "Hello", lang: str = "en-uk"):
    clean_text = urllib.parse.quote(text[:200])
    tts_url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={clean_text}&tl={urllib.parse.quote(lang)}&client=gtx"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            res = await client.get(tts_url, headers=headers)
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=f"Google TTS error {res.status_code}")

            return Response(
                content=res.content,
                media_type="audio/mpeg",
                headers={"Cache-Control": "public, max-age=86400"},
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
