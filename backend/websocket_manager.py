import json
from typing import Set
from fastapi import WebSocket
from services.led_tool import get_all_led_states


class LedStateManager:
    """
    Manages WebSocket connections and broadcasts LED state changes to all connected clients.
    """
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        """Accept and track a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        print(f"[WebSocket] Client connected. Total connections: {len(self.active_connections)}")
        
        # Send current LED state immediately on connection
        current_state = get_all_led_states()
        await websocket.send_text(json.dumps({
            "type": "led_state",
            "states": current_state,
        }))
    
    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        self.active_connections.discard(websocket)
        print(f"[WebSocket] Client disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast_state(self, states: dict):
        """
        Broadcast LED state to all connected clients.
        Automatically handles disconnected clients.
        """
        disconnected = set()
        
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps({
                    "type": "led_state",
                    "states": states,
                }))
            except Exception as e:
                print(f"[WebSocket] Error sending to client: {e}")
                disconnected.add(connection)
        
        # Clean up disconnected clients
        self.active_connections -= disconnected


# Global instance
led_state_manager = LedStateManager()
