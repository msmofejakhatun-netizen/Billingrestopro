module.exports = {
  apps: [
    {
      name: "restopro-api",
      script: "./dist/server.cjs",
      instances: "max",            // Match CPU core density
      exec_mode: "cluster",        // Clustered high speed load balancing
      watch: false,
      max_memory_restart: "1g",    // Memory limit gate
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        BOOT_API: "true",
        BOOT_WORKER: "false",
        MONGO_AUTO_INDEX: "false"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/pm2-api-err.log",
      out_file: "./logs/pm2-api-out.log",
      combine_logs: true,
      merge_logs: true,
      restart_delay: 2000,
      max_restarts: 10
    },
    {
      name: "restopro-worker",
      script: "./dist/server.cjs",
      instances: 2,                // Scale workers separately
      exec_mode: "fork",           // Fork mode is optimal for stateful job processors
      watch: false,
      max_memory_restart: "1.5g",  // Higher allocation threshold allowed for intense reports
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        BOOT_API: "false",
        BOOT_WORKER: "true"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/pm2-worker-err.log",
      out_file: "./logs/pm2-worker-out.log",
      combine_logs: true,
      merge_logs: true,
      restart_delay: 5000,
      max_restarts: 5
    }
  ]
};
