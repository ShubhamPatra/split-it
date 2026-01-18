import mongoose from 'mongoose';

// Debug log helper (lazy loaded)
const logDbEvent = async (event, data = {}) => {
  if (process.env.DEBUG_ENABLED === 'true') {
    try {
      const { logDatabaseEvent } = await import('../internal/debug/logCollector.js');
      logDatabaseEvent(event, data);
    } catch (e) {
      // Debug portal not available, ignore
    }
  }
};

const connectDB = async () => {
  const options = {
    maxPoolSize: 10,           // Connection pool size
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,                 // Use IPv4
    retryWrites: true,
    retryReads: true,
    maxIdleTimeMS: 30000,
  };
  
  // Retry logic with exponential backoff
  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, options);
      console.log(`MongoDB Connected: ${mongoose.connection.host}`);
      logDbEvent('connected', { host: mongoose.connection.host });
      break;
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      console.warn(`MongoDB connection attempt failed. Retries left: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, 5000 * (6 - retries)));
    }
  }
  
  // Connection event handlers
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
    logDbEvent('error', { error: err.message });
  });
  
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Attempting to reconnect...');
    logDbEvent('disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
    logDbEvent('reconnected', { host: mongoose.connection.host });
  });
};

export default connectDB;
