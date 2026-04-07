import mongoose from 'mongoose';

export default async function handler(req, res) {
  try {
    const dbState = mongoose.connection.readyState;

    if (dbState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
      });
    }

    return res.status(200).json({
      status: 'degraded',
      database: `state:${dbState}`,
    });
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      message: error.message,
    });
  }
}
