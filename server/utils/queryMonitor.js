import mongoose from 'mongoose';
import { dbQueryDuration } from '../config/metrics.js';

export const setupQueryMonitoring = () => {
  mongoose.set('debug', (collectionName, method, query, doc) => {
    const end = dbQueryDuration.startTimer();
    end({ operation: method, collection: collectionName });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${collectionName}.${method}`, JSON.stringify(query));
    }
  });
};
