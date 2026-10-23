import os
import sys
import asyncio
from pathlib import Path

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from services.led_tool import control_leds, control_lamp
from routers import led, system, agent, websocket, tts, realtime, stt

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite database
    init_db()

    # Pre-warm Whisper Khmer model in background thread
    async def _preload_whisper():
        try:
            from services.whisper_service import get_whisper_model
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, get_whisper_model)
        except Exception as e:
            print(f"[Whisper Preload Notice] {e}")

    asyncio.create_task(_preload_whisper())

    yield

    # Shutdown: Turn off all lights and lamp before the API exits
    try:
        control_leds(color="all", action="OFF")
        control_lamp(action="OFF", force=True, source="manual")
        print("[Shutdown] All LEDs and lamp turned OFF.")
    except Exception as exc:
        print(f"[Shutdown] Failed to turn off all lights: {exc}")


app = FastAPI(
    title="Johnwick Personal Agent API",
    description="FastAPI backend for Johnwick AI Agent and LED Hardware Control",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(led.router)
app.include_router(system.router)
app.include_router(agent.router)
app.include_router(websocket.router)
app.include_router(tts.router)
app.include_router(realtime.router)
app.include_router(stt.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Johnwick LED Agent API",
        "docs": "/docs",
    }
