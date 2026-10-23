"use client"

import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { ledStatesAtom, ledWebSocketConnectedAtom } from '@/lib/atoms';
import { useLedWebSocketInternal, LedWebSocketContext } from '@/lib/useLedWebSocket';

/**
 * Provider component that maintains a single, shared WebSocket connection,
 * synchronizes LED state with Jotai atoms, and provides the connection to all child components.
 */
export function LedWebSocketProvider({ children }: { children: React.ReactNode }) {
  const [, setLedStates] = useAtom(ledStatesAtom);
  const [, setIsConnected] = useAtom(ledWebSocketConnectedAtom);

  // Single shared WebSocket instance for the whole application
  const ws = useLedWebSocketInternal();

  // Sync WebSocket state to Jotai atoms
  useEffect(() => {
    setLedStates(ws.ledStates);
  }, [ws.ledStates, setLedStates]);

  useEffect(() => {
    setIsConnected(ws.isConnected);
  }, [ws.isConnected, setIsConnected]);

  return (
    <LedWebSocketContext.Provider value={ws}>
      {children}
    </LedWebSocketContext.Provider>
  );
}

/**
 * Hook to access LED state from anywhere in the component tree.
 * Must be used inside a component wrapped by LedWebSocketProvider.
 */
export function useLedState() {
  const [ledStates, setLedStates] = useAtom(ledStatesAtom);
  const [isConnected] = useAtom(ledWebSocketConnectedAtom);

  return {
    ledStates,
    setLedStates,
    isConnected,
  };
}
