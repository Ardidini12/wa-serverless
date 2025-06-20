const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set');
  process.exit(1);
}

// Session schema
const sessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

async function cleanupDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB Atlas');
    
    const Session = mongoose.model('Session', sessionSchema);
    
    // Remove all old sessions
    console.log('Cleaning up old sessions...');
    const result = await Session.deleteMany({});
    console.log(`Removed ${result.deletedCount} old session(s)`);
    
    console.log('Database cleanup completed!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

cleanupDatabase(); 