"use strict";

module.exports = {
  apps: [
    {
      name: "aeonops",
      cwd: "/home/aeon-rag",
      script: "pnpm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
};
