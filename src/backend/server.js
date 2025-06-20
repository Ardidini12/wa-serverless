const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { MongoStore } = require('./mongoStore');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Import from the official whatsapp-web.js library
const { Client, RemoteAuth } = require('../../whatsapp-web.js');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
}

// MongoDB Connection - using environment variable
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[Server] MONGODB_URI environment variable is not set');
  process.exit(1);
}

// Global variables
let mongoStore;
let client;
let isConnecting = false;
let qrCodeData = null;
let clientStatus = 'not_initialized';

// Connect to MongoDB
const connectToMongoDB = async () => {
  try {
    console.log('[Server] Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Server] Connected to MongoDB Atlas successfully');
    
    // Initialize MongoStore
    mongoStore = new MongoStore({ mongoose });
    console.log('[Server] MongoStore initialized');
    
    return true;
  } catch (error) {
    console.error('[Server] Failed to connect to MongoDB:', error);
    return false;
  }
};

// Initialize WhatsApp Client with Official RemoteAuth
const initializeWhatsAppClient = async () => {
  if (isConnecting || (client && client.info)) {
    console.log('[WhatsApp] Client already exists or is connecting');
    return;
  }

  if (!mongoStore) {
    console.error('[WhatsApp] MongoStore not initialized');
    return;
  }

  try {
    console.log('[WhatsApp] Initializing WhatsApp client with RemoteAuth...');
    isConnecting = true;
    clientStatus = 'initializing';
    qrCodeData = null;

    // Create client with official RemoteAuth - ALL REQUIRED PARAMETERS
    client = new Client({
      authStrategy: new RemoteAuth({
        store: mongoStore,                    // Our MongoDB store
        clientId: 'main',                     // Client identifier  
        backupSyncIntervalMs: 300000,         // Increased to 5 minutes (300000ms) to reduce frequent saves
        dataPath: './.wwebjs_auth',           // Local temp path for session processing
        rmMaxRetries: 4                       // Max retries for file operations
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      }
    });

    // Event: QR Code generated (no session exists)
    client.on('qr', (qr) => {
      console.log('[WhatsApp] QR Code generated - no session in MongoDB');
      qrCodeData = qr;
      clientStatus = 'qr_received';
    });

    // Event: Client ready (session restored or new session created)
    client.on('ready', async () => {
      console.log('[WhatsApp] Client is ready!');
      clientStatus = 'ready';
      isConnecting = false;
      qrCodeData = null;
      
      try {
        const info = client.info;
        console.log('[WhatsApp] Client info:', {
          pushname: info.pushname,
          wid: info.wid._serialized,
          platform: info.platform
        });

        // Get profile picture
        try {
          const profilePicUrl = await client.getProfilePicUrl(info.wid._serialized);
          console.log('[WhatsApp] Profile picture URL obtained');
          info.profilePicUrl = profilePicUrl;
        } catch (error) {
          console.log('[WhatsApp] No profile picture available or error getting profile pic:', error.message);
          info.profilePicUrl = null;
        }
        
        // Store client info globally for API access
        global.clientInfo = info;
        
      } catch (error) {
        console.error('[WhatsApp] Error getting client info:', error);
      }
    });

    // Event: Authentication successful
    client.on('authenticated', () => {
      console.log('[WhatsApp] Client authenticated successfully');
      clientStatus = 'authenticated';
    });

    // Event: Authentication failed
    client.on('auth_failure', (msg) => {
      console.error('[WhatsApp] Authentication failed:', msg);
      clientStatus = 'auth_failed';
      isConnecting = false;
      qrCodeData = null;
    });

    // Event: Client disconnected
    client.on('disconnected', (reason) => {
      console.log('[WhatsApp] Client disconnected:', reason);
      clientStatus = 'disconnected';
      client = null;
      isConnecting = false;
      qrCodeData = null;
    });

    // Event: Remote session saved to MongoDB (ZIP file stored)
    client.on('remote_session_saved', () => {
      console.log('[WhatsApp] Remote session saved to MongoDB successfully - This happens periodically for backup');
    });

    // Initialize the client
    console.log('[WhatsApp] Starting client initialization...');
    await client.initialize();

  } catch (error) {
    console.error('[WhatsApp] Error initializing client:', error);
    clientStatus = 'error';
    isConnecting = false;
    qrCodeData = null;
  }
};

// Disconnect WhatsApp client and delete session from MongoDB
const disconnectWhatsApp = async () => {
  try {
    if (client) {
      console.log('[WhatsApp] Disconnecting client and deleting session from MongoDB...');
      await client.logout(); // This calls RemoteAuth.disconnect() which deletes from MongoDB
      await client.destroy();
      client = null;
    }
    
    clientStatus = 'not_initialized';
    isConnecting = false;
    qrCodeData = null;
    global.clientInfo = null; // Clear stored client info
    
    console.log('[WhatsApp] Client disconnected and session deleted from MongoDB');
    return true;
  } catch (error) {
    console.error('[WhatsApp] Error disconnecting client:', error);
    return false;
  }
};

// API Routes

// Get current status
app.get('/api/status', (req, res) => {
  res.json({
    status: clientStatus,
    isConnecting,
    hasQrCode: !!qrCodeData,
    clientExists: !!client,
    mongoConnected: mongoose.connection.readyState === 1
  });
});

// Get QR Code
app.get('/api/qrcode', (req, res) => {
  if (qrCodeData) {
    res.json({ qrCode: qrCodeData });
  } else {
    res.status(404).json({ error: 'No QR code available' });
  }
});

// Initialize WhatsApp connection
app.post('/api/init', async (req, res) => {
  try {
    if (isConnecting) {
      return res.status(400).json({ error: 'Already connecting' });
    }

    if (client && clientStatus === 'ready') {
      return res.json({ message: 'Client already connected', status: clientStatus });
    }

    await initializeWhatsAppClient();
    res.json({ message: 'Initialization started', status: clientStatus });
  } catch (error) {
    console.error('[API] Error in /api/init:', error);
    res.status(500).json({ error: 'Failed to initialize client' });
  }
});

// Get client info
app.get('/api/status/client', async (req, res) => {
  try {
    const response = {
      status: clientStatus,
      qrCode: clientStatus === 'qr_received' ? qrCodeData : null,
      initializing: isConnecting
    };

    if (client && clientStatus === 'ready' && global.clientInfo) {
      const info = global.clientInfo;
      response.userPhoneNumber = info.wid.user;
      response.clientInfo = {
        pushname: info.pushname,
        wid: info.wid._serialized,
        platform: info.platform,
        profilePicUrl: info.profilePicUrl
      };
    }

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting client info:', error);
    res.status(500).json({ error: 'Failed to get client info' });
  }
});

// Logout and disconnect (deletes session from MongoDB)
app.post('/api/logout', async (req, res) => {
  try {
    const result = await disconnectWhatsApp();
    if (result) {
      res.json({ message: 'Logged out successfully and session deleted from MongoDB' });
    } else {
      res.status(500).json({ error: 'Failed to logout' });
    }
  } catch (error) {
    console.error('[API] Error in /api/logout:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Serve React app for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Start server
const startServer = async () => {
  const mongoConnected = await connectToMongoDB();
  
  if (!mongoConnected) {
    console.error('[Server] Failed to connect to MongoDB. Server will not start.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`[Server] Server running on port ${PORT}`);
    console.log('[Server] WhatsApp Web API is ready');
  });

  // Auto-initialize if session exists in MongoDB
  try {
    if (mongoStore) {
      // Check for session with the exact name RemoteAuth creates: "RemoteAuth-{clientId}"
      const sessionExists = await mongoStore.sessionExists({ session: 'RemoteAuth-main' });
      if (sessionExists) {
        console.log('[Server] Existing session found in MongoDB, auto-initializing...');
        setTimeout(() => {
          initializeWhatsAppClient();
        }, 2000);
      } else {
        console.log('[Server] No existing session in MongoDB, waiting for manual initialization');
      }
    }
  } catch (error) {
    console.error('[Server] Error checking for existing session:', error);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[Server] Received SIGINT, shutting down gracefully...');
  
  if (client) {
    try {
      await client.destroy();
    } catch (error) {
      console.error('[Server] Error destroying client:', error);
    }
  }
  
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  
  process.exit(0);
});

startServer(); 