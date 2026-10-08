# Personal Hardware Agent (Johnwick)

FastAPI + Next.js application that integrates Gemini AI, Ollama local LLMs, libgpiod-based Raspberry Pi GPIO controls, YOLO object detection, and realtime two-way voice conversations for hardware automation.

## Quick Start

### 1. Backend Setup
```bash
cd backend
uv sync
uv run fastapi run
```

### 2. Frontend Setup
```bash
cd ui
bun install
bun run dev
```

## Features
- Realtime silent background listening with 2.0s silence VAD detection and dynamic noise filtering.
- Wake words: "Hello Johnwick", "Hey Johnwick", "Johnwick", "Hello John".
- Direct hardware automation for Traffic Lights (GPIO 27, 22, 23) and Relay Lamp (GPIO 17).
- Instant barge-in interruption capability.
