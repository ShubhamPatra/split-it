import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Delete the orphaned settlements
    const result = await mongoose.connection.db.collection('settlements').deleteMany({
      _id: { 
        $in: [
          new mongoose.Types.ObjectId('6957d9b8e8a3b75ecc6a58f8'),
          new mongoose.Types.ObjectId('6957dab8e8a3b75ecc6a5942')
        ]
      }
    });
    
    console.log('Deleted', result.deletedCount, 'orphaned settlements');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanup();
