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

    system_prompt = """You are AURA, an AI Copilot connected to a Traffic Light hardware controller (Red on GPIO 27, Yellow on GPIO 22, Green on GPIO 23) and a Lamp relay on GPIO 17.

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
                "description": "Control a specific LED (red, yellow, green) or all LEDs at the same time.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "color": {"type": "string", "enum": ["red", "yellow", "green", "all"], "description": "Target LED color or 'all'"},
                        "state": {"type": "string", "enum": ["ON", "OFF", "TOGGLE"], "description": "Desired state"},
                    },
                    "required": ["color", "state"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "control_lamp",
                "description": "Control the relay-operated lamp (turn on, turn off, toggle).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "state": {"type": "string", "enum": ["ON", "OFF", "TOGGLE"], "description": "Desired lamp state"},
                    },
                    "required": ["state"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "set_traffic_preset",
                "description": "Set traffic light presets: 'red', 'yellow', 'green', 'off', or 'all'.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "mode": {"type": "string", "enum": ["red", "yellow", "green", "off", "all"], "description": "Preset mode"},
                    },
                    "required": ["mode"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_led_status",
                "description": "Get current state of all LED lights (Red, Yellow, Green) and Lamp Relay.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "control_leds_timed",
                "description": "Execute a timed light or lamp control.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "color": {"type": "string", "enum": ["red", "yellow", "green", "lamp", "all"], "description": "Target light or lamp"},
                        "duration": {"type": "string", "description": "Duration like '10s' or '5 minutes'"},
                    },
                    "required": ["color", "duration"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "run_traffic_sequence",
                "description": "Run a custom traffic light sequence in order. Example: green 30s then yellow 5s then red 20s.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sequence": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "color": {"type": "string", "enum": ["red", "yellow", "green"]},
                                    "duration": {"type": "string", "description": "Duration like '30s' or '5 minutes'"},
                                },
                                "required": ["color", "duration"],
                            },
                        },
                    },
                    "required": ["sequence"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "cancel_traffic_sequence",
                "description": "Stop any active traffic cycle and turn all lights off.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                },
            },
        },
    ]

    iterations = 0
    max_iterations = 3
    final_content = ""
    executed_action = "ollama_chat_response"
    tool_results = None

    async with httpx.AsyncClient(timeout=45.0) as client:
        while iterations < max_iterations:
            iterations += 1
            res = await client.post(
                f"{base_url}/api/chat",
                json={
                    "model": model_name,
                    "messages": messages,
                    "tools": tools,
                    "stream": False,
                },
            )
            if res.status_code != 200:
                raise RuntimeError(f"Ollama API error ({res.status_code}): {res.text}")

            data = res.json()
            msg = data.get("message", {})
            messages.append(msg)

            if msg.get("content"):
                final_content += ("\n\n" if final_content else "") + msg["content"]

            tool_calls = msg.get("tool_calls", [])
            if tool_calls:
                for tool_call in tool_calls:
                    func = tool_call.get("function", {})
                    name = func.get("name")
                    args = func.get("arguments", {})

                    tool_output: Any = None
                    if name == "control_led":
                        color = str(args.get("color", "all")).lower()
                        state = str(args.get("state", "ON")).upper()
                        tool_output = control_leds(color=color, action=state)  # type: ignore
                        executed_action = f"led_{color}_{state.lower()}"
                        tool_results = tool_output
                    elif name == "control_lamp":
                        state = str(args.get("state", "TOGGLE")).upper()
                        tool_output = control_lamp(action=state)  # type: ignore
                        executed_action = f"lamp_{state.lower()}"
                        tool_results = tool_output
                    elif name == "set_traffic_preset":
                        mode = str(args.get("mode", "off")).lower()
                        tool_output = set_traffic_preset(mode)  # type: ignore
                        executed_action = f"traffic_preset_{mode}"
                        tool_results = tool_output
                    elif name == "run_traffic_sequence":
                        sequence = args.get("sequence") or []
                        if isinstance(sequence, list):
                            parsed_sequence = []
                            for step in sequence:
                                if not isinstance(step, dict):
                                    continue
                                color = str(step.get("color", "")).lower()
                                duration_str = str(step.get("duration", "0s")).strip()
                                duration_seconds = parse_duration(duration_str)
                                if color in {"red", "yellow", "green"} and duration_seconds > 0:
                                    parsed_sequence.append({"color": color, "duration_seconds": duration_seconds})
                            tool_output = run_traffic_sequence(parsed_sequence) if parsed_sequence else {"success": False, "message": "No valid traffic sequence steps were provided."}
                            executed_action = "traffic_sequence"
                            tool_results = tool_output
                    elif name == "cancel_traffic_sequence":
                        tool_output = cancel_traffic_sequence()
                        executed_action = "traffic_sequence_cancelled"
                        tool_results = tool_output
                    elif name == "get_led_status":
                        tool_output = get_led_status()
                        executed_action = "led_status_checked"
                        tool_results = tool_output
                    elif name == "control_leds_timed":
                        color = str(args.get("color", "all")).lower()
                        duration_str = str(args.get("duration", "0s"))
                        durations = parse_duration(duration_str)
                        tool_output = control_leds_timed(color=color, action="ON", duration_seconds=durations)  # type: ignore
                        executed_action = f"leds_timed_{color}_{duration_str}"
                        tool_results = tool_output

                    messages.append({
                        "role": "tool",
                        "content": str(tool_output),
                    })
            else:
                break

    return {
        "success": True,
        "response": final_content.strip() or "Processed command.",
        "actionTaken": executed_action,
        "payload": tool_results,
        "model": f"Ollama Local ({model_name})",
        "timestamp": datetime.now(UTC).isoformat(),
    }
