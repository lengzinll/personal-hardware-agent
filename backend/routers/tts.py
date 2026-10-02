import re
import io
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import edge_tts

router = APIRouter(prefix="/api/tts", tags=["TTS"])

DEFAULT_VOICE = "en-US-JennyNeural"

AVAILABLE_VOICES = [
    {"id": "en-US-JennyNeural", "name": "Jenny (Natural US Female)", "gender": "Female", "lang": "en-US"},
    {"id": "en-US-GuyNeural", "name": "Guy (Natural US Male)", "gender": "Male", "lang": "en-US"},
    {"id": "en-US-AriaNeural", "name": "Aria (Expressive US Female)", "gender": "Female", "lang": "en-US"},
    {"id": "en-GB-SoniaNeural", "name": "Sonia (British Female)", "gender": "Female", "lang": "en-GB"},
    {"id": "en-GB-RyanNeural", "name": "Ryan (British Male)", "gender": "Male", "lang": "en-GB"},
]

# Comprehensive Unicode Emoji & Pictograph regex pattern
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs (🛑, 💡, 🔴, 🟡, 🟢, ⚡, 📻, etc.)
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F700-\U0001F77F"  # alchemical symbols
    "\U0001F780-\U0001F7FF"  # geometric shapes extended
    "\U0001F800-\U0001F8FF"  # supplemental arrows
    "\U0001F900-\U0001F9FF"  # supplemental symbols and pictographs
    "\U0001FA00-\U0001FA6F"  # chess symbols
    "\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-A
    "\U00002702-\U000027B0"  # Dingbats (✅, ✨, ❌, etc.)
    "\U000024C2-\U0001F251"  # enclosed characters
    "\U00002600-\U000026FF"  # miscellaneous symbols (⚠️, ⚡, 🛑, etc.)
    "\U00002300-\U000023FF"  # misc technical
    "\U00002B00-\U00002BFF"  # misc symbols and arrows
    "\U0000FE00-\U0000FE0F"  # variation selectors
    "]+",
    flags=re.UNICODE,
)


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = DEFAULT_VOICE
    rate: Optional[str] = "+0%"
    pitch: Optional[str] = "+0Hz"


def clean_markdown_for_speech(text: str) -> str:
    """
    Strips markdown formatting, Unicode emojis, sign artifacts (e.g. 'stop sign', 'warning sign'),
    and normalizes state words so speech sounds fluent and natural.
    """
    clean = text

    # 1. Remove code blocks, inline code, and URLs
    clean = re.sub(r'```[\s\S]*?```', ' ', clean)
    clean = re.sub(r'`([^`]+)`', r'\1', clean)
    clean = re.sub(r'https?://\S+', ' ', clean)

    # 2. Format list and preset status lines into natural spoken sentences
    # e.g., "Stop (Red)" -> "Stop Red"
    clean = re.sub(r'(?i)\bStop\s*\((Red)\)', r'Stop light \1', clean)
    clean = re.sub(r'(?i)\bCaution\s*\((Yellow)\)', r'Caution light \1', clean)
    clean = re.sub(r'(?i)\bGo\s*\((Green)\)', r'Go light \1', clean)

    # Convert status list formats like "Red: OFF" or "Red: ON" into natural sentences
    clean = re.sub(r'(?i)\b(red|yellow|green|lamp)\s*:\s*OFF\b', r'\1 is off.', clean)
    clean = re.sub(r'(?i)\b(red|yellow|green|lamp)\s*:\s*ON\b', r'\1 is on.', clean)

    # 3. Strip all Unicode emojis before TTS processes them as CLDR descriptions (e.g., 'stop sign')
    clean = EMOJI_PATTERN.sub(' ', clean)

    # 4. Remove residual spoken sign artifacts if any remain in text
    clean = re.sub(r'(?i)\b(stop sign|warning sign|caution sign|active sign|high voltage sign|traffic light sign)\b', ' ', clean)

    # 5. Remove markdown headers, bold/italic symbols, and punctuation noise
    clean = re.sub(r'\*\*([^*]+)\*\*', r'\1', clean)
    clean = re.sub(r'\*([^*]+)\*', r'\1', clean)
    clean = re.sub(r'#+\s*', '', clean)
    clean = re.sub(r'[•\-\[\]\(\)\{\}\<\>\|\~\^\_\\]', ' ', clean)

    # 6. Normalize all-caps words to avoid spelling letter-by-letter
    word_replacements = {
        r'\bOFF\b': 'off',
        r'\bON\b': 'on',
        r'\bTOGGLE\b': 'toggle',
        r'\bSTATUS\b': 'status',
        r'\bLAMP\b': 'lamp',
        r'\bRED\b': 'red',
        r'\bYELLOW\b': 'yellow',
        r'\bGREEN\b': 'green',
        r'\bALL\b': 'all',
        r'\bGPIO\b': 'G P I O',
    }
    for pattern, replacement in word_replacements.items():
        clean = re.sub(pattern, replacement, clean)

    # 7. Normalize multiple whitespaces
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


async def generate_speech_stream(text: str, voice: str, rate: str = "+0%", pitch: str = "+0Hz"):
    clean_text = clean_markdown_for_speech(text)
    if not clean_text:
        return

    communicate = edge_tts.Communicate(clean_text, voice=voice, rate=rate, pitch=pitch)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            yield chunk["data"]


@router.get("/voices")
def get_voices():
    """Return available high-quality neural TTS voices."""
    return {"voices": AVAILABLE_VOICES, "default": DEFAULT_VOICE}


@router.post("")
async def synthesize_speech_post(req: TTSRequest):
    """Synthesize text to MP3 audio stream via POST."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    voice = req.voice or DEFAULT_VOICE
    rate = req.rate or "+0%"
    pitch = req.pitch or "+0Hz"

    return StreamingResponse(
        generate_speech_stream(req.text, voice=voice, rate=rate, pitch=pitch),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=speech.mp3",
            "Cache-Control": "no-cache",
        },
    )


@router.get("")
async def synthesize_speech_get(
    text: str = Query(..., description="Text to speak"),
    voice: Optional[str] = Query(DEFAULT_VOICE, description="Voice ID"),
    rate: Optional[str] = Query("+0%", description="Speaking rate, e.g. +10%"),
):
    """Synthesize text to MP3 audio stream via GET for direct audio elements."""
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    return StreamingResponse(
        generate_speech_stream(text, voice=voice or DEFAULT_VOICE, rate=rate or "+0%"),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=speech.mp3",
            "Cache-Control": "no-cache",
        },
    )
