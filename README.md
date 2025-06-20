# WhatsApp Web Serverless Application

A serverless WhatsApp Web application built with React frontend and Node.js backend, using MongoDB Atlas for remote session storage.

## Architecture

- **Frontend**: React app with QR code scanner and connection management
- **Backend**: Express server with WhatsApp Web integration
- **Database**: MongoDB Atlas with GridFS for large session file storage
- **Session Management**: Remote authentication with automatic backup

## Features

- ✅ QR Code scanning for WhatsApp authentication
- ✅ Remote session storage in MongoDB Atlas
- ✅ Auto-reconnect on app restart
- ✅ Session backup and recovery
- ✅ Profile picture display
- ✅ Real-time connection status
- ✅ Graceful disconnect with session cleanup

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   cd src/frontend && npm install
   ```

2. **Start development servers**:
   ```bash
   npm run dev
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080

## API Endpoints

- `GET /api/status` - Get basic connection status
- `GET /api/status/client` - Get detailed client information
- `GET /api/qrcode` - Get QR code for authentication
- `POST /api/init` - Initialize WhatsApp connection
- `POST /api/logout` - Disconnect and delete session

## Database Structure

### Collections:
- `sessions` - Session metadata
- `sessions.files` - GridFS file metadata
- `sessions.chunks` - GridFS file chunks (actual data)

### Why GridFS?
WhatsApp session files (13-16MB) exceed MongoDB's 16MB document limit, so we use GridFS to split them into 255KB chunks.

## Frequently Asked Questions

### Q: Why do we constantly save session files?

**A**: The constant session saving is due to RemoteAuth's automatic backup mechanism. Here's why it happens:

1. **Backup Interval**: RemoteAuth is configured with `backupSyncIntervalMs: 300000` (5 minutes)
2. **Purpose**: Prevents session data loss by regularly backing up to MongoDB
3. **What gets saved**: WhatsApp session data (cookies, tokens, encryption keys)
4. **Normal behavior**: This is expected and ensures session persistence

**Configuration**:
```javascript
new RemoteAuth({
  backupSyncIntervalMs: 300000, // Backup every 5 minutes (reduced from 1 minute)
  // ... other options
})
```

**Benefits**:
- ✅ Session survives app crashes
- ✅ Auto-reconnect without re-scanning QR
- ✅ Data integrity protection
- ✅ Serverless deployment compatibility

### Q: How is the profile picture handled?

**A**: Profile pictures are fetched and displayed as follows:

1. **Backend**: Fetches profile picture URL using `client.getProfilePicUrl()`
2. **Storage**: URL is stored in `global.clientInfo.profilePicUrl`
3. **API**: Sent to frontend via `/api/status/client` endpoint
4. **Frontend**: Displays image using the URL from `clientInfo.profilePicUrl`

**Flow**:
```
WhatsApp Client → getProfilePicUrl() → Backend Storage → API Response → Frontend Display
```

## Technical Details

### Session Storage Process:
1. WhatsApp creates local session files
2. RemoteAuth compresses them into a ZIP file
3. MongoStore uploads ZIP to GridFS (splits into chunks)
4. Local ZIP file is deleted
5. Process repeats every 5 minutes for backup

### Auto-Reconnection:
1. App starts → Connects to MongoDB
2. Checks for existing session in GridFS
3. If found → Downloads and extracts session
4. WhatsApp client auto-connects using restored session

### Profile Picture:
1. Client ready event → Fetch profile pic URL
2. Store in global variable → Send via API
3. Frontend updates → Display image

## Troubleshooting

### Session Issues:
- Check MongoDB connection
- Verify GridFS files exist: `node check-gridfs.js`
- Clear sessions: `node cleanup-db.js`

### Profile Picture Not Showing:
- Ensure WhatsApp client is in 'ready' state
- Check browser console for image load errors
- Verify API response includes `profilePicUrl`

## Development Scripts

- `npm run dev` - Start both frontend and backend
- `npm run dev:server` - Start backend only
- `npm run dev:client` - Start frontend only
- `node check-gridfs.js` - Check MongoDB session storage
- `node cleanup-db.js` - Clear all sessions from database 