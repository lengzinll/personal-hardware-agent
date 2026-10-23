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
from services.whisper_service import transcribe_audio_bytes, get_whisper_status

router = APIRouter(prefix="/api/realtime", tags=["Realtime"])

RECORDINGS_DIR = Path(__file__).resolve().parent.parent / "recordings"
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/status")
def get_realtime_status():
    """Returns realtime service status, recording stats, and Whisper diagnostics."""
    count = len(list(RECORDINGS_DIR.glob("*.wav")))
    return {
        "status": "online",
        "wakeWords": ["hello johnwick", "hey johnwick", "johnwick", "hello john", "hey john", "john"],
        "recordingsDirectory": str(RECORDINGS_DIR),
        "totalRecordings": count,
        "nativeAudioSupported": True,
        "whisperKhmer": get_whisper_status(),
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
    sttEngine: Optional[str] = Form("browser"),
):
    """
    Receives recorded WAV audio from browser, processes via chosen STT engine
    (Browser Web Speech or Khmer Whisper CT2 on CUDA), and executes hardware tools.
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

        user_api_key = (apiKey or "").strip() or ((GEMINI_API_KEY or "").strip())
        user_transcript = (transcript or "").strip()
        selected_ollama_model = ollamaModel or OLLAMA_MODEL
        whisper_latency_ms: Optional[float] = None

        # Scenario 1: Khmer Whisper STT requested OR no transcript provided and not pure gemini
        if sttEngine == "whisper_khmer" or (not user_transcript and engineMode != "gemini_audio"):
            try:
                add_log("whisper_stt", f"Transcribing audio with PhanithLIM/whisper-small-khmer-ct2 ({filename})...")
                stt_res = transcribe_audio_bytes(audio_bytes, file_ext=".wav", language="km")
                if stt_res.get("text"):
                    user_transcript = stt_res["text"].strip()
                    whisper_latency_ms = stt_res.get("latency_ms")
                    add_log("whisper_stt", f'Transcribed in {whisper_latency_ms}ms: "{user_transcript}"')
            except Exception as w_err:
                add_log("whisper_stt_error", f"Whisper transcription failed: {w_err}")
                print(f"[Whisper STT Error] {w_err}")

        # Scenario 2: Transcript is available (from Browser Web Speech OR Whisper CT2)
        if user_transcript:
            add_log("realtime_command", f'Processing transcript: "{user_transcript}"')

            # Aircraft-grade fast path: check local verified execution first (includes Khmer commands)
            local_match = parse_local_led_command(user_transcript)
            if local_match:
                res_data = local_match["result"]
                return {
                    "success": res_data.get("success", True),
                    "command": user_transcript,
                    "response": res_data.get("message", "Command verified and executed."),
                    "actionTaken": local_match["action"],
                    "payload": res_data,
                    "audioFile": filename,
                    "transcript": user_transcript,
                    "sttEngine": "whisper_khmer" if whisper_latency_ms else "browser",
                    "sttLatencyMs": whisper_latency_ms,
                    "model": "Local Hardware Engine (Verified)",
                    "timestamp": datetime.now(UTC).isoformat(),
                }

            # Direct Ollama Mode
            if engineMode == "ollama":
                try:
                    result = await process_ollama_command(
                        user_transcript,
                        options={"model": selected_ollama_model, "history": parsed_history},
                    )
                    result["audioFile"] = filename
                    result["transcript"] = user_transcript
                    result["sttEngine"] = "whisper_khmer" if whisper_latency_ms else "browser"
                    result["sttLatencyMs"] = whisper_latency_ms
                    return result
                except Exception as e:
                    return {
                        "success": False,
                        "error": f"Ollama local execution failed: {str(e)}",
                        "audioFile": filename,
                        "transcript": user_transcript,
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
                result["sttEngine"] = "whisper_khmer" if whisper_latency_ms else "browser"
                result["sttLatencyMs"] = whisper_latency_ms
                return result
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Gemini command execution failed: {str(e)}",
                    "audioFile": filename,
                    "transcript": user_transcript,
                }

        # Scenario 3: If Whisper was requested but no words recognized, return friendly feedback
        if sttEngine == "whisper_khmer":
            return {
                "success": False,
                "error": "មិនបានឮសំឡេងច្បាស់ទេ សូមព្យាយាមនិយាយម្ដងទៀត (No clear speech detected)",
                "response": "ខ្ញុំមិនបានឮច្បាស់ទេ សូមសាកល្បងនិយាយបញ្ជាម្ដងទៀត។",
                "audioFile": filename,
                "transcript": "",
                "sttEngine": "whisper_khmer",
                "sttLatencyMs": whisper_latency_ms,
            }

        # Scenario 4: Native Gemini Multimodal Audio Processing Fallback
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
