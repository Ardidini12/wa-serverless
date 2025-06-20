const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set');
  process.exit(1);
}

async function checkGridFS() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!');

    const db = mongoose.connection.db;
    
    // Check GridFS files collection
    console.log('\n=== GridFS Files (sessions.files) ===');
    const filesCollection = db.collection('sessions.files');
    const files = await filesCollection.find({}).toArray();
    
    if (files.length === 0) {
      console.log('No files found in GridFS');
    } else {
      files.forEach((file, index) => {
        console.log(`File ${index + 1}:`);
        console.log(`  - ID: ${file._id}`);
        console.log(`  - Filename: ${file.filename}`);
        console.log(`  - Size: ${file.length} bytes (${(file.length / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`  - Upload Date: ${file.uploadDate}`);
        console.log(`  - Metadata:`, file.metadata);
        console.log('');
      });
    }

    // Check GridFS chunks collection
    console.log('=== GridFS Chunks (sessions.chunks) ===');
    const chunksCollection = db.collection('sessions.chunks');
    const chunks = await chunksCollection.find({}).toArray();
    
    if (chunks.length === 0) {
      console.log('No chunks found in GridFS');
    } else {
      console.log(`Found ${chunks.length} chunks`);
      
      // Group chunks by file
      const chunksByFile = {};
      chunks.forEach(chunk => {
        if (!chunksByFile[chunk.files_id]) {
          chunksByFile[chunk.files_id] = [];
        }
        chunksByFile[chunk.files_id].push(chunk);
      });
      
      Object.keys(chunksByFile).forEach(fileId => {
        const fileChunks = chunksByFile[fileId];
        console.log(`  File ID ${fileId}: ${fileChunks.length} chunks`);
        fileChunks.forEach(chunk => {
          console.log(`    - Chunk ${chunk.n}: ${chunk.data.buffer ? chunk.data.buffer.length : chunk.data.length} bytes`);
        });
      });
    }

    // Check session metadata collection
    console.log('\n=== Session Metadata (sessions collection) ===');
    const sessionsCollection = db.collection('sessions');
    const sessions = await sessionsCollection.find({}).toArray();
    
    if (sessions.length === 0) {
      console.log('No session metadata found');
    } else {
      sessions.forEach((session, index) => {
        console.log(`Session ${index + 1}:`);
        console.log(`  - ID: ${session.id}`);
        console.log(`  - GridFS File ID: ${session.gridfsFileId}`);
        console.log(`  - File Size: ${session.fileSize} bytes (${(session.fileSize / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`  - Created: ${session.createdAt}`);
        console.log(`  - Updated: ${session.updatedAt}`);
        console.log('');
      });
    }

    // Summary
    console.log('=== SUMMARY ===');
    console.log(`GridFS Files: ${files.length}`);
    console.log(`GridFS Chunks: ${chunks.length}`);
    console.log(`Session Metadata Records: ${sessions.length}`);
    
    if (files.length > 0) {
      const totalSize = files.reduce((sum, file) => sum + file.length, 0);
      console.log(`Total Storage Used: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    }

  } catch (error) {
    console.error('Error checking GridFS:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB');
  }
}

checkGridFS(); 