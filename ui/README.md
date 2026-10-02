# AURA LED Hardware AI Agent

A fullstack Voice & Chat AI Copilot connected directly to a **FastAPI** backend and SQLite for LED light hardware control.

## 🚀 Architecture

- **Backend**: FastAPI (Python 3.12+) with Uvicorn, SQLite (WAL mode), Google GenAI SDK, and Ollama integration.
- **Frontend**: Next.js 16 (App Router, React 19, Tailwind CSS 4, Jotai, TanStack Query).
- **Features**:
  - 🎙️ Voice Input (Speech-to-Text / STT) & Audio Output (Text-to-Speech / TTS)
  - 💡 Direct & AI-driven LED Light Hardware Control (ON, OFF, TOGGLE, Status)
  - 🤖 Multi-Engine AI Support: Google Gemini Live/Flash Function Calling, Local Ollama Models, and Offline Regex Rules
  - 📊 Live State & Action Logs persisted to SQLite

---

## 🛠️ Getting Started

### 1. Install Dependencies

**Backend (Python virtual environment):**
```bash
uv venv .venv
uv pip install -r backend/requirements.txt
```

**Frontend:**
```bash
bun install
```

### 2. Run the Servers

**Terminal 1: Start FastAPI Backend (Port 8000)**
```bash
bun run dev:backend
# or: .venv/bin/uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2: Start Next.js Frontend (Port 3000)**
```bash
bun run dev
```

The Next.js frontend is configured with rewrites in [next.config.ts](file:///home/nsm/Desktop/project/personal-agent-task/next.config.ts) to automatically proxy `/api/*` requests to the FastAPI backend at `http://127.0.0.1:8000/api/*`.
