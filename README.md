# Personal Hardware Agent (AURA)

AI-powered voice & hardware agent with real-time GPIO control, LED/lamp automation, acoustic clap detection, and YOLO presence monitoring.

---

## 🚀 Running with PM2 (Host / Bare Metal)

### 1. Prerequisites
Ensure `pm2`, `uv`, and `bun` are installed:
```bash
bun add -g pm2 # or npm install -g pm2
```

### 2. Build Frontend
```bash
cd ui && bun run build && cd ..
```

### 3. Start Services with PM2
```bash
pm2 start ecosystem.config.cjs
```

### 4. Manage PM2 Processes
```bash
pm2 status          # Check service status
pm2 logs            # View live logs
pm2 restart all     # Restart all services
pm2 stop all        # Stop all services
pm2 save            # Save PM2 process list
pm2 startup         # Configure auto-start on boot
```

---

## 🐳 Running with Docker Compose

### 1. Configure Environment
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

### 2. Build and Start Services
```bash
docker compose up -d --build
```

### 3. Access Services
- **Web UI**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Docs & REST API**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **WebSocket Feed**: `ws://localhost:8000/ws/led`

### 4. Stop Services
```bash
docker compose down
```

---

## 🛠 Hardware GPIO Access on Raspberry Pi / Linux

When running inside Docker on actual hardware with GPIO pins (e.g., Raspberry Pi):

1. Uncomment the device mapping or privileged flags in [`docker-compose.yml`](docker-compose.yml):
```yaml
    privileged: true
    devices:
      - /dev/gpiochip0:/dev/gpiochip0
```
2. Restart the containers:
```bash
docker compose up -d
```
*(Note: If no GPIO chip is present, the backend automatically runs in simulated mode.)*
