from datetime import datetime, UTC
from typing import Dict, Any, List, Optional
from google import genai
from google.genai import types
from services.led_tool import control_leds, get_led_status, set_traffic_preset, control_leds_timed, parse_duration, run_traffic_sequence, cancel_traffic_sequence, control_lamp
from config import GEMINI_MODEL

# Define Gemini Function Calling Tools for Multi-LED Control
led_tools = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="control_led",
            description="Controls a specific LED (red, yellow, green) or all LEDs at the same time. Can turn ON, OFF, or TOGGLE.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "color": types.Schema(
                        type=types.Type.STRING,
                        description="Which LED to control: 'red', 'yellow', 'green', or 'all'.",
                        enum=["red", "yellow", "green", "all"],
                    ),
                    "state": types.Schema(
                        type=types.Type.STRING,
                        description="Target state: 'ON', 'OFF', or 'TOGGLE'.",
                        enum=["ON", "OFF", "TOGGLE"],
                    ),
                },
                required=["color", "state"],
            ),
        ),
        types.FunctionDeclaration(
            name="control_led_timed",
            description="Controls an LED and automatically turns it OFF after a specified duration. Useful for commands like 'turn green on for 10 seconds' or 'red light for 5 minutes'.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "color": types.Schema(
                        type=types.Type.STRING,
                        description="Which LED to control: 'red', 'yellow', 'green', or 'all'.",
                        enum=["red", "yellow", "green", "all"],
                    ),
                    "duration": types.Schema(
                        type=types.Type.STRING,
                        description="Duration string like '10s', '5 minutes', '2 hours', '1 day'. Can use 's/sec/second', 'm/min/minute', 'h/hour', 'd/day'.",
                    ),
                },
                required=["color", "duration"],
            ),
        ),
        types.FunctionDeclaration(
            name="set_traffic_preset",
            description="Sets a traffic light mode: 'red' (only red ON), 'yellow' (only yellow ON), 'green' (only green ON), 'off' (all off), or 'all' (all on).",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "mode": types.Schema(
                        type=types.Type.STRING,
                        description="Traffic preset mode: 'red', 'yellow', 'green', 'off', or 'all'.",
                        enum=["red", "yellow", "green", "off", "all"],
                    ),
                },
                required=["mode"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_led_status",
            description="Checks the current status of all LED lights (Red, Yellow, Green).",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={},
            ),
        ),
        types.FunctionDeclaration(
            name="run_traffic_sequence",
            description="Runs a custom traffic light sequence in order, such as green for 30 seconds, then yellow for 5 seconds, then red for 20 seconds. Use this when a user asks for a traffic mode or cycle with custom order and durations.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "sequence": types.Schema(
                        type=types.Type.ARRAY,
                        items=types.Schema(
                            type=types.Type.OBJECT,
                            properties={
                                "color": types.Schema(
                                    type=types.Type.STRING,
                                    description="Traffic light color for this step.",
                                    enum=["red", "yellow", "green"],
                                ),
                                "duration": types.Schema(
                                    type=types.Type.STRING,
                                    description="Duration for this step, like '30s', '5 seconds', '2 minutes'.",
                                ),
                            },
                            required=["color", "duration"],
                        ),
                    ),
                },
                required=["sequence"],
            ),
        ),
        types.FunctionDeclaration(
            name="cancel_traffic_sequence",
            description="Stops any active traffic cycle and turns all lights OFF.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={},
            ),
        ),
        types.FunctionDeclaration(
            name="control_lamp",
            description="Controls the lamp relay. Use this when a user asks to turn the lamp on, off, or toggle it.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "state": types.Schema(
                        type=types.Type.STRING,
                        description="Target lamp state: 'ON', 'OFF', or 'TOGGLE'.",
                        enum=["ON", "OFF", "TOGGLE"],
                    ),
                },
                required=["state"],
            ),
        ),
    ]
)

SYSTEM_INSTRUCTION = """You are AURA, an intelligent AI Copilot connected directly to a Traffic Light hardware controller (Red on GPIO 27, Yellow on GPIO 22, Green on GPIO 23) and a relay-controlled lamp on GPIO 17.

Available Tools:
- control_led(color, state): Controls 'red', 'yellow', 'green', or 'all' LEDs with state 'ON' | 'OFF' | 'TOGGLE'.
- control_lamp(state): Controls the lamp relay with state 'ON' | 'OFF' | 'TOGGLE'.
- control_led_timed(color, duration): Controls an LED and auto-turns it OFF after the specified duration (e.g. color='green', duration='10s' or duration='5 minutes').
- set_traffic_preset(mode): Sets a preset mode ('red', 'yellow', 'green', 'off', 'all').
- get_led_status(): Queries the live state of all 3 LED lights and the lamp.
- run_traffic_sequence(sequence): Runs a custom traffic light sequence in order with specified durations.
- cancel_traffic_sequence(): Stops any active traffic cycle and turns all lights OFF.

Instructions:
1. When asked to turn on/off/toggle a specific light without a time duration, call control_led tool.
2. When asked to turn on/off/toggle the lamp, call control_lamp.
3. When asked to control a light WITH a duration (e.g. "turn green on for 10s", "red for 5 minutes"), call control_led_timed with the color and duration.
4. When asked to control all lights at once, call control_led(color='all', state=...).
5. When asked to set a traffic mode, call set_traffic_preset.
6. When asked about light status, call get_led_status.
7. When asked to run a custom traffic sequence, call run_traffic_sequence with the sequence details.
8. When asked to cancel a traffic sequence, call cancel_traffic_sequence.
9. Be concise, direct, and conversational."""

async def process_gemini_command(
    input_text: str,
    api_key: str,
    model_name: Optional[str] = None,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    client = genai.Client(api_key=api_key.strip())
    model = model_name or GEMINI_MODEL

    contents: List[types.Content] = []

    # Add conversational history if provided
    if history and isinstance(history, list):
        for item in history:
            if not isinstance(item, dict):
                continue
            content_text = item.get("content", "").strip()
            if not content_text:
                continue
            role = "model" if item.get("role") in ("assistant", "model") else "user"
            if not contents and role == "model":
                continue
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=content_text)],
                )
            )

    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=input_text)],
        )
    )

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        tools=[led_tools],
        temperature=0.2,
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )

    response_text = response.text or ""
    executed_action = "chat_response"
    tool_results = None

    if response.function_calls:
        for call in response.function_calls:
            call_name = call.name
            args = call.args or {}

            if call_name == "control_led":
                color = str(args.get("color", "all")).lower()
                state = str(args.get("state", "ON")).upper()
                status = control_leds(color=color, action=state)  # type: ignore
                executed_action = f"led_{color}_{state.lower()}"
                tool_results = status
                response_text += f"\n\n{status['message']}"

            elif call_name == "control_lamp":
                state = str(args.get("state", "TOGGLE")).upper()
                status = control_lamp(action=state)  # type: ignore
                executed_action = f"lamp_{state.lower()}"
                tool_results = status
                response_text += f"\n\n{status['message']}"

            elif call_name == "control_led_timed":
                color = str(args.get("color", "all")).lower()
                duration_str = str(args.get("duration", "10s")).lower()
                duration_seconds = parse_duration(duration_str)
                
                if duration_seconds <= 0:
                    response_text += f"\n\nInvalid duration: {duration_str}. Using default 10 seconds."
                    duration_seconds = 10
                
                status = control_leds_timed(
                    color=color,
                    action="ON",
                    duration_seconds=duration_seconds
                )
                executed_action = f"led_{color}_timed_{duration_seconds}s"
                tool_results = status
                response_text += f"\n\n{status['message']}"

            elif call_name == "set_traffic_preset":
                mode = str(args.get("mode", "off")).lower()
                status = set_traffic_preset(mode)  # type: ignore
                executed_action = f"traffic_preset_{mode}"
                tool_results = status
                response_text += f"\n\n{status['message']}"

            elif call_name == "get_led_status":
                status = get_led_status()
                executed_action = "led_status_checked"
                tool_results = status
                response_text += f"\n\n{status['message']}"

            elif call_name == "run_traffic_sequence":
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
                    status = run_traffic_sequence(parsed_sequence) if parsed_sequence else {"success": False, "message": "No valid traffic sequence steps were provided."}
                    executed_action = "traffic_sequence"
                    tool_results = status
                    response_text += f"\n\n{status['message']}"

            elif call_name == "cancel_traffic_sequence":
                status = cancel_traffic_sequence()
                executed_action = "traffic_sequence_cancelled"
                tool_results = status
                response_text += f"\n\n{status['message']}"

                # Optionally, turn off all LEDs after the sequence
                # control_leds(color="all", action="OFF")

    return {
        "success": True,
        "command": input_text,
        "response": response_text.strip() or "Command processed.",
        "actionTaken": executed_action,
        "payload": tool_results,
        "model": f"Gemini ({model})",
        "timestamp": datetime.now(UTC).isoformat(),
    }
