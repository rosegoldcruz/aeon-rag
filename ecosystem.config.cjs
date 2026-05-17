"use strict";

module.exports = {
  apps: [
    {
      name: "aeonops",
      cwd: "/home/aeon-rag",
      script: "pnpm",
      args: "start",
      autorestart: true,
      min_uptime: "20s",
      max_restarts: 50,
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 10000,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
    {
      name: "aeonops-watchdog",
      cwd: "/home/aeon-rag",
      script: "bash",
      args: "scripts/self-heal-loop.sh",
      autorestart: true,
      min_uptime: "5s",
      max_restarts: 50,
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        AEON_HEALTH_URL: "http://127.0.0.1:3000/api/health",
        SELF_HEAL_INTERVAL_SECONDS: "30",
      },
    },
  ],
};
