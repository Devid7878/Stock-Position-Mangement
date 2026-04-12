import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePositions } from './PositionsContext';

const AlertsContext = createContext();

export function useAlerts() {
  return useContext(AlertsContext);
}

export function AlertsProvider({ children }) {
  const { getLivePrice, positions } = usePositions();
  const [alerts, setAlerts] = useState(() => {
    try {
      const stored = localStorage.getItem('terminal_alerts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeAlarms, setActiveAlarms] = useState([]);

  useEffect(() => {
    localStorage.setItem('terminal_alerts', JSON.stringify(alerts));
  }, [alerts]);

  const addAlert = useCallback((symbolToken, tradingSymbol, targetPrice, type = 'price', direction = 'above') => {
    const newAlert = {
      id: Date.now().toString(),
      symbolToken,
      tradingSymbol,
      targetPrice: parseFloat(targetPrice),
      type, // 'price', 'sl', 'target'
      direction, // 'above', 'below'
      active: true,
      createdAt: new Date().toISOString()
    };
    setAlerts(prev => [...prev, newAlert]);
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const toggleAlert = useCallback((id, status) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: status !== undefined ? status : !a.active } : a));
  }, []);

  const playAlarm = useCallback((alert, currentPrice) => {
    try {
      // Create oscillator/synth sound instead of relying on external file
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const actx = new AudioContext();
      const osc = actx.createOscillator();
      const gainNode = actx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, actx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, actx.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.5, actx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.5);
      
      osc.connect(gainNode);
      gainNode.connect(actx.destination);
      osc.start();
      osc.stop(actx.currentTime + 0.5);

      // Web Notification
      if (Notification.permission === 'granted') {
        new Notification(`Alert Triggered: ${alert.tradingSymbol}`, {
          body: `Price crossed ${alert.targetPrice} (LTP: ${currentPrice})`,
          icon: '/favicon.ico'
        });
      }
    } catch (err) {
      console.error('Audio play blocked or failed', err);
    }
  }, []);

  useEffect(() => {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  // Monitor live prices against active alerts
  useEffect(() => {
    if (!alerts.length) return;
    
    // Periodically check or check on price change (Interval is safest for polling fallback)
    const interval = setInterval(() => {
      alerts.forEach(alert => {
        if (!alert.active) return;
        const currentPrice = getLivePrice(alert.symbolToken);
        if (!currentPrice) return;

        let triggered = false;
        if (alert.direction === 'above' && currentPrice >= alert.targetPrice) {
          triggered = true;
        } else if (alert.direction === 'below' && currentPrice <= alert.targetPrice) {
          triggered = true;
        }

        if (triggered) {
          playAlarm(alert, currentPrice);
          setActiveAlarms(prev => {
            if (prev.find(a => a.id === alert.id)) return prev;
            return [...prev, { ...alert, triggerPrice: currentPrice }];
          });
          // deactivate after trigger
          toggleAlert(alert.id, false);
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [alerts, getLivePrice, playAlarm, toggleAlert]);

  const dismissAlarm = useCallback((id) => {
    setActiveAlarms(prev => prev.filter(a => a.id !== id));
  }, []);

  return (
    <AlertsContext.Provider value={{ alerts, addAlert, removeAlert, toggleAlert, activeAlarms, dismissAlarm }}>
      {children}
    </AlertsContext.Provider>
  );
}
