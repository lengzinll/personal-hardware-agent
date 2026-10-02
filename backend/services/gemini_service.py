from datetime import datetime, UTC
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types
from config import GEMINI_MODEL
from services.led_tool import control_leds, get_led_status, set_traffic_preset, control_leds_timed, parse_duration, run_traffic_sequence, cancel_traffic_sequence, control_lamp

AURA_TOOLS = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="control_led",
            description="Controls a single LED (red, yellow, green) or all LEDs at once. Use this when a user asks to turn on, turn off, or toggle any specific traffic light without specifying a duration.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "color": types.Schema(
                        type=types.Type.STRING,
                        description="The LED to control: 'red', 'yellow', 'green', or 'all'.",
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
            description="Controls an LED and automatically turns it OFF after a specified duration. Use this when a user asks to turn on a light for a specific time (e.g. 'turn green on for 10 seconds', 'turn red on for 5 minutes').",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "color": types.Schema(
                        type=types.Type.STRING,
                        description="The LED to control: 'red', 'yellow', 'green', 'lamp', or 'all'.",
                        enum=["red", "yellow", "green", "lamp", "all"],
                    ),
                    "duration": types.Schema(
                        type=types.Type.STRING,
                        description="Duration to keep the light ON before turning OFF, e.g. '10s', '30s', '5 minutes', '1 hour'.",
                    ),
                },
                required=["color", "duration"],
            ),
        ),
        types.FunctionDeclaration(
            name="set_traffic_preset",
            description="Applies a standard traffic light preset mode: 'red' (Stop), 'yellow' (Caution), 'green' (Go), 'off' (All off), or 'all' (All on).",
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
            description="Checks the current status of all LED lights (Red, Yellow, Green) and the Lamp Relay.",
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
- control_led_timed(color, duration): Controls an LED or lamp and auto-turns it OFF after the specified duration (e.g. color='green', duration='10s' or duration='5 minutes').
- set_traffic_preset(mode): Sets a preset mode ('red', 'yellow', 'green', 'off', 'all').
- get_led_status(): Queries the live state of all 3 LED lights and the lamp relay.
- run_traffic_sequence(sequence): Runs a custom traffic light sequence in order with specified durations.
- cancel_traffic_sequence(): Stops any active traffic cycle and turns all lights OFF.

Instructions:
1. When asked to turn on/off/toggle a specific light without a time duration, call control_led tool.
2. When asked to turn on/off/toggle the lamp, call control_lamp.
3. When asked to control a light WITH a duration (e.g. "turn green on for 10s", "red for 5 minutes"), call control_led_timed with the color and duration.
4. When asked to control all lights at once, call control_led(color='all', state=...).
5. When asked to set a traffic mode, call set_traffic_preset.
6. When asked about light or lamp status, call get_led_status.
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
    if history:
        for msg in history:
            role = msg.get("role")
            content = msg.get("content")
            if role in ("user", "model") and content:
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=content)],
                    )
                )

    # Append the user's latest command
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=input_text)],
        )
    )

    config = types.GenerateContentConfig(
        tools=[AURA_TOOLS],
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.1,
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )

    executed_action = "chat_response"
    tool_results: Any = None
    final_text_parts: List[str] = []

    if response.function_calls:
        tool_content_parts: List[types.Part] = []

        for call in response.function_calls:
            call_name = call.name
            args = call.args or {}

            if call_name == "control_led":
                color = str(args.get("color", "all")).lower()
                state = str(args.get("state", "ON")).upper()
                status = control_leds(color=color, action=state)  # type: ignore
                executed_action = f"led_{color}_{state.lower()}"
                tool_results = status

                tool_content_parts.append(
                    types.Part.from_function_response(
                        name=call_name,
                        response={"result": status},
                    )
                )
            elif call_name == "control_lamp":
                state = str(args.get("state", "TOGGLE")).upper()
                status = control_lamp(action=state)  # type: ignore
                executed_action = f"lamp_{state.lower()}"
                tool_results = status

                tool_content_parts.append(
                    types.Part.from_function_response(
                        name=call_name,
                        response={"result": status},
                    )
                )
            elif call_name == "control_led_timed":
                color = str(args.get("color", "all")).lower()
                duration_str = str(args.get("duration", "0s"))
                duration_seconds = parse_duration(duration_str)

                status = control_leds_timed(color=color, action="ON", duration_seconds=duration_seconds)
                executed_action = f"led_{color}_timed_{duration_seconds}s"
                tool_results = status

                tool_content_parts.append(
                    types.Part.from_function_response(
                        name=call_name,
                        response={"result": status},
                    )
                )
            elif call_name == "set_traffic_preset":
                mode = str(args.get("mode", "off")).lower()
                status = set_traffic_preset(mode)  # type: ignore
                executed_action = f"traffic_preset_{mode}"
                tool_results = status

                tool_content_parts.append(
                    types.Part.from_function_response(
                        name=call_name,
                        response={"result": status},
                    )
                )
            elif call_name == "get_led_status":
                status = get_led_status()
                executed_action = "led_status_checked"
                tool_results = status

                tool_content_parts.append(
                    types.Part.from_function_response(
                        name=call_name,
                        response={"result": status},
                    )
                )
            elif call_name == "run_traffic_sequence":
                sequence_raw = args.get("sequence") or []
                parsed_sequence = []
                if isinstance(sequence_raw, list):
                    for step in sequence_raw:
                        if not isinstance(step, dict):
                            continue
                        color = str(step.get("color", "")).lower()
                        duration_str = str(step.get("duration", "0s")).strip()
                        duration_seconds = parse_duration(duration_str)
                        if color in {"red", "yellow", "green"} and duration_seconds > 0:
                            parsed_sequence.append({"color": color, "duration_seconds": duration_seconds})

                status = run_traffic_sequence(parsed_sequence) if parsed_sequence else {"success": False, "message": "No valid traffic sequence steps provided."}
                executed_action = "traffic_sequence"
                tool_results = status

                tool_content_parts.append(
                    types.Part.from_function_response(
                        name=call_name,
                        response={"result": status},
                    )
                )
            elif call_name == "cancel_traffic_sequence":
                status = cancel_traffic_sequence()
                executed_action = "traffic_sequence_cancelled"
                tool_results = status

                tool_content_parts.append(
                    types.Part.from_function_response(
                        name=call_name,
                        response={"result": status},
                    )
                )

        # Send tool output back to model for conversational response
        followup_contents = list(contents)
        if response.candidates and response.candidates[0].content:
            followup_contents.append(response.candidates[0].content)

        followup_contents.append(
            types.Content(
                role="user",
                parts=tool_content_parts,
            )
        )

        followup_response = client.models.generate_content(
            model=model,
            contents=followup_contents,
            config=config,
        )

        if followup_response.text:
            final_text_parts.append(followup_response.text)

    elif response.text:
        final_text_parts.append(response.text)

    response_text = " ".join(final_text_parts).strip()
    if not response_text and tool_results and isinstance(tool_results, dict):
        response_text = tool_results.get("speechText") or tool_results.get("message") or "Action executed."

    return {
        "success": True,
        "response": response_text,
        "actionTaken": executed_action,
        "payload": tool_results,
        "model": model,
        "timestamp": datetime.now(UTC).isoformat(),
    }
