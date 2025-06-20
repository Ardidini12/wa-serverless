const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Session storage schema - stores compressed ZIP files using GridFS for large files
const sessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  gridfsFileId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Reference to GridFS file
  fileSize: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// MongoDB Store for RemoteAuth - implements the official RemoteAuth interface
class MongoStore {
  constructor(options = {}) {
    this.mongoose = options.mongoose || mongoose;
    
    // Prevent model overwrite error by checking if models already exist
    this.Session = this.mongoose.models.Session || 
                   this.mongoose.model('Session', sessionSchema);
    
    // Initialize GridFS bucket for large file storage
    this.bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
      bucketName: 'sessions'
    });
  }

  // Check if session exists in MongoDB
  async sessionExists(options) {
    try {
      const sessionId = (options && options.session) ? options.session : 'default';
      console.log(`[MongoStore] Checking if session ${sessionId} exists...`);
      
      const session = await this.Session.findOne({ id: sessionId });
      const exists = !!session;
      
      console.log(`[MongoStore] Session ${sessionId} exists: ${exists}`);
      return exists;
    } catch (error) {
      console.error('[MongoStore] Error checking session existence:', error);
      return false;
    }
  }

  // Save ZIP file to MongoDB using GridFS (RemoteAuth calls this after creating the ZIP)
  async save(options) {
    try {
      const sessionId = (options && options.session) ? options.session : 'default';
      const zipFilePath = `${sessionId}.zip`;
      
      console.log(`[MongoStore] Saving session ${sessionId} from ${zipFilePath}... (This is normal - RemoteAuth saves periodically for backup)`);
      
      // Check if ZIP file exists
      if (!fs.existsSync(zipFilePath)) {
        console.error(`[MongoStore] ZIP file ${zipFilePath} not found`);
        return false;
      }
      
      // Get file size
      const stats = fs.statSync(zipFilePath);
      const fileSize = stats.size;
      console.log(`[MongoStore] ZIP file size: ${fileSize} bytes`);
      
      // Delete existing session if it exists
      await this.delete(options);
      
      // Create upload stream to GridFS
      const uploadStream = this.bucket.openUploadStream(`${sessionId}.zip`, {
        metadata: { sessionId, type: 'whatsapp-session' }
      });
      
      // Create read stream from file
      const readStream = fs.createReadStream(zipFilePath);
      
      // Upload file to GridFS
      const gridfsFileId = await new Promise((resolve, reject) => {
        readStream.pipe(uploadStream)
          .on('error', reject)
          .on('finish', () => {
            resolve(uploadStream.id);
          });
      });
      
      // Save session metadata
      await this.Session.create({
        id: sessionId,
        gridfsFileId: gridfsFileId,
        fileSize: fileSize,
        updatedAt: new Date()
      });
      
      console.log(`[MongoStore] Session ${sessionId} saved successfully (${fileSize} bytes) with GridFS ID: ${gridfsFileId}`);
      return true;
    } catch (error) {
      console.error('[MongoStore] Error saving session:', error);
      return false;
    }
  }

  // Extract ZIP file from MongoDB GridFS to disk (RemoteAuth will then unzip it)
  async extract(options) {
    try {
      const sessionId = (options && options.session) ? options.session : 'default';
      const zipFilePath = options.path || `${sessionId}.zip`;
      
      console.log(`[MongoStore] Extracting session ${sessionId} to ${zipFilePath}...`);
      
      // Get session metadata from MongoDB
      const session = await this.Session.findOne({ id: sessionId });
      
      if (!session || !session.gridfsFileId) {
        console.log(`[MongoStore] No session ${sessionId} found in MongoDB`);
        return false;
      }
      
      // Create download stream from GridFS
      const downloadStream = this.bucket.openDownloadStream(session.gridfsFileId);
      
      // Create write stream to file
      const writeStream = fs.createWriteStream(zipFilePath);
      
      // Download file from GridFS
      await new Promise((resolve, reject) => {
        downloadStream.pipe(writeStream)
          .on('error', reject)
          .on('finish', () => {
            resolve();
          });
      });
      
      console.log(`[MongoStore] Session ${sessionId} extracted successfully (${session.fileSize} bytes)`);
      return true;
    } catch (error) {
      console.error('[MongoStore] Error extracting session:', error);
      return false;
    }
  }

  // Delete session from MongoDB and GridFS
  async delete(options) {
    try {
      const sessionId = (options && options.session) ? options.session : 'default';
      
      console.log(`[MongoStore] Deleting session ${sessionId}...`);
      
      // Get session metadata
      const session = await this.Session.findOne({ id: sessionId });
      
      if (session && session.gridfsFileId) {
        // Delete file from GridFS
        try {
          await this.bucket.delete(session.gridfsFileId);
          console.log(`[MongoStore] Deleted GridFS file: ${session.gridfsFileId}`);
        } catch (error) {
          console.log(`[MongoStore] GridFS file already deleted or not found: ${session.gridfsFileId}`);
        }
      }
      
      // Delete session metadata
      const result = await this.Session.deleteOne({ id: sessionId });
      
      console.log(`[MongoStore] Session ${sessionId} deleted: ${result.deletedCount > 0}`);
      return result.deletedCount > 0;
    } catch (error) {
      console.error('[MongoStore] Error deleting session:', error);
      return false;
    }
  }
}

module.exports = { MongoStore }; 