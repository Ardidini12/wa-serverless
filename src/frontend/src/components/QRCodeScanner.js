import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './QRCodeScanner.css';

const QRCodeScanner = ({ qrCode }) => {
  if (!qrCode) {
    return (
      <div className="qrcode-loading">
        Loading QR Code...
      </div>
    );
  }

  return (
    <div className="qrcode-container">
      <div className="qrcode-wrapper">
        <QRCodeSVG 
          value={qrCode} 
          size={230} 
          level="M"
          includeMargin={true}
          bgColor="#FFFFFF"
          fgColor="#128C7E"
        />
      </div>
      <p className="qrcode-instruction">
        Open WhatsApp on your phone<br />
        Tap Menu or Settings and select WhatsApp Web<br />
        Point your phone at this screen to scan the code
      </p>
    </div>
  );
};

export default QRCodeScanner; 