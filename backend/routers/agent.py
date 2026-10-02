from datetime import datetime, UTC
import re
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
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
)
from services.gemini_service import process_gemini_command
from services.ollama_service import process_ollama_command

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
        # Patterns like "for 10s", "for 5 minutes", "for 3 hours", "for 1 day"
        match = re.search(r'\b(?:for|in)\s+([0-9.]+)\s*([a-z]+)?\b', text)
        if match:
            duration_str = f"{match.group(1)}{match.group(2) or 's'}"
            return parse_duration(duration_str)
        return None

    # Check for duration in the entire command
    duration_seconds = extract_duration(lower)

    # Custom traffic sequence mode first
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

    # 1. Traffic presets
    if re.search(r"\b(traffic\s+red|stop\s+light|only\s+red|red\s+only)\b", lower):
        res = set_traffic_preset("red")
        return {"action": "traffic_preset_red", "result": res}
    if re.search(r"\b(traffic\s+yellow|caution\s+light|only\s+yellow|yellow\s+only)\b", lower):
        res = set_traffic_preset("yellow")
        return {"action": "traffic_preset_yellow", "result": res}
    if re.search(r"\b(traffic\s+green|go\s+light|only\s+green|green\s+only)\b", lower):
        res = set_traffic_preset("green")
        return {"action": "traffic_preset_green", "result": res}

    # 2. All lights ON/OFF (with optional duration)
    if re.search(r"\b(turn\s+on\s+all|all\s+lights?\s+on|all\s+on|everything\s+on|switch\s+on\s+all)\b", lower):
        if duration_seconds and duration_seconds > 0:
            res = control_leds_timed(color="all", action="ON", duration_seconds=duration_seconds)
            return {"action": "led_all_on_timed", "result": res}
        else:
            res = control_leds(color="all", action="ON")
            return {"action": "led_all_on", "result": res}
    if re.search(r"\b(turn\s+off\s+all|all\s+lights?\s+off|all\s+off|everything\s+off|lights?\s+off|switch\s+off\s+all)\b", lower):
        res = control_leds(color="all", action="OFF")
        return {"action": "led_all_off", "result": res}
    if re.search(r"\b(toggle\s+all|all\s+toggle)\b", lower):
        res = control_leds(color="all", action="TOGGLE")
        return {"action": "led_all_toggle", "result": res}

    # 3. Specific Color Controls (Red, Yellow, Green) with optional duration
    for color in ["red", "yellow", "green"]:
        if color in lower:
            if re.search(rf"(turn|switch|power)\s+on(\s+the)?\s+({color}|light|led)|{color}\s+on", lower):
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

    # 4. Generic single light toggle or status
    if re.search(r"\b(turn\s+on\s+(the\s+)?(light|led)|light\s+on|led\s+on)\b", lower):
        if duration_seconds and duration_seconds > 0:
            res = control_leds_timed(color="all", action="ON", duration_seconds=duration_seconds)
            return {"action": "led_all_on_timed", "result": res}
        else:
            res = control_leds(color="all", action="ON")
            return {"action": "led_all_on", "result": res}
    if re.search(r"\b(turn\s+off\s+(the\s+)?(light|led)|light\s+off|led\s+off)\b", lower):
        res = control_leds(color="all", action="OFF")
        return {"action": "led_all_off", "result": res}

    # Lamp controls
    if re.search(r"\b(turn\s+(on|off)|switch\s+(on|off)|power\s+(on|off)|lamp\s+(on|off)|light\s+(on|off))\b", lower) and "lamp" in lower:
        if "off" in lower:
            res = control_lamp("OFF")
            return {"action": "lamp_off", "result": res}
        else:
            res = control_lamp("ON")
            return {"action": "lamp_on", "result": res}
    if re.search(r"\b(toggle\s+lamp|lamp\s+toggle)\b", lower):
        res = control_lamp("TOGGLE")
        return {"action": "lamp_toggle", "result": res}
    if re.search(r"\b(status|check|state|which.*on|is.*(on|off))\b", lower) and re.search(r"(lamp|light)", lower):
        res = get_led_status()
        return {"action": "lamp_status_checked", "result": res}

    if re.search(r"\b(turn\s+on\s+(the\s+)?(lamp|light)|lamp\s+on|light\s+on)\b", lower):
        res = control_lamp("ON")
        return {"action": "lamp_on", "result": res}
    if re.search(r"\b(turn\s+off\s+(the\s+)?(lamp|light)|lamp\s+off|light\s+off)\b", lower):
        res = control_lamp("OFF")
        return {"action": "lamp_off", "result": res}

    return None

@router.post("/command")
async def handle_agent_command(req: AgentCommandRequest):
    input_text = req.command.strip()
    if not input_text:
        return {"success": False, "response": "Please enter a command for your Personal Agent."}

    add_log("agent_command", f'Received command: "{input_text}"')
    user_api_key = req.apiKey.strip() if req.apiKey else GEMINI_API_KEY.strip()
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

    # Local Rule-based Parser
    local_match = parse_local_led_command(input_text)
    if local_match:
        res_data = local_match["result"]
        return {
            "success": True,
            "command": input_text,
            "response": res_data.get("message", "Command executed."),
            "actionTaken": local_match["action"],
            "payload": res_data,
            "model": "Local LED Hardware Engine",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    return {
        "success": True,
        "command": input_text,
        "response": f'Received: "{input_text}". You can control lights with: "Turn on Red", "Turn off Yellow", "Turn on Green", "Turn on all lights", "All off", or "Traffic Red".',
        "actionTaken": "general_command_processed",
        "payload": None,
        "model": "Local LED Hardware Engine",
        "timestamp": datetime.now(UTC).isoformat(),
    }
