import mongoose from 'mongoose';

export default function handler(req, res) {
  const uptime = Math.floor(process.uptime());

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime,
    service: 'split-it-api',
    version: '1.0.0',
    database: mongoose.connection.readyState,
  });
}
