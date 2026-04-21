import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const s = io(window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    s.on('connect', () => {
      console.log('🔌 Connected to server');
      setConnected(true);
    });

    s.on('disconnect', () => {
      console.log('🔌 Disconnected');
      setConnected(false);
    });

    s.on('connect_error', (err) => {
      console.error('🔌 Connection error:', err.message);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
