"use client"

import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { ledStatesAtom, ledWebSocketConnectedAtom } from '@/lib/atoms';
import { useLedWebSocket } from '@/lib/useLedWebSocket';

/**
 * Provider component that syncronizes WebSocket LED state with Jotai atoms.
 * Place this near the root of your app to enable global LED state access.
 */
export function LedWebSocketProvider({ children }: { children: React.ReactNode }) {
  const [, setLedStates] = useAtom(ledStatesAtom);
  const [, setIsConnected] = useAtom(ledWebSocketConnectedAtom);

  // Get WebSocket data
  const { ledStates, isConnected } = useLedWebSocket();

  // Sync WebSocket state to Jotai atoms
  useEffect(() => {
    setLedStates(ledStates);
  }, [ledStates, setLedStates]);

  useEffect(() => {
    setIsConnected(isConnected);
  }, [isConnected, setIsConnected]);

  return <>{children}</>;
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
