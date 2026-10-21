import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useAuctions } from '../context/AuctionContext';
import { socketOrigin } from '../lib/api';

export function useAuctionSocket(auctionId) {
  const { token } = useAuth();
  const { updateAuction } = useAuctions();
  const [connection, setConnection] = useState('offline');
  const [watchers, setWatchers] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!auctionId) { setConnection('offline'); setWatchers(0); return undefined; }
    setConnection('connecting');
    const socket = io(socketOrigin(), {
      auth: token ? { token } : {},
      reconnectionAttempts: 8,
      timeout: 8000,
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnection('live');
      socket.emit('auction:join', auctionId);
    });
    socket.on('disconnect', () => setConnection('reconnecting'));
    socket.on('connect_error', () => setConnection(token ? 'offline' : 'guest'));
    socket.on('auction:snapshot', updateAuction);
    socket.on('auction:update', updateAuction);
    socket.on('auction:presence', (presence) => setWatchers(presence.count || 0));
    return () => {
      if (socketRef.current === socket) socketRef.current = null;
      socket.disconnect();
      setConnection('offline');
    };
  }, [auctionId, token, updateAuction]);

  function placeBid(amount) {
    const socket = socketRef.current;
    if (!auctionId) return Promise.resolve({ ok: false, error: 'Choose an auction first.' });
    if (!socket?.connected) return Promise.resolve({ ok: false, error: 'Live connection is not ready. Try again in a moment.' });
    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => resolve({ ok: false, error: 'The server did not confirm the bid. Check the current price before retrying.' }), 8000);
      socket.emit('auction:bid', { auctionId, amount }, (result) => {
        window.clearTimeout(timeout);
        if (result.auction) updateAuction(result.auction);
        resolve(result);
      });
    });
  }

  return { connection, watchers, placeBid };
}
