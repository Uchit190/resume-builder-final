require('dotenv').config();

const app = require('./src/app');
const { pingDatabase } = require('./src/config/mysql');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  await pingDatabase();

  app.listen(PORT, HOST, () => {
    console.log(`ResumeForge API running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start ResumeForge API:', error.message);
  process.exit(1);
});
