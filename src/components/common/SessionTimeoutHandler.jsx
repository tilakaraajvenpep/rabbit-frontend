import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { message } from 'antd';

const TIMEOUT_IN_MS = 30 * 60 * 1000; // 30 minutes
const LAST_ACTIVE_KEY = 'rabbit_last_active';

const SessionTimeoutHandler = () => {
  const { isAuthenticated, logout } = useAuthStore();
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      localStorage.removeItem(LAST_ACTIVE_KEY);
      return;
    }

    // Initialize/Update last active timestamp on login/refresh
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());

    const handleLogout = async () => {
      try {
        await authService.logout();
      } catch (err) {
        console.error('Inactivity logout API call failed:', err);
      } finally {
        logout();
        message.warning('You have been logged out due to inactivity.');
      }
    };

    const resetTimer = () => {
      // Update last active in localStorage
      localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        handleLogout();
      }, TIMEOUT_IN_MS);
    };

    // Listen to storage event (updates from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === LAST_ACTIVE_KEY && e.newValue) {
        const lastActive = parseInt(e.newValue, 10);
        const timeRemaining = TIMEOUT_IN_MS - (Date.now() - lastActive);
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        if (timeRemaining <= 0) {
          handleLogout();
        } else {
          timeoutRef.current = setTimeout(() => {
            handleLogout();
          }, timeRemaining);
        }
      }
    };

    // User activity events to monitor
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Throttle activity event handlers to run at most once every 2 seconds
    let lastEventTime = 0;
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastEventTime > 2000) {
        lastEventTime = now;
        resetTimer();
      }
    };

    events.forEach(event => {
      window.addEventListener(event, throttledReset);
    });

    window.addEventListener('storage', handleStorageChange);

    // Initial timer setup based on existing last active timestamp
    const setupInitialTimer = () => {
      const lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0', 10);
      const timeRemaining = TIMEOUT_IN_MS - (Date.now() - lastActive);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (timeRemaining <= 0) {
        handleLogout();
      } else {
        timeoutRef.current = setTimeout(() => {
          handleLogout();
        }, timeRemaining);
      }
    };

    setupInitialTimer();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, throttledReset);
      });
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated, logout]);

  return null;
};

export default SessionTimeoutHandler;
