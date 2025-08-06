import React, { useState } from "react";
import MeetupMap from "./components/MeetupMap";
import PersonalMap from "./components/PersonalMap";
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('meetup'); // 'meetup' or 'personal'

  const navStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    background: '#fff',
    padding: '10px 20px',
    borderBottom: '1px solid #ddd',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  };

  const buttonStyle = (isActive) => ({
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    background: isActive ? '#4285f4' : '#f0f0f0',
    color: isActive ? '#fff' : '#333',
    transition: 'all 0.2s ease'
  });

  const contentStyle = {
    marginTop: '60px', // Account for fixed nav
    height: 'calc(100vh - 60px)'
  };

  return (
    <div className="App">
      <nav style={navStyle}>
        <h1 style={{ margin: 0, fontSize: '18px', color: '#333' }}>Where2Meet</h1>
        <button 
          style={buttonStyle(currentView === 'meetup')}
          onClick={() => setCurrentView('meetup')}
        >
          🤝 Meetup Planner
        </button>
        <button 
          style={buttonStyle(currentView === 'personal')}
          onClick={() => setCurrentView('personal')}
        >
          📍 Personal Map
        </button>
      </nav>
      
      <div style={contentStyle}>
        {currentView === 'meetup' && <MeetupMap />}
        {currentView === 'personal' && <PersonalMap />}
      </div>
    </div>
  );
}

export default App;