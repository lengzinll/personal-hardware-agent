from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from services.whisper_service import (
    transcribe_audio_bytes,
    get_whisper_status,
    get_whisper_model,
)

router = APIRouter(prefix="/api/stt", tags=["Speech-To-Text"])


@router.get("/status")
def status_endpoint():
    """Returns local Khmer Whisper model status and CUDA diagnostics."""
    return {
        "success": True,
        "engine": "PhanithLIM/whisper-small-khmer-ct2",
        "details": get_whisper_status(),
    }


@router.post("/warmup")
def warmup_endpoint():
    """Warms up the Whisper CT2 model into GPU VRAM for instant sub-200ms requests."""
    try:
        model = get_whisper_model()
        return {
            "success": True,
            "message": "Whisper model pre-warmed in memory",
            "details": get_whisper_status(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Warmup failed: {str(e)}")


@router.post("/transcribe")
async def transcribe_endpoint(
    file: UploadFile = File(...),
    language: Optional[str] = Form("km"),
):
    """
    Transcribes uploaded audio (WAV, WEBM, OGG) using the local
    PhanithLIM/whisper-small-khmer-ct2 model on CUDA.
    """
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file")

        ext = ".wav"
        if file.filename:
            lower_name = file.filename.lower()
            if lower_name.endswith(".webm"):
                ext = ".webm"
            elif lower_name.endswith(".ogg"):
                ext = ".ogg"
            elif lower_name.endswith(".mp3"):
                ext = ".mp3"

        result = transcribe_audio_bytes(audio_bytes, file_ext=ext, language=language or "km")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")
