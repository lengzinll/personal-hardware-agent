from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from websocket_manager import led_state_manager
from services.led_tool import control_leds, set_traffic_preset, control_lamp
import json

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/led")
async def websocket_led_status(websocket: WebSocket):
    """
    WebSocket endpoint for real-time LED status updates and command control.
    Clients connect here to:
    - Receive live LED state changes and hardware health
    - Send LED & Lamp control commands
    """
    await led_state_manager.connect(websocket)
    
    try:
        # Keep connection alive and handle incoming commands
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                cmd_type = message.get("type") or message.get("action")
                # Support both 'action' and 'state' parameter names
                target_state = message.get("state") or (message.get("action") if message.get("action") in ("ON", "OFF", "TOGGLE") else None) or "TOGGLE"
                
                result = None
                
                if cmd_type == "control_lamp":
                    result = control_lamp(action=target_state)
                elif cmd_type == "control_led":
                    color = message.get("color", "all")
                    if color == "lamp":
                        result = control_lamp(action=target_state)
                    else:
                        result = control_leds(color=color, action=target_state)  # type: ignore
                elif cmd_type in ("traffic_preset", "set_traffic_preset"):
                    mode = message.get("mode", "off")
                    result = set_traffic_preset(mode)  # type: ignore
                
                if result:
                    await websocket.send_text(json.dumps({
                        "type": "command_response",
                        "success": result.get("success", False),
                        "message": result.get("speechText", ""),
                        "states": result.get("states", {}),
                        "payload": result,
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
