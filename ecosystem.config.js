module.exports = {
  apps: [
    {
      name: "johnwickjohnwick-backend",
      cwd: "./backend",
      script: "uv",
      args: "run fastapi run --host 0.0.0.0 --port 8000",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      restart_delay: 2000,
      max_restarts: 10,
    },
    {
      name: "johnwickjohnwick-frontend",
      cwd: "./ui",
      script: "bun",
      args: "run start",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      restart_delay: 2000,
      max_restarts: 10,
    },
  ],
};
