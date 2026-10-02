"use client"

import { useCallback } from 'react';
import { useEffect, useState, useRef } from 'react';

interface LedStates {
  red: 'ON' | 'OFF';
  yellow: 'ON' | 'OFF';
  green: 'ON' | 'OFF';
}

interface UseLedWebSocketReturn {
  ledStates: LedStates;
  isConnected: boolean;
  error: string | null;
  sendControlCommand: (color: string, action: string) => Promise<boolean>;
  sendPresetCommand: (mode: string) => Promise<boolean>;
}

/**
 * Custom hook for real-time LED state synchronization via WebSocket.
 * Handles both state updates and command sending over a single persistent connection.
 */
export function useLedWebSocket(): UseLedWebSocketReturn {
  const [ledStates, setLedStates] = useState<LedStates>({
    red: 'OFF',
    yellow: 'OFF',
    green: 'OFF',
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      const url = `${protocol}://${host}/ws/led`;

      console.log('[LED WebSocket] Connecting to', url);

      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[LED WebSocket] Connected');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'led_state' && data.states) {
            console.log('[LED WebSocket] State update:', data.states);
            setLedStates(data.states);
          } else if (data.type === 'command_response') {
            console.log('[LED WebSocket] Command response:', data);
            // State will be updated via the led_state broadcast
          } else if (data.type === 'error') {
            console.error('[LED WebSocket] Error:', data.message);
          }
        } catch (err) {
          console.error('[LED WebSocket] Parse error:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[LED WebSocket] Error:', event);
        setError('WebSocket error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('[LED WebSocket] Disconnected');
        setIsConnected(false);

        // Auto-reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[LED WebSocket] Attempting to reconnect...');
          connect();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[LED WebSocket] Connection error:', err);
      setError(String(err));
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Send control command via WebSocket
  const sendControlCommand = useCallback(
    (color: string, action: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.error('[LED WebSocket] Not connected');
          resolve(false);
          return;
        }

        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'control_led',
              color,
              action,
            })
          );
          console.log('[LED WebSocket] Sent control command:', { color, action });
          resolve(true);
        } catch (err) {
          console.error('[LED WebSocket] Send error:', err);
          resolve(false);
        }
      });
    },
    []
  );

  // Send preset command via WebSocket
  const sendPresetCommand = useCallback(
    (mode: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.error('[LED WebSocket] Not connected');
          resolve(false);
          return;
        }

        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'set_traffic_preset',
              mode,
            })
          );
          console.log('[LED WebSocket] Sent preset command:', { mode });
          resolve(true);
        } catch (err) {
          console.error('[LED WebSocket] Send error:', err);
          resolve(false);
        }
      });
    },
    []
  );

  return {
    ledStates,
    isConnected,
    error,
    sendControlCommand,
    sendPresetCommand,
  };
}
