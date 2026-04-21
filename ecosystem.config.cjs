module.exports = {
  apps: [
    {
      name: 'bluffy-app',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        // Ensure you define MONGO_URI in your VPS .env or directly here
      }
    }
  ]
};
