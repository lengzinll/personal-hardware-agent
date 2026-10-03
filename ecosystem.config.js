module.exports = {
  apps: [
    {
      name: "aura-backend",
      cwd: "./backend",
      script: "uv",
      args: "run fastapi run",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      restart_delay: 2000,
      max_restarts: 10,
    },
    {
      name: "aura-frontend",
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
