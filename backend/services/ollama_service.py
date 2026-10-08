from datetime import datetime, UTC
import httpx
from typing import List, Dict, Any, Optional
from config import OLLAMA_URL, OLLAMA_MODEL
from services.led_tool import (
    control_leds,
    get_led_status,
    set_traffic_preset,
    control_leds_timed,
    parse_duration,
    run_traffic_sequence,
    cancel_traffic_sequence,
    control_lamp,
)

async def get_ollama_models(base_url: Optional[str] = None) -> List[str]:
    url = base_url or OLLAMA_URL
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{url}/api/tags")
            if res.status_code == 200:
                data = res.json()
                if "models" in data and isinstance(data["models"], list):
                    return [m.get("name") or m.get("model") for m in data["models"] if m]
    except Exception as e:
        print("Could not fetch Ollama models:", e)
    return []

async def process_ollama_command(
    input_text: str,
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    opts = options or {}
    base_url = OLLAMA_URL
    model_name = opts.get("model") or OLLAMA_MODEL

    system_prompt = """You are Johnwick, an AI Copilot connected to a Traffic Light hardware controller (Red on GPIO 27, Yellow on GPIO 22, Green on GPIO 23) and a Lamp relay on GPIO 17.

Available Tools:
- control_led(color, state): color='red'|'yellow'|'green'|'all', state='ON'|'OFF'|'TOGGLE'
- control_lamp(state): state='ON'|'OFF'|'TOGGLE'
- control_led_timed(color, duration): color='red'|'yellow'|'green'|'lamp'|'all', duration='10s'|'5 minutes'
- run_traffic_sequence(sequence): Run a custom sequence like green 30s, yellow 5s, red 20s
- set_traffic_preset(mode): mode='red'|'yellow'|'green'|'off'|'all'
- get_led_status(): Check live state of Red, Yellow, and Green LEDs and Lamp Relay.

Instructions:
- If user wants to turn on/off/toggle a specific LED, call control_led.
- If user wants to turn on/off/toggle the lamp, call control_lamp.
- If user wants a timed light or lamp, call control_led_timed.
- If user asks for a custom traffic mode or cycle with a specific order and durations, call run_traffic_sequence.
- If user asks to stop, cancel, or turn off traffic mode, call cancel_traffic_sequence.
- If user wants to turn on/off all lights, call control_led(color='all', state=...).
- If user wants traffic mode (red only, green only, etc.), call set_traffic_preset.
- If user asks for status of lights or lamp, call get_led_status.
- Keep responses short, direct, and conversational."""

    messages = [{"role": "system", "content": system_prompt}]
    history = opts.get("history")
    if isinstance(history, list):
        for h in history:
            if isinstance(h, dict) and h.get("content") and str(h["content"]).strip():
                role = "user" if h.get("role") == "user" else "assistant"
                messages.append({"role": role, "content": str(h["content"]).strip()})
    messages.append({"role": "user", "content": input_text})

    tools = [
        {
            "type": "function",
            "function": {
                "name": "control_led",
                "description": "Control an LED (red, yellow, green, or all) state (ON, OFF, TOGGLE).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "color": {"type": "string", "enum": ["red", "yellow", "green", "all"]},
                        "state": {"type": "string", "enum": ["ON", "OFF", "TOGGLE"]}
                    },
                    "required": ["color", "state"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "control_lamp",
                "description": "Control the relay-powered lamp (ON, OFF, TOGGLE).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "state": {"type": "string", "enum": ["ON", "OFF", "TOGGLE"]}
                    },
                    "required": ["state"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "control_led_timed",
                "description": "Control an LED or lamp and automatically turn it OFF after the specified duration.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "color": {"type": "string", "enum": ["red", "yellow", "green", "lamp", "all"]},
                        "duration": {"type": "string", "description": "e.g. 10s, 30s, 5 minutes, 1 hour"}
                    },
                    "required": ["color", "duration"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "run_traffic_sequence",
                "description": "Execute a custom multi-step traffic light sequence.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sequence": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "color": {"type": "string", "enum": ["red", "yellow", "green"]},
                                    "duration": {"type": "string"}
                                },
                                "required": ["color", "duration"]
                            }
                        }
                    },
                    "required": ["sequence"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "cancel_traffic_sequence",
                "description": "Stop any active traffic cycle and turn off all lights.",
                "parameters": {"type": "object", "properties": {}}
            }
        },
        {
            "type": "function",
            "function": {
                "name": "set_traffic_preset",
                "description": "Activate a traffic light preset mode (red, yellow, green, off, all).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "mode": {"type": "string", "enum": ["red", "yellow", "green", "off", "all"]}
                    },
                    "required": ["mode"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_led_status",
                "description": "Get current state of all traffic light LEDs and the lamp.",
                "parameters": {"type": "object", "properties": {}}
            }
        }
    ]

    payload = {
        "model": model_name,
        "messages": messages,
        "stream": False,
        "tools": tools
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(f"{base_url}/api/chat", json=payload)
            if res.status_code != 200:
                err_msg = f"Ollama error: HTTP {res.status_code} - {res.text}"
                return {
                    "success": False,
                    "error": err_msg,
                    "reply": err_msg,
                    "response": err_msg,
                    "action": "error",
                    "result": None,
                    "model": model_name,
                    "engine": "ollama",
                    "timestamp": datetime.now(UTC).isoformat()
                }

            data = res.json()
            msg = data.get("message", {})
            content = msg.get("content", "")
            tool_calls = msg.get("tool_calls", [])

            executed_action = "chat_response"
            tool_results = None

            if tool_calls:
                for call in tool_calls:
                    fn = call.get("function", {})
                    fn_name = fn.get("name")
                    fn_args = fn.get("arguments", {})

                    if fn_name == "control_led":
                        color = fn_args.get("color")
                        state = fn_args.get("state")
                        tool_results = control_leds(color=color, state=state)
                        executed_action = f"control_led({color}, {state})"
                    elif fn_name == "control_lamp":
                        state = fn_args.get("state")
                        tool_results = control_lamp(state=state)
                        executed_action = f"control_lamp({state})"
                    elif fn_name == "control_led_timed":
                        color = fn_args.get("color")
                        duration = fn_args.get("duration")
                        tool_results = control_leds_timed(color=color, duration=duration)
                        executed_action = f"control_led_timed({color}, {duration})"
                    elif fn_name == "run_traffic_sequence":
                        sequence = fn_args.get("sequence", [])
                        tool_results = run_traffic_sequence(sequence)
                        executed_action = "run_traffic_sequence"
                    elif fn_name == "cancel_traffic_sequence":
                        tool_results = cancel_traffic_sequence()
                        executed_action = "cancel_traffic_sequence"
                    elif fn_name == "set_traffic_preset":
                        mode = fn_args.get("mode")
                        tool_results = set_traffic_preset(mode)
                        executed_action = f"set_traffic_preset({mode})"
                    elif fn_name == "get_led_status":
                        tool_results = get_led_status()
                        executed_action = "get_led_status"

                # Send tool results back to Ollama to generate final response
                messages.append(msg)
                for call in tool_calls:
                    messages.append({
                        "role": "tool",
                        "content": str(tool_results)
                    })

                second_res = await client.post(f"{base_url}/api/chat", json={
                    "model": model_name,
                    "messages": messages,
                    "stream": False
                })

                if second_res.status_code == 200:
                    second_msg = second_res.json().get("message", {})
                    content = second_msg.get("content", content)

            final_text = content or f"Action {executed_action} completed."
            return {
                "success": True,
                "response": final_text,
                "reply": final_text,
                "action": executed_action,
                "actionTaken": executed_action if executed_action != "chat_response" else None,
                "result": tool_results,
                "payload": tool_results,
                "model": model_name,
                "engine": "ollama",
                "timestamp": datetime.now(UTC).isoformat()
            }
    except Exception as e:
        err_msg = f"Failed to execute local Ollama command: {str(e)}"
        return {
            "success": False,
            "error": err_msg,
            "reply": err_msg,
            "response": err_msg,
            "action": "error",
            "result": None,
            "model": model_name,
            "engine": "ollama",
            "timestamp": datetime.now(UTC).isoformat()
        }
