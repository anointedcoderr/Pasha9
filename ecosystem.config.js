// Built by Anointed Coder.
// PM2 ecosystem for the Pasha9 platform.
// Usage on the VPS:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup systemd  (then run the printed command)

module.exports = {
  apps: [
    {
      name: 'pasha9-web',
      cwd: '/var/www/pasha9/app/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      out_file: '/var/log/pasha9/web.out.log',
      error_file: '/var/log/pasha9/web.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
