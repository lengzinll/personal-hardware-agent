import os
import json
import time
from pathlib import Path
from datetime import datetime, UTC
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from config import GEMINI_API_KEY, OLLAMA_MODEL
from database import add_log
from routers.agent import parse_local_led_command
from services.gemini_service import process_gemini_command, process_gemini_audio_command
from services.ollama_service import process_ollama_command

router = APIRouter(prefix="/api/realtime", tags=["Realtime"])

RECORDINGS_DIR = Path(__file__).resolve().parent.parent / "recordings"
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/status")
def get_realtime_status():
    """Returns realtime service status and recording stats."""
    count = len(list(RECORDINGS_DIR.glob("*.wav")))
    return {
        "status": "online",
        "wakeWords": ["hello johnwick", "hey johnwick", "johnwick", "hello john", "hey john", "john"],
        "recordingsDirectory": str(RECORDINGS_DIR),
        "totalRecordings": count,
        "nativeAudioSupported": True,
    }


@router.post("/audio")
@router.post("/audio-command")
async def handle_realtime_audio(
    file: UploadFile = File(...),
    transcript: Optional[str] = Form(None),
    engineMode: Optional[str] = Form("gemini"),
    ollamaModel: Optional[str] = Form(None),
    modelName: Optional[str] = Form(None),
    apiKey: Optional[str] = Form(None),
    history: Optional[str] = Form(None),
):
    """
    Receives recorded WAV audio from the browser, stores the .wav file locally,
    and processes the voice command using native audio Gemini or transcribed text.
    """
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file received")

        # Generate unique filename with timestamp
        now_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        millis = int(time.time() * 1000) % 1000
        filename = f"rec_{now_str}_{millis:03d}.wav"
        save_path = RECORDINGS_DIR / filename

        # Write WAV file to disk
        with open(save_path, "wb") as f:
            f.write(audio_bytes)

        add_log("realtime_audio", f"Saved audio wave file: {filename} ({len(audio_bytes)} bytes)")

        # Parse conversational history if supplied
        parsed_history: Optional[List[Dict[str, Any]]] = None
        if history:
            try:
                parsed_history = json.loads(history)
            except Exception:
                parsed_history = None

        user_api_key = (apiKey or "").strip() or GEMINI_API_KEY.strip()
        user_transcript = (transcript or "").strip()
        selected_ollama_model = ollamaModel or OLLAMA_MODEL

        # Scenario 1: Transcript is provided (e.g. from Browser Web Speech API)
        if user_transcript:
            add_log("realtime_command", f'Processing transcript: "{user_transcript}"')

            # Direct Ollama Mode
            if engineMode == "ollama":
                try:
                    result = await process_ollama_command(
                        user_transcript,
                        options={"model": selected_ollama_model, "history": parsed_history},
                    )
                    result["audioFile"] = filename
                    result["transcript"] = user_transcript
                    return result
                except Exception as e:
                    return {
                        "success": False,
                        "error": f"Ollama local execution failed: {str(e)}",
                        "audioFile": filename,
                    }

            # Gemini Cloud Mode
            try:
                result = await process_gemini_command(
                    user_transcript,
                    api_key=user_api_key,
                    model_name=modelName,
                    history=parsed_history,
                )
                result["audioFile"] = filename
                result["transcript"] = user_transcript
                return result
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Gemini command execution failed: {str(e)}",
                    "audioFile": filename,
                }

        # Scenario 2: Native Audio Processing (Gemini Multimodal Audio Understanding)
        add_log("realtime_audio", f"Sending native WAV audio to Gemini Multimodal AI ({filename})...")
        try:
            result = await process_gemini_audio_command(
                audio_bytes=audio_bytes,
                api_key=user_api_key,
                model_name=modelName or "gemini-2.5-flash",
                history=parsed_history,
            )
            result["audioFile"] = filename
            return result
        except Exception as e:
            add_log("realtime_audio_error", f"Gemini native audio processing failed: {str(e)}")
            return {
                "success": False,
                "error": f"Gemini audio processing failed: {str(e)}",
                "audioFile": filename,
            }

    except HTTPException:
        raise
    except Exception as e:
        add_log("realtime_error", f"Unexpected error during realtime audio processing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
