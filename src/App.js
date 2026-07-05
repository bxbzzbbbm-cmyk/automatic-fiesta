// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

const ramSizes = [1024, 2048, 512, 2048, 512, 4096, 1536];

function getRandomRamSize() {
  const index = Math.floor(Math.random() * ramSizes.length);
  return ramSizes[index];
}

function RamChecker() {
  const ram = getRandomRamSize();
  return (
    <div style={styles.container}>
      <h1>RAM Size Checker</h1>
      <p>Detected RAM Size: {ram} MB</p>
    </div>
  );
}

function Home() {
  return (
    <div style={styles.container}>
      <h1>Welcome</h1>
      <p>Navigate to <code>/get-ram</code> to check RAM size.</p>
    </div>
  );
}

function App() {
  return (
    <Router basename={process.env.PUBLIC_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/get-ram" element={<RamChecker />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

const styles = {
  container: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    background: '#eef2f3',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
    textAlign: 'center',
  },
};

export default App;
