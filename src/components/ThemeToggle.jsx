"use client";

import { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Load theme from localStorage on initial render
    const savedTheme = localStorage.getItem('ludoTheme');
    if (savedTheme === 'light') {
      setIsLight(true);
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isLight;
    setIsLight(newTheme);
    if (newTheme) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('ludoTheme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('ludoTheme', 'dark');
    }
  };

  const { isMusicEnabled, setIsMusicEnabled, musicStatus } = useGame();

  return (
    <div className="theme-toggle-container">
      <button 
        onClick={() => setIsMusicEnabled(!isMusicEnabled)} 
        className="theme-button" 
        title="Toggle Music"
      >
        <span>{isMusicEnabled ? '🔊' : '🔇'}</span>
        {isMusicEnabled && musicStatus === 'loading' && <span style={{fontSize: '0.6rem'}}>...</span>}
        {isMusicEnabled && musicStatus === 'error' && <span style={{fontSize: '0.6rem', color: 'red'}}>!</span>}
      </button>
      <button onClick={toggleTheme} className="theme-button" title="Toggle Dark/Light">
        {isLight ? '🌙 ' : '☀️'}
      </button>
    </div>
  );
}
