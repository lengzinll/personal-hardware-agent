FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# 1. System packages with apt cache mount
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgpiod-dev \
    libgpiod3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 2. Python dependencies with uv cache mount (cached until pyproject.toml / uv.lock change)
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# 3. Application source code (changes frequently)
COPY . .

# 4. Sync root project package metadata
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# 5. Persistent data directory
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uv", "run", "fastapi", "run"]
