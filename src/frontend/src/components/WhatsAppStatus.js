import React, { useState, useEffect, useRef } from 'react';
import QRCodeScanner from './QRCodeScanner';
import axios from 'axios';
import './WhatsAppStatus.css';

const WhatsAppStatus = () => {
  const [status, setStatus] = useState('loading');
  const [qrCode, setQrCode] = useState(null);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [userPhoneNumber, setUserPhoneNumber] = useState(null);
  const [userProfilePic, setUserProfilePic] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const timerRef = useRef(null);

  // Format elapsed time as HH:MM:SS
  const formatElapsedTime = (milliseconds) => {
    if (!milliseconds) return '00:00:00';
    
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      remainingSeconds.toString().padStart(2, '0')
    ].join(':');
  };

  // Update session duration timer
  useEffect(() => {
    // Clear previous timer if exists
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // If we have a session start time, start the timer
    if (sessionStartTime) {
      // Update immediately
      const updateDuration = () => {
        const now = Date.now();
        const elapsed = now - sessionStartTime;
        setSessionDuration(formatElapsedTime(elapsed));
      };
      
      updateDuration();
      
      // Then update every second
      timerRef.current = setInterval(updateDuration, 1000);
    } else {
      setSessionDuration('00:00:00');
    }
    
    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionStartTime]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await axios.get('/api/status/client');
      setStatus(response.data.status);
      setQrCode(response.data.qrCode);
      
      // Update user profile information if available
      if (response.data.userPhoneNumber) {
        setUserPhoneNumber(response.data.userPhoneNumber);
      }
      
      // Update client info if available
      if (response.data.clientInfo) {
        setClientInfo(response.data.clientInfo);
        
        // Extract profile picture URL from clientInfo
        if (response.data.clientInfo.profilePicUrl) {
          setUserProfilePic(response.data.clientInfo.profilePicUrl);
        }
      }
      
      // Update session start time if available
      if (response.data.sessionStartTime) {
        setSessionStartTime(response.data.sessionStartTime);
      } else {
        setSessionStartTime(null);
      }
      
      setError(null);
    } catch (err) {
      setError('Error fetching status: ' + (err.response?.data?.message || err.message));
    }
  };

  const connectWhatsApp = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      const response = await axios.post('/api/init');
      setStatus(response.data.status);
      fetchStatus(); // Immediately fetch status to get QR code if available
    } catch (err) {
      setError('Error connecting: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWhatsApp = async () => {
    try {
      setIsDisconnecting(true);
      setError(null);
      await axios.post('/api/logout');
      setStatus('not_initialized');
      setQrCode(null);
      setUserPhoneNumber(null);
      setUserProfilePic(null);
      setClientInfo(null);
      setSessionStartTime(null); // Reset session timer
    } catch (err) {
      setError('Error disconnecting: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsDisconnecting(false);
      // After disconnecting, wait a moment and then fetch status again
      setTimeout(fetchStatus, 2000);
    }
  };

  const renderStatus = () => {
    switch (status) {
      case 'not_initialized':
        return (
          <div className="status-container">
            <div className="status not-initialized">Not connected</div>
            <button 
              onClick={connectWhatsApp} 
              disabled={isConnecting}
              className="connect-button"
            >
              {isConnecting ? 'Connecting...' : 'Connect to WhatsApp'}
            </button>
          </div>
        );
      case 'initializing':
        return (
          <div className="status-container">
            <div className="status initializing">Initializing... this may take a minute</div>
            <div className="loading-animation"></div>
          </div>
        );
      case 'qr_received':
        return (
          <div className="status-container">
            <div className="status qr-received">Please scan the QR code</div>
            <QRCodeScanner qrCode={qrCode} />
            <button 
              onClick={disconnectWhatsApp} 
              disabled={isDisconnecting}
              className="disconnect-button"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Cancel & Disconnect'}
            </button>
          </div>
        );
      case 'ready':
        return (
          <div className="status-container">
            <div className="status ready">Connected to WhatsApp</div>
            
            {/* User profile information */}
            <div className="user-profile">
              {userProfilePic && (
                <div className="profile-pic-container">
                  <img 
                    src={userProfilePic} 
                    alt="Profile" 
                    className="profile-pic"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div className="client-info">
                {userPhoneNumber && (
                  <div className="info-item">
                    <span className="info-label">Phone:</span> +{userPhoneNumber}
                  </div>
                )}
                
                {clientInfo && clientInfo.pushname && (
                  <div className="info-item">
                    <span className="info-label">Name:</span> {clientInfo.pushname}
                  </div>
                )}
                
                {clientInfo && clientInfo.platform && (
                  <div className="info-item">
                    <span className="info-label">Platform:</span> {clientInfo.platform}
                  </div>
                )}
                
                {clientInfo && clientInfo.battery && (
                  <div className="info-item">
                    <span className="info-label">Battery:</span> {clientInfo.battery.battery}%
                    {clientInfo.battery.plugged && <span className="charging-indicator"> ⚡</span>}
                  </div>
                )}
                
                {clientInfo && clientInfo.phone && clientInfo.phone.device_model && (
                  <div className="info-item">
                    <span className="info-label">Device:</span> {clientInfo.phone.device_model}
                  </div>
                )}
                
                {clientInfo && clientInfo.phone && clientInfo.phone.os_version && (
                  <div className="info-item">
                    <span className="info-label">OS:</span> {clientInfo.phone.os_version}
                  </div>
                )}
                
                <div className="info-item session-timer">
                  <span className="info-label">Session Active:</span> {sessionDuration}
                </div>
              </div>
            </div>
            
            <button 
              onClick={disconnectWhatsApp} 
              disabled={isDisconnecting}
              className="disconnect-button"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        );
      case 'timeout':
        return (
          <div className="status-container">
            <div className="status error">Connection timeout. Please try again.</div>
            <button 
              onClick={connectWhatsApp} 
              disabled={isConnecting}
              className="connect-button"
            >
              {isConnecting ? 'Connecting...' : 'Try Again'}
            </button>
          </div>
        );
      case 'auth_failed':
        return (
          <div className="status-container">
            <div className="status error">Authentication failed</div>
            <button 
              onClick={disconnectWhatsApp} 
              disabled={isDisconnecting}
              className="disconnect-button"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect & Try Again'}
            </button>
          </div>
        );
      case 'error':
        return (
          <div className="status-container">
            <div className="status error">Error connecting to WhatsApp</div>
            <button 
              onClick={disconnectWhatsApp} 
              disabled={isDisconnecting}
              className="disconnect-button"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Reset Connection'}
            </button>
          </div>
        );
      default:
        return (
          <div className="status-container">
            <div className="status loading">Loading status...</div>
          </div>
        );
    }
  };

  return (
    <div className="whatsapp-status-wrapper">
      <h2>WhatsApp Connection</h2>
      {renderStatus()}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default WhatsAppStatus; 