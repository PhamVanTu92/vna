// PM2 process manager config — dùng cho production Ubuntu server
// Khởi động: pm2 start ecosystem.config.cjs
// Reload zero-downtime: pm2 reload vna-nrt-app
// Xem log: pm2 logs vna-nrt-app

module.exports = {
  apps: [
    {
      name: 'vna-nrt-app',
      script: './server/dist/index.js',

      // Số worker = số CPU core (để Node.js tận dụng đa nhân)
      // Đổi thành 1 nếu muốn single-process (đơn giản hơn khi debug)
      instances: 1,
      exec_mode: 'fork',

      // Tự restart khi crash
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      // Environment production
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },

      // Log
      out_file:   './logs/app-out.log',
      error_file: './logs/app-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000
    }
  ]
};
