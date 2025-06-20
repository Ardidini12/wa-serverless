const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = "mongodb+srv://eduardialidini:2n_yv_dYL_sQG-X@cluster0.ihk2hhk.mongodb.net/wadb?retryWrites=true&w=majority";

// Session schema
const sessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// File storage schema
const fileStorageSchema = new mongoose.Schema({
  path: { type: String, required: true },
  filename: { type: String, required: true },
  data: { type: Buffer, required: true },
  contentType: { type: String, default: 'application/octet-stream' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

async function checkDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB Atlas');
    
    const Session = mongoose.model('Session', sessionSchema);
    const FileStorage = mongoose.model('FileStorage', fileStorageSchema);
    
    // Get all sessions
    const sessions = await Session.find({});
    
    console.log('\n=== SESSION CONTENTS ===');
    console.log(`Found ${sessions.length} session(s) in database:\n`);
    
    sessions.forEach((session, index) => {
      console.log(`Session ${index + 1}:`);
      console.log(`  ID: ${session.id}`);
      console.log(`  Data type: ${typeof session.data}`);
      console.log(`  Data keys: ${typeof session.data === 'object' ? Object.keys(session.data) : 'N/A'}`);
      console.log(`  Created: ${session.createdAt}`);
      console.log(`  Updated: ${session.updatedAt}`);
      console.log(`  Full data:`, JSON.stringify(session.data, null, 2).substring(0, 500) + '...');
      console.log('---');
    });
    
    if (sessions.length === 0) {
      console.log('No sessions found in database.');
    }
    
    // Get all file storage entries
    const files = await FileStorage.find({});
    
    console.log('\n=== FILE STORAGE CONTENTS ===');
    console.log(`Found ${files.length} file(s) in database:\n`);
    
    // Group files by directory
    const filesByDir = {};
    files.forEach(file => {
      const dir = file.path.split('/')[0];
      if (!filesByDir[dir]) {
        filesByDir[dir] = [];
      }
      filesByDir[dir].push(file);
    });
    
    // Print files by directory
    Object.keys(filesByDir).forEach(dir => {
      console.log(`\nDirectory: ${dir}`);
      console.log(`  Files: ${filesByDir[dir].length}`);
      
      filesByDir[dir].forEach(file => {
        console.log(`  - ${file.path} (${file.data.length} bytes, updated: ${file.updatedAt})`);
      });
    });
    
    if (files.length === 0) {
      console.log('No files found in database.');
    }
    
    // Also check all collections in the database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n=== ALL COLLECTIONS ===');
    collections.forEach(collection => {
      console.log(`Collection: ${collection.name}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

checkDatabase(); 