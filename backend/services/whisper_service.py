import io
import os
import time
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any

_whisper_model = None
_model_name = "PhanithLIM/whisper-small-khmer-ct2"
_device = None
_compute_type = None
_model_load_time: Optional[float] = None
_is_loading = False


def get_whisper_model():
    """
    Singleton lazy-loader for PhanithLIM/whisper-small-khmer-ct2.
    Uses CUDA (float16) on GPU if available for ultra-fast ~200ms inference,
    with safe fallback to CPU (int8) if CUDA is unavailable.
    """
    global _whisper_model, _device, _compute_type, _model_load_time, _is_loading

    if _whisper_model is not None:
        return _whisper_model

    if _is_loading:
        # Avoid concurrent duplicate loads
        while _is_loading and _whisper_model is None:
            time.sleep(0.05)
        if _whisper_model is not None:
            return _whisper_model

    _is_loading = True
    start_t = time.time()
    try:
        import ctranslate2
        from faster_whisper import WhisperModel

        has_cuda = False
        try:
            has_cuda = ctranslate2.get_cuda_device_count() > 0
        except Exception:
            has_cuda = False

        if has_cuda:
            _device = "cuda"
            _compute_type = "float16"
            print(f"[Whisper STT] Loading {_model_name} on CUDA (float16)...")
        else:
            _device = "cpu"
            _compute_type = "int8"
            print(f"[Whisper STT] CUDA not found. Loading {_model_name} on CPU (int8)...")

        _whisper_model = WhisperModel(
            _model_name,
            device=_device,
            compute_type=_compute_type,
            cpu_threads=4,
        )
        _model_load_time = round((time.time() - start_t) * 1000, 1)
        print(f"[Whisper STT] Model ready in {_model_load_time}ms on {_device.upper()}!")
        return _whisper_model
    finally:
        _is_loading = False


def transcribe_audio_file(file_path: str | Path, language: str = "km") -> Dict[str, Any]:
    """
    Transcribes an audio file on disk (WAV/WEBM/OGG/MP3).
    Returns text, language, confidence, and inference latency in ms.
    """
    model = get_whisper_model()
    start_t = time.time()

    segments, info = model.transcribe(
        str(file_path),
        language=language,
        beam_size=3,
        best_of=3,
        temperature=0.0,
        condition_on_previous_text=False,
    )

    full_text = " ".join(s.text.strip() for s in segments if s.text).strip()
    latency_ms = round((time.time() - start_t) * 1000, 1)

    return {
        "success": True,
        "text": full_text,
        "language": info.language if info else language,
        "language_probability": round(info.language_probability, 3) if info else 1.0,
        "latency_ms": latency_ms,
        "device": _device,
        "model": _model_name,
    }


def transcribe_audio_bytes(audio_bytes: bytes, file_ext: str = ".wav", language: str = "km") -> Dict[str, Any]:
    """
    Writes raw audio bytes to a temporary file and transcribes it.
    """
    with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        return transcribe_audio_file(tmp_path, language=language)
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass


def get_whisper_status() -> Dict[str, Any]:
    """Returns diagnostics and readiness of the local Khmer Whisper CT2 engine."""
    import ctranslate2
    cuda_count = 0
    try:
        cuda_count = ctranslate2.get_cuda_device_count()
    except Exception:
        pass

    return {
        "model": _model_name,
        "loaded": _whisper_model is not None,
        "device": _device or ("cuda" if cuda_count > 0 else "cpu"),
        "compute_type": _compute_type or ("float16" if cuda_count > 0 else "int8"),
        "cuda_devices": cuda_count,
        "load_time_ms": _model_load_time,
    }
