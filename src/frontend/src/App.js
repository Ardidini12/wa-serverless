import React from 'react';
import './App.css';
import WhatsAppStatus from './components/WhatsAppStatus';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>WhatsApp Web Serverless</h1>
      </header>
      <main className="App-main">
        <WhatsAppStatus />
      </main>
      <footer className="App-footer">
        <p>WhatsApp Web Serverless Application</p>
      </footer>
    </div>
  );
}

export default App;
