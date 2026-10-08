from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from websocket_manager import led_state_manager
from services.led_tool import control_leds, set_traffic_preset, control_lamp
from routers.agent import handle_agent_command, stream_agent_command, AgentCommandRequest
from datetime import datetime, UTC
import json

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/led")
async def websocket_led_status(websocket: WebSocket):
    """
    WebSocket endpoint for real-time LED status updates, hardware control,
    and streaming AI agent command responses.
    """
    await led_state_manager.connect(websocket)
    
    try:
        # Keep connection alive and handle incoming commands
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                cmd_type = message.get("type") or message.get("action")
                
                # 1. AI Natural Language Agent Command via ws.send() with real-time streaming
                if cmd_type in ("agent_command", "ai_command", "voice_command"):
                    req = AgentCommandRequest(
                        command=message.get("command", ""),
                        apiKey=message.get("apiKey", ""),
                        engineMode=message.get("engineMode", "ollama"),
                        ollamaModel=message.get("ollamaModel", None),
                        modelName=message.get("modelName", None),
                        history=message.get("history", None),
                    )
                    request_id = message.get("requestId") or message.get("id")

                    # Send stream start event
                    await websocket.send_text(json.dumps({
                        "type": "agent_stream_start",
                        "requestId": request_id,
                    }))

                    accumulated_response = ""
                    action_taken = None
                    tool_payload = None
                    model_used = req.engineMode

                    async for event in stream_agent_command(req):
                        ev_type = event.get("type")
                        if ev_type == "chunk":
                            chunk = event.get("chunk", "")
                            accumulated_response += chunk
                            await websocket.send_text(json.dumps({
                                "type": "agent_stream_chunk",
                                "requestId": request_id,
                                "chunk": chunk,
                            }))
                        elif ev_type == "action":
                            action_taken = event.get("actionTaken")
                            tool_payload = event.get("toolPayload")
                            await websocket.send_text(json.dumps({
                                "type": "agent_action",
                                "requestId": request_id,
                                "actionTaken": action_taken,
                                "toolPayload": tool_payload,
                            }))
                        elif ev_type == "end":
                            accumulated_response = event.get("response", accumulated_response)
                            action_taken = event.get("actionTaken", action_taken)
                            tool_payload = event.get("toolPayload", tool_payload)
                            model_used = event.get("model", model_used)
                        elif ev_type == "error":
                            await websocket.send_text(json.dumps({
                                "type": "agent_stream_error",
                                "requestId": request_id,
                                "error": event.get("error", "Error processing command"),
                            }))

                    # Send final agent_stream_end / agent_response
                    final_payload = {
                        "type": "agent_response",
                        "streamEnd": True,
                        "requestId": request_id,
                        "success": True,
                        "response": accumulated_response or "Action completed.",
                        "actionTaken": action_taken,
                        "toolPayload": tool_payload,
                        "model": model_used,
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                    await websocket.send_text(json.dumps(final_payload))
                    continue

                # 2. Direct Hardware LED / Lamp control commands
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
