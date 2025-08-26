import React, { useState, useEffect } from "react";
import { auth, provider } from "./firebaseConfig";
import { signInWithPopup, signOut } from "firebase/auth";
import MeetupMap from "./components/MeetupMap";
import PersonalMap from "./components/PersonalMap";
import SharedMap from "./components/SharedMap";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('meetup'); // 'meetup' or 'personal'
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Set up authentication listener
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });

    return () => unsubscribe(); // Cleanup subscription
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google: ", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

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
    <Router>
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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {user ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                  />
                  <span style={{ fontSize: '14px' }}>{user.displayName}</span>
                </div>
                <button
                  style={{
                    ...buttonStyle(false),
                    background: '#ff4444',
                    color: 'white',
                  }}
                  onClick={handleSignOut}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                style={{
                  ...buttonStyle(false),
                  background: '#4285f4',
                  color: 'white',
                }}
                onClick={handleSignIn}
              >
                Sign in with Google
              </button>
            )}
          </div>
        </nav>
        <div style={contentStyle}>
          <Routes>
            <Route path="/" element={currentView === 'meetup' ? <MeetupMap /> : <PersonalMap />} />
            <Route path="/shared-map/:mapId" element={<SharedMap />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;