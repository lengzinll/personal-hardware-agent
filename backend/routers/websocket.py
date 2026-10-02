from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from websocket_manager import led_state_manager
from services.led_tool import control_leds, set_traffic_preset
import json

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/led")
async def websocket_led_status(websocket: WebSocket):
    """
    WebSocket endpoint for real-time LED status updates and command control.
    Clients connect here to:
    - Receive live LED state changes
    - Send LED control commands
    """
    await led_state_manager.connect(websocket)
    
    try:
        # Keep connection alive and handle incoming commands
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                message_type = message.get("type")
                
                if message_type == "control_led":
                    # Handle LED control command
                    color = message.get("color", "all")
                    action = message.get("action", "TOGGLE")
                    
                    result = control_leds(color=color, action=action)  # type: ignore
                    
                    # Send back confirmation
                    await websocket.send_text(json.dumps({
                        "type": "command_response",
                        "success": result.get("success", False),
                        "message": result.get("speechText", ""),
                        "states": result.get("states", {}),
                    }))
                
                elif message_type == "set_traffic_preset":
                    # Handle traffic preset command
                    mode = message.get("mode", "off")
                    
                    result = set_traffic_preset(mode)  # type: ignore
                    
                    # Send back confirmation
                    await websocket.send_text(json.dumps({
                        "type": "command_response",
                        "success": result.get("success", False),
                        "message": result.get("speechText", ""),
                        "states": result.get("states", {}),
                    }))
            
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format",
                }))
            except Exception as e:
                print(f"[WebSocket Command Error] {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": str(e),
                }))
    
    except WebSocketDisconnect:
        await led_state_manager.disconnect(websocket)
    except Exception as e:
        print(f"[WebSocket Error] {e}")
        await led_state_manager.disconnect(websocket)
