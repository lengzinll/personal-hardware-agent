import json
from typing import Set, Optional, Dict, Any
from fastapi import WebSocket
from services.led_tool import get_all_led_states, get_hardware_info


class LedStateManager:
    """
    Manages WebSocket connections and broadcasts LED & Lamp state changes
    along with physical pin hardware health to all connected clients.
    """
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        """Accept and track a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        print(f"[WebSocket] Client connected. Total connections: {len(self.active_connections)}")
        
        # Send current LED state and hardware status immediately on connection
        current_state = get_all_led_states()
        hw_info = get_hardware_info()
        await websocket.send_text(json.dumps({
            "type": "led_state",
            "states": current_state,
            "hardware": hw_info,
        }))
    
    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        self.active_connections.discard(websocket)
        print(f"[WebSocket] Client disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast_state(self, states: dict, hardware_info: Optional[Dict[str, Any]] = None):
        """
        Broadcast LED state and hardware status to all connected clients.
        Automatically handles disconnected clients.
        """
        disconnected = set()
        payload = {
            "type": "led_state",
            "states": states,
            "hardware": hardware_info or get_hardware_info(),
        }
        msg_str = json.dumps(payload)
        
        for connection in list(self.active_connections):
            try:
                await connection.send_text(msg_str)
            except Exception as e:
                print(f"[WebSocket] Error sending to client: {e}")
                disconnected.add(connection)
        
        # Clean up disconnected clients
        self.active_connections -= disconnected


# Global instance
led_state_manager = LedStateManager()
