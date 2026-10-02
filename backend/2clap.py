import sys
import time
import json
import urllib.request
import urllib.error
import numpy as np
import sounddevice as sd

# Backend API configuration
BACKEND_URL = "http://127.0.0.1:8000/api/led/lamp/toggle"
STATUS_URL = "http://127.0.0.1:8000/api/led"

# ==========================================
# 1. ACOUSTIC DOUBLE-CLAP CONFIGURATION
# ==========================================
SAMPLE_RATE = 16000
BLOCK_SIZE = 800  # 50ms per audio chunk (20 updates/second)

MIN_CLAP_INTERVAL = 0.12       # 120ms debounce (ignores echo of the 1st clap)
MAX_CLAP_INTERVAL = 0.85       # 850ms window for natural double claps
THRESHOLD_DEFAULT = 0.15       # Minimum amplitude spike threshold
COOLDOWN_AFTER_TRIGGER = 0.6    # 600ms cooldown after successful 2-clap toggle

last_clap_time = 0.0
last_trigger_time = 0.0
background_noise = 0.02


def request_lamp_toggle():
    """
    Sends an HTTP POST request to the backend toggle lamp endpoint.
    This ensures hardware relay toggling and real-time WebSocket broadcast to the UI.
    """
    try:
        req = urllib.request.Request(
            BACKEND_URL,
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=1.0) as response:
            if response.status == 200:
                res_data = json.loads(response.read().decode("utf-8"))
                new_state = res_data.get("state", "TOGGLED")
                msg = res_data.get("speechText", f"Lamp is now {new_state}")
                print(f"💡 [HTTP Backend Response] {msg} (WebSocket Synced to UI)")
                return new_state
            else:
                print(f"⚠️ [Backend Error] Status {response.status}")
    except urllib.error.URLError as err:
        print(f"❌ [Backend Offline] Could not reach {BACKEND_URL} ({err.reason}). Make sure FastAPI backend is running on port 8000.")
    except Exception as e:
        print(f"❌ [Request Failed] {e}")
    return None


def get_current_backend_status():
    """Fetch initial status from backend on startup."""
    try:
        req = urllib.request.Request(STATUS_URL, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=1.0) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                return data.get("states", {}).get("lamp", "UNKNOWN")
    except Exception:
        return "Backend Offline"
    return "UNKNOWN"


def audio_callback(indata, frames, time_info, status):
    global last_clap_time, last_trigger_time, background_noise

    audio = indata[:, 0]
    peak = float(np.max(np.abs(audio)))
    rms = float(np.sqrt(np.mean(audio**2)))
    now = time.time()

    # Track dynamic background noise level
    background_noise = 0.95 * background_noise + 0.05 * rms
    dynamic_threshold = max(THRESHOLD_DEFAULT, background_noise * 3.5)

    # In cooldown period after triggering
    if now - last_trigger_time < COOLDOWN_AFTER_TRIGGER:
        return

    # Check for sharp percussive impulse (high Peak-to-RMS crest factor)
    crest_factor = peak / (rms + 1e-6)
    is_impulse = peak > dynamic_threshold and crest_factor > 3.0

    if is_impulse:
        time_since_last_clap = now - last_clap_time

        # Check if 2nd clap occurred within the natural double-clap window
        if MIN_CLAP_INTERVAL <= time_since_last_clap <= MAX_CLAP_INTERVAL:
            print(f"\n👏 👏 >>> 2 CLAPS DETECTED! <<< (Interval: {time_since_last_clap * 1000:.0f}ms | Peak: {peak:.2f})")
            last_trigger_time = now
            last_clap_time = 0.0

            # Request backend to toggle lamp
            request_lamp_toggle()
            print()

        # New 1st clap detected
        elif time_since_last_clap > MAX_CLAP_INTERVAL:
            print(f"👉 [Clap 1/2] (Peak: {peak:.2f}) -> clap again quickly to toggle lamp...")
            last_clap_time = now


# ==========================================
# 2. MAIN EXECUTION
# ==========================================
initial_lamp = get_current_backend_status()

print("=" * 65)
print("  ⚡ ACOUSTIC DOUBLE-CLAP CONTROLLER (HTTP REQUEST MODE)")
print("=" * 65)
print(f"• Target Endpoint    : POST {BACKEND_URL}")
print(f"• Current Lamp State : {initial_lamp}")
print("• Natural Rhythm     : Clap twice quickly (120ms - 850ms apart)")
print("• Live Sync          : Toggles Relay on backend & syncs UI via WebSocket")
print("• Press Ctrl+C to stop")
print("=" * 65)
print("\nListening for 👏 👏 double claps...\n")

try:
    with sd.InputStream(
        channels=1,
        samplerate=SAMPLE_RATE,
        blocksize=BLOCK_SIZE,
        dtype="float32",
        callback=audio_callback,
    ):
        while True:
            time.sleep(0.1)

except KeyboardInterrupt:
    print("\n👋 Stopped double-clap detector.")
    sys.exit(0)
