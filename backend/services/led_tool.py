import os
import asyncio
import re
from datetime import datetime, UTC
from typing import Dict, Any, Literal, List, Optional
from database import get_setting, set_setting, add_log
from config import settings

# Physical board pin -> BCM GPIO mapping for Raspberry Pi.
# Use physical board pins in code, then translate to GPIO for gpiod.
BOARD_PIN_TO_GPIO = {
    3: 2,
    5: 3,
    7: 4,
    8: 14,
    10: 15,
    11: 17,
    12: 18,
    13: 27,
    15: 22,
    16: 23,
    18: 24,
    19: 10,
    21: 9,
    22: 25,
    23: 11,
    24: 8,
    26: 7,
    29: 5,
    31: 6,
    32: 12,
    33: 13,
    35: 19,
    36: 16,
    37: 26,
    38: 20,
    40: 21,
}


def board_pin_to_gpio(board_pin: int) -> int:
    """Convert a Raspberry Pi physical board pin to the BCM GPIO number used by gpiod."""
    return BOARD_PIN_TO_GPIO.get(int(board_pin), int(board_pin))


RED_GPIO = board_pin_to_gpio(settings.RED_PIN)
YELLOW_GPIO = board_pin_to_gpio(settings.YELLOW_PIN)
GREEN_GPIO = board_pin_to_gpio(settings.GREEN_PIN)
LAMP_GPIO = board_pin_to_gpio(settings.LAMP_PIN)

# Timer tracking for timed LED commands
_active_timers: Dict[str, asyncio.Task[Any]] = {}
_active_traffic_cycles: Dict[str, asyncio.Task[Any]] = {}

ColorType = Literal["red", "yellow", "green", "lamp", "all"]
ActionType = Literal["ON", "OFF", "TOGGLE"]

# Hardware Line Request Holder
_gpio_request = None
_gpio_available = False
_gpio_error: Optional[str] = None
_pin_health: Dict[str, Dict[str, Any]] = {
    "red": {"board_pin": settings.RED_PIN, "gpio": RED_GPIO, "last_status": "initialized", "ok": True},
    "yellow": {"board_pin": settings.YELLOW_PIN, "gpio": YELLOW_GPIO, "last_status": "initialized", "ok": True},
    "green": {"board_pin": settings.GREEN_PIN, "gpio": GREEN_GPIO, "last_status": "initialized", "ok": True},
    "lamp": {"board_pin": settings.LAMP_PIN, "gpio": LAMP_GPIO, "last_status": "initialized", "ok": True},
}

try:
    import gpiod
    from gpiod.line import Direction, Value
    from gpiod import LineSettings

    def _make_settings(active_low: bool = False):
        return LineSettings(
            direction=Direction.OUTPUT,
            output_value=Value.ACTIVE if not active_low else Value.INACTIVE,
        )

    if os.path.exists(settings.GPIO_CHIP):
        try:
            gpio_pins = {
                RED_GPIO: _make_settings(active_low=False),
                YELLOW_GPIO: _make_settings(active_low=False),
                GREEN_GPIO: _make_settings(active_low=False),
                LAMP_GPIO: _make_settings(active_low=settings.LAMP_ACTIVE_LOW),
            }
            _gpio_request = gpiod.request_lines(
                settings.GPIO_CHIP,
                consumer="traffic-light",
                config=gpio_pins,
            )
            _gpio_available = True
            print(f"[GPIO Hardware] Connected to {settings.GPIO_CHIP} (Pins: Red={RED_GPIO}, Yellow={YELLOW_GPIO}, Green={GREEN_GPIO}, Lamp={LAMP_GPIO})")
        except Exception as err:
            _gpio_error = str(err)
            print(f"[GPIO Hardware] Failed to request lines on {settings.GPIO_CHIP}: {err}. Using simulated mode.")
    else:
        _gpio_error = f"GPIO chip {settings.GPIO_CHIP} not found"
        print(f"[GPIO Hardware] {settings.GPIO_CHIP} not found. Running in simulated GPIO mode.")
except Exception as e:
    _gpio_error = str(e)
    print(f"[GPIO Hardware] gpiod init notice: {e}. Running in simulated mode.")


def get_hardware_info() -> Dict[str, Any]:
    """Return physical hardware diagnostic status and pin configurations."""
    return {
        "is_hardware_active": _gpio_available,
        "mode": "hardware" if _gpio_available else "simulated",
        "gpio_chip": settings.GPIO_CHIP,
        "error": _gpio_error,
        "pins": {
            "red": {"board_pin": settings.RED_PIN, "gpio": RED_GPIO, "health": _pin_health.get("red")},
            "yellow": {"board_pin": settings.YELLOW_PIN, "gpio": YELLOW_GPIO, "health": _pin_health.get("yellow")},
            "green": {"board_pin": settings.GREEN_PIN, "gpio": GREEN_GPIO, "health": _pin_health.get("green")},
            "lamp": {
                "board_pin": settings.LAMP_PIN,
                "gpio": LAMP_GPIO,
                "active_low": settings.LAMP_ACTIVE_LOW,
                "health": _pin_health.get("lamp"),
            },
        },
    }


def _set_hardware_pin(pin: int, state: str, device_name: str = "pin") -> Dict[str, Any]:
    """
    Sends signal to the physical GPIO pin.
    Returns status reporting whether hardware signal write succeeded, verified, or is simulated.
    """
    if _gpio_available and _gpio_request is not None:
        try:
            import gpiod
            from gpiod.line import Value
            if pin == LAMP_GPIO and settings.LAMP_ACTIVE_LOW:
                expected_val = Value.INACTIVE if state == "ON" else Value.ACTIVE
            else:
                expected_val = Value.ACTIVE if state == "ON" else Value.INACTIVE
            
            _gpio_request.set_value(pin, expected_val)
            
            # Hardware verification: attempt read-back of output line if supported
            verified = True
            try:
                actual_val = _gpio_request.get_value(pin)
                verified = (actual_val == expected_val)
            except Exception:
                verified = True  # Write succeeded even if readback isn't supported
            
            _pin_health[device_name] = {
                "board_pin": settings.LAMP_PIN if device_name == "lamp" else getattr(settings, f"{device_name.upper()}_PIN", pin),
                "gpio": pin,
                "last_status": f"Successfully set to {state}",
                "ok": True,
                "verified": verified,
                "timestamp": datetime.now(UTC).isoformat(),
            }

            return {
                "success": True,
                "mode": "hardware",
                "pin": pin,
                "written": True,
                "verified": verified,
                "message": f"Hardware signal confirmed on GPIO {pin} ({state})",
            }
        except Exception as e:
            error_msg = f"Failed writing to GPIO {pin}: {e}"
            print(f"[GPIO Hardware Error] {error_msg}")
            _pin_health[device_name] = {
                "gpio": pin,
                "last_status": error_msg,
                "ok": False,
                "verified": False,
                "timestamp": datetime.now(UTC).isoformat(),
            }
            return {
                "success": False,
                "mode": "hardware",
                "pin": pin,
                "written": False,
                "verified": False,
                "error": str(e),
                "message": error_msg,
            }

    # Simulated fallback mode
    _pin_health[device_name] = {
        "gpio": pin,
        "last_status": f"Simulated {state}",
        "ok": True,
        "verified": True,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    return {
        "success": True,
        "mode": "simulated",
        "pin": pin,
        "written": False,
        "verified": True,
        "message": f"Simulated mode (no GPIO hardware active for GPIO {pin})",
    }


def get_lamp_state() -> str:
    try:
        val = get_setting("lamp_state", "OFF").upper()
        return "ON" if val == "ON" else "OFF"
    except Exception:
        return "OFF"


def get_led_state(color: Literal["red", "yellow", "green"]) -> str:
    try:
        val = get_setting(f"led_{color}_state", "OFF").upper()
        return "ON" if val == "ON" else "OFF"
    except Exception:
        return "OFF"


def get_all_led_states() -> Dict[str, str]:
    return {
        "red": get_led_state("red"),
        "yellow": get_led_state("yellow"),
        "green": get_led_state("green"),
        "lamp": get_lamp_state(),
    }


def _schedule_broadcast(states: Dict[str, str]) -> None:
    """Schedule WebSocket broadcast of LED & lamp states without blocking."""
    try:
        from websocket_manager import led_state_manager
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(led_state_manager.broadcast_state(states, hardware_info=get_hardware_info()))
        except RuntimeError:
            pass
    except Exception as e:
        print(f"[WebSocket Broadcast Error] {e}")


def set_lamp_state(action: ActionType) -> tuple[str, Dict[str, Any]]:
    current = get_lamp_state()
    if action == "TOGGLE":
        new_state = "OFF" if current == "ON" else "ON"
    else:
        new_state = action.upper()
        if new_state not in ("ON", "OFF"):
            new_state = "ON"

    try:
        set_setting("lamp_state", new_state)
        add_log("lamp_toggle", f"Lamp state changed from {current} to {new_state}")
    except Exception as e:
        print(f"Failed to persist lamp state to DB:", e)

    hw_result = _set_hardware_pin(LAMP_GPIO, new_state, device_name="lamp")
    print(f"[Lamp Hardware] LAMP -> {new_state} ({hw_result['message']})")
    return new_state, hw_result


def control_lamp(action: ActionType = "TOGGLE") -> Dict[str, Any]:
    current = get_lamp_state()
    if action == "TOGGLE":
        target_state = "OFF" if current == "ON" else "ON"
    else:
        target_state = action.upper()
        if target_state not in ("ON", "OFF"):
            target_state = "ON"

    new_state, hw_result = set_lamp_state(target_state)
    states = get_all_led_states()
    speech_text = f"The lamp is now {new_state}"
    msg = f'**Lamp**: "{speech_text}"'

    _schedule_broadcast(states)

    return {
        "success": hw_result.get("success", True),
        "target": "lamp",
        "state": new_state,
        "states": states,
        "hardware": hw_result,
        "message": msg,
        "speechText": speech_text,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def set_single_led(color: Literal["red", "yellow", "green"], action: ActionType) -> tuple[str, Dict[str, Any]]:
    current = get_led_state(color)
    if action == "TOGGLE":
        new_state = "OFF" if current == "ON" else "ON"
    else:
        new_state = action.upper()
        if new_state not in ("ON", "OFF"):
            new_state = "ON"

    # Save to SQLite DB
    try:
        set_setting(f"led_{color}_state", new_state)
        add_log("led_toggle", f"{color.capitalize()} LED state changed from {current} to {new_state}")
    except Exception as e:
        print(f"Failed to persist {color} LED state to DB:", e)

    # Apply to physical GPIO pin
    pin_map = {"red": RED_GPIO, "yellow": YELLOW_GPIO, "green": GREEN_GPIO}
    hw_result = _set_hardware_pin(pin_map[color], new_state, device_name=color)

    print(f"[LED Hardware] {color.upper()} -> {new_state} ({hw_result['message']})")
    return new_state, hw_result


def control_leds(
    color: ColorType = "all",
    action: ActionType = "TOGGLE"
) -> Dict[str, Any]:
    """
    Controls a specific LED (red, yellow, green, lamp) or all LEDs at the same time.
    """
    color_clean = color.lower()
    if color_clean == "lamp":
        return control_lamp(action)

    if color_clean not in ("red", "yellow", "green", "all"):
        color_clean = "all"

    if color_clean == "all":
        # Control all LEDs at once
        current_states = get_all_led_states()
        if action == "TOGGLE":
            target_state: ActionType = "OFF" if any(v == "ON" for v in current_states.values()) else "ON"
        else:
            target_state = action

        hw_results = {}
        for c in ["red", "yellow", "green"]:
            _, hw_res = set_single_led(c, target_state)  # type: ignore
            hw_results[c] = hw_res

        new_states = get_all_led_states()
        speech_text = f"All lights are now {target_state}"
        msg = f'**All LEDs**: "{speech_text}"'

        _schedule_broadcast(new_states)

        return {
            "success": all(r.get("success", True) for r in hw_results.values()),
            "target": "all",
            "states": new_states,
            "hardware": hw_results,
            "message": msg,
            "speechText": speech_text,
            "timestamp": datetime.now(UTC).isoformat(),
        }
    else:
        # Control specific color
        new_state, hw_result = set_single_led(color_clean, action)  # type: ignore
        new_states = get_all_led_states()
        speech_text = f"The {color_clean} light is now {new_state}"
        msg = f'**{color_clean.capitalize()} LED**: "{speech_text}"'

        _schedule_broadcast(new_states)

        return {
            "success": hw_result.get("success", True),
            "target": color_clean,
            "state": new_state,
            "states": new_states,
            "hardware": hw_result,
            "message": msg,
            "speechText": speech_text,
            "timestamp": datetime.now(UTC).isoformat(),
        }


def set_traffic_preset(mode: Literal["red", "yellow", "green", "off", "all"]) -> Dict[str, Any]:
    """
    Sets specific traffic light presets:
    - 'red': Red ON, Yellow OFF, Green OFF
    - 'yellow': Red OFF, Yellow ON, Green OFF
    - 'green': Red OFF, Yellow OFF, Green ON
    - 'off': All OFF
    - 'all': All ON
    """
    mode_clean = mode.lower()
    if mode_clean == "red":
        set_single_led("red", "ON")
        set_single_led("yellow", "OFF")
        set_single_led("green", "OFF")
        speech_text = "Red light active. Stop."
    elif mode_clean == "yellow":
        set_single_led("red", "OFF")
        set_single_led("yellow", "ON")
        set_single_led("green", "OFF")
        speech_text = "Yellow light active. Caution."
    elif mode_clean == "green":
        set_single_led("red", "OFF")
        set_single_led("yellow", "OFF")
        set_single_led("green", "ON")
        speech_text = "Green light active. Go."
    elif mode_clean == "off":
        set_single_led("red", "OFF")
        set_single_led("yellow", "OFF")
        set_single_led("green", "OFF")
        speech_text = "All lights turned off."
    elif mode_clean == "all":
        set_single_led("red", "ON")
        set_single_led("yellow", "ON")
        set_single_led("green", "ON")
        speech_text = "All lights turned on."
    else:
        mode_clean = "off"
        set_single_led("red", "OFF")
        set_single_led("yellow", "OFF")
        set_single_led("green", "OFF")
        speech_text = "All lights turned off."

    states = get_all_led_states()
    
    _schedule_broadcast(states)
    
    return {
        "success": True,
        "preset": mode_clean,
        "states": states,
        "hardware": get_hardware_info(),
        "message": f'**Traffic Preset ({mode_clean.upper()})**: "{speech_text}"',
        "speechText": speech_text,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def get_led_status() -> Dict[str, Any]:
    states = get_all_led_states()
    on_lights = [k for k, v in states.items() if v == "ON"]

    items_summary = []
    for k in ["red", "yellow", "green", "lamp"]:
        if k in states:
            name = "Lamp" if k == "lamp" else f"{k.capitalize()} LED"
            items_summary.append(f"{name}: {states[k]}")

    if len(on_lights) == 0:
        speech_text = "All lights and lamp are currently OFF"
    else:
        speech_text = f"Status: {', '.join(items_summary)}"

    return {
        "success": True,
        "states": states,
        "onLights": on_lights,
        "hardware": get_hardware_info(),
        "message": f'**Hardware Status**: "{speech_text}"',
        "speechText": speech_text,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def parse_duration(duration_str: str) -> int:
    """
    Parses a duration string like '10s', '5min', '2 hours', '1 day' and returns seconds.
    Returns the duration in seconds, or 0 if invalid.
    """
    duration_str = duration_str.strip().lower()
    
    match = re.match(r'^([\d.]+)\s*([a-z]+)?$', duration_str)
    if not match:
        return 0
    
    try:
        value = float(match.group(1))
        unit = match.group(2) or 's'
    except (ValueError, AttributeError):
        return 0
    
    conversions = {
        's': 1, 'sec': 1, 'second': 1, 'seconds': 1,
        'm': 60, 'min': 60, 'minute': 60, 'minutes': 60,
        'h': 3600, 'hr': 3600, 'hour': 3600, 'hours': 3600,
        'd': 86400, 'day': 86400, 'days': 86400,
    }
    
    multiplier = conversions.get(unit, 1)
    return max(1, int(value * multiplier))


async def _auto_turnoff_timer(color: str, duration_seconds: int) -> None:
    """
    Internal coroutine that waits for duration_seconds then turns off the LED or lamp.
    """
    try:
        await asyncio.sleep(duration_seconds)
        
        if color.lower() == "all":
            for c in ["red", "yellow", "green"]:
                set_single_led(c, "OFF")  # type: ignore
            add_log("led_timer", f"All LEDs auto-turned OFF after {duration_seconds}s")
        elif color.lower() == "lamp":
            set_lamp_state("OFF")
            add_log("lamp_timer", f"Lamp auto-turned OFF after {duration_seconds}s")
        else:
            set_single_led(color, "OFF")  # type: ignore
            add_log("led_timer", f"{color} LED auto-turned OFF after {duration_seconds}s")
        
        final_states = get_all_led_states()
        _schedule_broadcast(final_states)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[Timer Error] {color} auto-off failed: {e}")


def control_leds_timed(
    color: str = "all",
    action: str = "ON",
    duration_seconds: int = 0
) -> Dict[str, Any]:
    """
    Controls LED or Lamp with optional auto-turn-off timer.
    """
    if color.lower() == "lamp":
        result = control_lamp(action=action)  # type: ignore
    else:
        result = control_leds(color=color, action=action)  # type: ignore
    
    if action.upper() == "ON" and duration_seconds > 0:
        timer_key = f"timer_{color}"
        if timer_key in _active_timers:
            _active_timers[timer_key].cancel()
        
        try:
            task = asyncio.create_task(_auto_turnoff_timer(color, duration_seconds))
            _active_timers[timer_key] = task
            
            result["timerSeconds"] = duration_seconds
            result["speechText"] += f" (will turn off in {duration_seconds} seconds)"
            result["message"] += f" *scheduled auto-off in {duration_seconds}s*"
        except Exception as e:
            print(f"[Timer Error] Failed to schedule timer for {color}: {e}")
    
    return result


def parse_traffic_sequence(text: str) -> List[Dict[str, Any]]:
    """
    Parses a custom traffic light sequence from natural language.
    """
    clean = text.strip().lower()
    if not clean:
        return []

    pattern = re.compile(
        r"(red|yellow|green)"
        r"(?:\s+(?:light|led))?"
        r"(?:\s+(?:turn|switch|power))?"
        r"(?:\s+on)?"
        r"(?:\s+(?:for|in))?"
        r"\s*([0-9.]+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days)?",
        re.IGNORECASE,
    )

    matches = pattern.findall(clean)
    if len(matches) < 2:
        return []

    sequence: List[Dict[str, Any]] = []
    for color, value, unit in matches:
        try:
            duration_seconds = parse_duration(f"{value}{unit or 's'}")
        except Exception:
            continue
        if duration_seconds <= 0:
            continue
        sequence.append({"color": color.lower(), "duration_seconds": duration_seconds})

    if len(sequence) < 2 or len({step["color"] for step in sequence}) < 2:
        return []

    return sequence


async def _run_traffic_sequence(sequence: List[Dict[str, Any]], loop_forever: bool = True) -> None:
    """Run a custom traffic pattern in order. By default it keeps looping until cancelled."""
    try:
        if not sequence:
            return

        while True:
            for step in sequence:
                color = step["color"]
                seconds = int(step["duration_seconds"])

                for led in ["red", "yellow", "green"]:
                    set_single_led(led, "OFF")
                set_single_led(color, "ON")
                _schedule_broadcast(get_all_led_states())
                await asyncio.sleep(seconds)

            if not loop_forever:
                break

        for led in ["red", "yellow", "green"]:
            set_single_led(led, "OFF")
        _schedule_broadcast(get_all_led_states())
    except asyncio.CancelledError:
        for led in ["red", "yellow", "green"]:
            set_single_led(led, "OFF")
        _schedule_broadcast(get_all_led_states())
        pass
    except Exception as e:
        print(f"[Traffic Cycle Error] {e}")


def run_traffic_sequence(sequence: List[Dict[str, Any]], loop_forever: bool = True) -> Dict[str, Any]:
    """
    Starts a custom traffic-light sequence and keeps it looping by default.
    """
    if not sequence:
        return {
            "success": False,
            "message": "No traffic sequence was provided.",
            "speechText": "No traffic sequence provided.",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    cleaned_sequence: List[Dict[str, Any]] = []
    for step in sequence:
        color = str(step.get("color", "")).lower()
        if color not in {"red", "yellow", "green"}:
            continue
        duration = int(step.get("duration_seconds", 0) or 0)
        if duration <= 0:
            continue
        cleaned_sequence.append({"color": color, "duration_seconds": duration})

    if not cleaned_sequence:
        return {
            "success": False,
            "message": "Traffic sequence contained no valid color-duration steps.",
            "speechText": "Traffic sequence contained no valid steps.",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    for task in list(_active_traffic_cycles.values()):
        task.cancel()
    _active_traffic_cycles.clear()

    task = asyncio.create_task(_run_traffic_sequence(cleaned_sequence, loop_forever=loop_forever))
    cycle_id = f"traffic_cycle_{datetime.now(UTC).timestamp()}"
    _active_traffic_cycles[cycle_id] = task

    summary = " → ".join(f"{step['color']} {step['duration_seconds']}s" for step in cleaned_sequence)
    loop_label = "looping" if loop_forever else "single-run"
    return {
        "success": True,
        "sequence": cleaned_sequence,
        "loop": loop_forever,
        "hardware": get_hardware_info(),
        "message": f'**Traffic Sequence**: "{summary}" started in {loop_label} mode.',
        "speechText": f"Starting {loop_label} traffic sequence: {summary}.",
        "timestamp": datetime.now(UTC).isoformat(),
    }


def cancel_traffic_sequence() -> Dict[str, Any]:
    """Stops any active traffic light cycle and turns all LEDs off."""
    cancelled = False
    for task in list(_active_traffic_cycles.values()):
        task.cancel()
        cancelled = True
    _active_traffic_cycles.clear()

    for led in ["red", "yellow", "green"]:
        set_single_led(led, "OFF")

    states = get_all_led_states()
    _schedule_broadcast(states)
    return {
        "success": True,
        "cancelled": cancelled,
        "states": states,
        "hardware": get_hardware_info(),
        "message": f'**Traffic Sequence**: "Cancelled and all lights turned off."' if cancelled else '**Traffic Sequence**: No active sequence to cancel.',
        "speechText": "Traffic sequence cancelled. All lights are off." if cancelled else "There is no active traffic sequence to cancel.",
        "timestamp": datetime.now(UTC).isoformat(),
    }
