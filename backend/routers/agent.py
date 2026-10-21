from datetime import datetime, UTC
import re
import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, AsyncGenerator
from config import GEMINI_API_KEY, OLLAMA_MODEL
from database import add_log
from services.led_tool import (
    control_leds,
    get_led_status,
    set_traffic_preset,
    control_leds_timed,
    parse_duration,
    parse_traffic_sequence,
    run_traffic_sequence,
    cancel_traffic_sequence,
    control_lamp,
    get_lamp_state,
)
from services.gemini_service import process_gemini_command
from services.ollama_service import process_ollama_command, stream_ollama_command

router = APIRouter(prefix="/api/agent", tags=["Agent"])

class AgentCommandRequest(BaseModel):
    command: str
    apiKey: Optional[str] = ""
    engineMode: Optional[str] = "gemini"
    ollamaModel: Optional[str] = None
    modelName: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None

def parse_local_led_command(text: str) -> Optional[Dict[str, Any]]:
    lower = text.strip().lower()

    # Helper to extract duration from text
    def extract_duration(text: str) -> Optional[int]:
        match = re.search(r'\b(?:for|in)\s+([0-9.]+)\s*([a-z]+)?\b', text)
        if match:
            duration_str = f"{match.group(1)}{match.group(2) or 's'}"
            return parse_duration(duration_str)
        return None

    duration_seconds = extract_duration(lower)

    # 1. Custom traffic sequence mode
    sequence = parse_traffic_sequence(lower)
    if sequence:
        result = run_traffic_sequence(sequence)
        return {"action": "traffic_sequence", "result": result}

    # Cancel traffic sequence
    if re.search(r"\b(cancel|stop|end|off)\s+(traffic|sequence|cycle|loop|pattern)\b|\b(cancel\s+traffic|stop\s+traffic|stop\s+mode)\b|\btraffic\s+(off|stop|cancel)\b", lower):
        res = cancel_traffic_sequence()
        return {"action": "traffic_sequence_cancelled", "result": res}

    if re.search(r"\b(turn\s+off\s+traffic|traffic\s+mode\s+off)\b", lower):
        res = cancel_traffic_sequence()
        return {"action": "traffic_sequence_cancelled", "result": res}

    # 2. Specific Lamp Controls (PRIORITIZED with closed-loop verification)
    # Lamp status check first (so questions like 'is the lamp on' do not trigger turn ON)
    if re.search(r"\b(status|state|check)\b.*\blamp\b|\blamp\b.*\b(status|state|check)\b|\bis\s+(the\s+)?lamp\s+(on|off)\b", lower):
        res = get_led_status()
        return {"action": "lamp_status_checked", "result": res}

    # Turn OFF Lamp
    if re.search(r"\b(turn|switch|power|shut)\s+off\s+(the\s+)?lamp\b|\b(turn|switch|power|shut)\s+(the\s+)?lamp\s+off\b|\blamp\s+off\b|\bshut\s+down\s+(the\s+)?lamp\b", lower):
        res = control_lamp("OFF", force=True, source="agent")
        return {"action": "lamp_off", "result": res}

    # Turn ON Lamp
    if re.search(r"\b(turn|switch|power)\s+on\s+(the\s+)?lamp\b|\b(turn|switch|power)\s+(the\s+)?lamp\s+on\b|\blamp\s+on\b|\blight\s+up\s+(the\s+)?lamp\b", lower):
        if duration_seconds and duration_seconds > 0:
            res = control_leds_timed(color="lamp", action="ON", duration_seconds=duration_seconds)
            return {"action": "lamp_on_timed", "result": res}
        res = control_lamp("ON", force=True, source="agent")
        return {"action": "lamp_on", "result": res}

    # Toggle Lamp
    if re.search(r"\b(toggle|flip)\s+(the\s+)?lamp\b|\blamp\s+(toggle|flip)\b", lower):
        res = control_lamp("TOGGLE", force=True, source="agent")
        return {"action": "lamp_toggle", "result": res}

    # 3. Full System / All Lights ON/OFF (Traffic LEDs + Lamp Relay)
    if re.search(r"\b(turn\s+off\s+all|all\s+lights?\s+off|all\s+off|everything\s+off|shut\s+down\s+all|shut\s+down\s+everything|switch\s+off\s+all|kill\s+all\s+lights?)\b", lower):
        res = control_leds(color="all", action="OFF", include_lamp=True)
        return {"action": "led_all_off", "result": res}

    if re.search(r"\b(turn\s+on\s+all|all\s+lights?\s+on|all\s+on|everything\s+on|switch\s+on\s+all)\b", lower):
        if duration_seconds and duration_seconds > 0:
            res = control_leds_timed(color="all", action="ON", duration_seconds=duration_seconds)
            return {"action": "led_all_on_timed", "result": res}
        else:
            res = control_leds(color="all", action="ON", include_lamp=True)
            return {"action": "led_all_on", "result": res}

    if re.search(r"\b(toggle\s+all|all\s+toggle)\b", lower):
        res = control_leds(color="all", action="TOGGLE", include_lamp=True)
        return {"action": "led_all_toggle", "result": res}

    # 4. Traffic Presets
    if re.search(r"\b(traffic\s+red|stop\s+light|only\s+red|red\s+only)\b", lower):
        res = set_traffic_preset("red")
        return {"action": "traffic_preset_red", "result": res}
    if re.search(r"\b(traffic\s+yellow|caution\s+light|only\s+yellow|yellow\s+only)\b", lower):
        res = set_traffic_preset("yellow")
        return {"action": "traffic_preset_yellow", "result": res}
    if re.search(r"\b(traffic\s+green|go\s+light|only\s+green|green\s+only)\b", lower):
        res = set_traffic_preset("green")
        return {"action": "traffic_preset_green", "result": res}

    # 5. Specific Color Controls (Red, Yellow, Green)
    for color in ["red", "yellow", "green"]:
        if color in lower:
            if re.search(rf"(turn|switch|power)\s+on(\s+the)?\s+({color}|light|led)|{color}\\s+on", lower):
                if duration_seconds and duration_seconds > 0:
                    res = control_leds_timed(color=color, action="ON", duration_seconds=duration_seconds)
                    return {"action": f"led_{color}_on_timed", "result": res}
                else:
                    res = control_leds(color=color, action="ON")  # type: ignore
                    return {"action": f"led_{color}_on", "result": res}
            elif re.search(rf"(turn|switch|power)\s+off(\s+the)?\s+({color}|light|led)|{color}\s+off", lower):
                res = control_leds(color=color, action="OFF")  # type: ignore
                return {"action": f"led_{color}_off", "result": res}
            elif re.search(rf"toggle(\s+the)?\s+({color}|light|led)|{color}\s+toggle", lower):
                res = control_leds(color=color, action="TOGGLE")  # type: ignore
                return {"action": f"led_{color}_toggle", "result": res}

    # 6. Generic single light / lights control (Safely include lamp when ambiguous)
    if re.search(r"\b(turn\s+off\s+(the\s+)?(light|lights|led)|turn\s+(the\s+)?(light|lights|led)\s+off|light\s+off|lights\s+off)\b", lower):
        res = control_leds(color="all", action="OFF", include_lamp=True)
        return {"action": "led_all_off", "result": res}

    if re.search(r"\b(turn\s+on\s+(the\s+)?(light|lights|led)|turn\s+(the\s+)?(light|lights|led)\s+on|light\s+on|lights\s+on)\b", lower):
        # If lamp is off, turn lamp ON; otherwise turn all lights ON
        if get_lamp_state() == "OFF":
            res = control_lamp("ON", force=True, source="agent")
            return {"action": "lamp_on", "result": res}
        else:
            res = control_leds(color="all", action="ON", include_lamp=True)
            return {"action": "led_all_on", "result": res}

    # 7. Overall System Status
    if re.search(r"\b(status|check|system\s+status|hardware\s+status|what.*on)\b", lower):
        res = get_led_status()
        return {"action": "status_checked", "result": res}

    return None

async def stream_agent_command(req: AgentCommandRequest) -> AsyncGenerator[Dict[str, Any], None]:
    """Streams token chunks for real-time typewriter render on client UI."""
    input_text = req.command.strip()
    if not input_text:
        yield {"type": "end", "response": "Please enter a command for your Personal Agent.", "actionTaken": None, "toolPayload": None, "model": "System"}
        return

    add_log("agent_command", f'Received command: "{input_text}"')

    # Check local rule-based match first for instant verified execution
    local_match = parse_local_led_command(input_text)
    if local_match:
        res_data = local_match["result"]
        msg = res_data.get("message", "Command verified and executed.")
        yield {
            "type": "action",
            "actionTaken": local_match["action"],
            "toolPayload": res_data,
            "model": "Local Hardware Engine (Verified)"
        }
        # Stream response smoothly
        words = msg.split(" ")
        for i, w in enumerate(words):
            piece = w if i == 0 else " " + w
            yield {"type": "chunk", "chunk": piece}
            await asyncio.sleep(0.015)

        yield {
            "type": "end",
            "response": msg,
            "actionTaken": local_match["action"],
            "toolPayload": res_data,
            "model": "Local Hardware Engine (Verified)",
            "timestamp": datetime.now(UTC).isoformat()
        }
        return

    user_api_key = req.apiKey.strip() if req.apiKey else ((GEMINI_API_KEY or "").strip())
    ollama_model = req.ollamaModel or OLLAMA_MODEL

    # Direct Ollama Mode Streaming
    if req.engineMode == "ollama":
        try:
            async for event in stream_ollama_command(input_text, options={"model": ollama_model, "history": req.history}):
                yield event
            return
        except Exception as err:
            print("Ollama stream error:", err)

    # Gemini Mode or fallback
    res = await handle_agent_command(req)
    resp_text = res.get("response") or res.get("reply", "Command processed.")
    words = resp_text.split(" ")
    for i, w in enumerate(words):
        piece = w if i == 0 else " " + w
        yield {"type": "chunk", "chunk": piece}
        await asyncio.sleep(0.015)

    yield {
        "type": "end",
        "response": resp_text,
        "actionTaken": res.get("actionTaken"),
        "toolPayload": res.get("payload") or res.get("toolPayload"),
        "model": res.get("model", "Gemini"),
        "timestamp": res.get("timestamp", datetime.now(UTC).isoformat())
    }

@router.post("/command")
async def handle_agent_command(req: AgentCommandRequest):
    input_text = req.command.strip()
    if not input_text:
        return {"success": False, "response": "Please enter a command for your Personal Agent."}

    add_log("agent_command", f'Received command: "{input_text}"')

    # FAST-PATH: Run local rule-based verification FIRST (Mission-Critical / Aircraft-Grade)
    local_match = parse_local_led_command(input_text)
    if local_match:
        res_data = local_match["result"]
        return {
            "success": res_data.get("success", True),
            "command": input_text,
            "response": res_data.get("message", "Command verified and executed."),
            "actionTaken": local_match["action"],
            "payload": res_data,
            "model": "Local Hardware Engine (Verified)",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    user_api_key = req.apiKey.strip() if req.apiKey else ((GEMINI_API_KEY or "").strip())
    ollama_model = req.ollamaModel or OLLAMA_MODEL

    # Direct Ollama Mode
    if req.engineMode == "ollama":
        try:
            result = await process_ollama_command(
                input_text,
                options={"model": ollama_model, "history": req.history},
            )
            return result
        except Exception as err:
            print("Ollama processing error:", err)

    # Gemini Mode with Tool Calling & Auto-Fallback to Ollama
    if user_api_key:
        try:
            result = await process_gemini_command(
                input_text=input_text,
                api_key=user_api_key,
                model_name=req.modelName,
                history=req.history,
            )
            return result
        except Exception as gemini_err:
            print(f"Gemini error, falling back to Ollama: {gemini_err}")
            try:
                result = await process_ollama_command(
                    input_text,
                    options={"model": ollama_model, "history": req.history},
                )
                result["model"] = f"Ollama Fallback ({ollama_model})"
                return result
            except Exception as ollama_err:
                print("Ollama fallback error:", ollama_err)

    return {
        "success": True,
        "command": input_text,
        "response": f'Received: "{input_text}". You can control lights with: "Turn on Red", "Turn off Yellow", "Turn on Green", "Turn off the lamp", "All off", or "Traffic Red".',
        "actionTaken": "general_command_processed",
        "payload": None,
        "model": "Local LED Hardware Engine",
        "timestamp": datetime.now(UTC).isoformat(),
    }
