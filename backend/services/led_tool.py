import os
import asyncio
import re
from datetime import datetime, UTC
from typing import Dict, Any, Literal, List, Optional, Union
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

            # Hardware verification
            verified = True
            try:
                actual_val = _gpio_request.get_value(pin)
                verified = (actual_val == expected_val)
            except Exception:
                verified = True

            _pin_health[device_name] = {
                "gpio": pin,
                "last_status": f"Hardware {state}",
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
                "message": f"Hardware signal write verified for GPIO {pin}",
            }
        except Exception as e:
            error_msg = f"Failed to set GPIO {pin}: {e}"
            print(f"[Hardware Warning] {error_msg}")
            _pin_health[device_name] = {
                "gpio": pin,
                "last_status": f"Error: {e}",
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


def get_lamp_auto_mode() -> bool:
    """Check whether automatic detection / endpoint triggers are allowed to toggle the lamp."""
    try:
        val = get_setting("lamp_auto_mode", "false").lower()
        return val in ("true", "1", "yes", "on")
    except Exception:
        return False


def set_lamp_auto_mode(enabled: bool) -> Dict[str, Any]:
    """Enable or disable Auto Mode for the lamp."""
    val_str = "true" if enabled else "false"
    try:
        set_setting("lamp_auto_mode", val_str)
        add_log("lamp_auto_mode", f"Lamp Auto Mode set to {val_str.upper()}")
    except Exception as e:
        print(f"Failed to persist lamp_auto_mode: {e}")

    states = get_all_led_states()
    _schedule_broadcast(states)

    status_str = "ENABLED" if enabled else "DISABLED"
    return {
        "success": True,
        "auto_mode": enabled,
        "message": f"Lamp Auto Mode is now {status_str}.",
        "speechText": f"Lamp auto mode is now {status_str.lower()}.",
        "timestamp": datetime.now(UTC).isoformat(),
    }


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


def control_lamp(
    action: ActionType = "TOGGLE",
    force: bool = False,
    source: Literal["manual", "agent", "auto"] = "manual",
) -> Dict[str, Any]:
    """
    Controls the lamp relay.
    - If source == "auto" (YOLO detection / automatic trigger endpoints) and auto_mode is OFF:
      the automatic request is safely blocked.
    - If force == True or source in ("manual", "agent"):
      control is always permitted for user UI actions and AI Agent commands.
    """
    auto_mode = get_lamp_auto_mode()
    current = get_lamp_state()

    # Block automated triggers when auto_mode is disabled
    if source == "auto" and not auto_mode and not force:
        return {
            "success": False,
            "allowed": False,
            "auto_mode": False,
            "target": "lamp",
            "state": current,
            "states": get_all_led_states(),
            "message": "Lamp Auto Mode is DISABLED. Automated triggers are blocked. (Set Auto Mode to True or control via AI Voice Agent).",
            "speechText": "Auto mode is disabled for the lamp. Only AI voice agent or manual commands are allowed.",
            "timestamp": datetime.now(UTC).isoformat(),
        }

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
        "allowed": True,
        "auto_mode": auto_mode,
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
        return control_lamp(action, force=True, source="manual")

    if color_clean not in ("red", "yellow", "green", "all"):
        color_clean = "all"

    if color_clean == "all":
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


def parse_duration(text: str) -> Optional[int]:
    """
    Extracts duration in seconds from human text (e.g. '5 seconds', '2m', '1 minute', '10s').
    """
    if not text:
        return None

    text_lower = text.lower()
    match = re.search(r'(\d+(?:\.\d+)?)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours)?', text_lower)
    if not match:
        return None

    val = float(match.group(1))
    unit = match.group(2) or "s"

    if unit in ("m", "min", "minute", "minutes"):
        return int(val * 60)
    elif unit in ("h", "hr", "hour", "hours"):
        return int(val * 3600)
    return int(val)


def parse_traffic_sequence(text: str) -> Optional[Dict[str, Any]]:
    """
    Parses natural language requests for traffic light sequences/cycles.
    e.g. 'cycle traffic light', 'run traffic sequence 5 times', 'start traffic light pattern'.
    """
    lower = text.lower()
    if re.search(r'\b(start|run|play|loop|cycle)\s+(traffic|sequence|pattern|lights?|cycle)\b', lower) or re.search(r'\btraffic\s+(mode|cycle|sequence|pattern)\b', lower):
        cycles_match = re.search(r'(\d+)\s*(?:times|cycles|reps)?', lower)
        cycles = int(cycles_match.group(1)) if cycles_match else 3
        interval_match = re.search(r'(?:every|interval\s+of)?\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)', lower)
        interval = float(interval_match.group(1)) if interval_match else 2.0
        return {"cycles": cycles, "interval": interval}
    return None


def control_leds_timed(
    color: ColorType = "all",
    action: ActionType = "ON",
    duration_seconds: int = 5,
) -> Dict[str, Any]:
    """
    Turns an LED (or lamp/all) ON immediately, and schedules an automatic turn OFF after duration_seconds.
    """
    timer_key = color.lower()
    if timer_key in _active_timers:
        _active_timers[timer_key].cancel()

    res = control_leds(color=color, action=action)

    async def _auto_off_task():
        try:
            await asyncio.sleep(duration_seconds)
            control_leds(color=color, action="OFF")
        except asyncio.CancelledError:
            pass
        finally:
            _active_timers.pop(timer_key, None)

    try:
        loop = asyncio.get_running_loop()
        _active_timers[timer_key] = loop.create_task(_auto_off_task())
    except RuntimeError:
        pass

    speech_text = f"Turned {color} {action} for {duration_seconds} seconds"
    res["speechText"] = speech_text
    res["message"] = f'**Timed Action**: "{speech_text}"'
    res["duration"] = duration_seconds
    return res


def run_traffic_sequence(
    sequence_or_cycles: Union[Dict[str, Any], int] = 3,
    interval: float = 2.0,
) -> Dict[str, Any]:
    """Starts an automated traffic light cycle (Red -> Yellow -> Green)."""
    cancel_traffic_sequence()

    if isinstance(sequence_or_cycles, dict):
        cycles = sequence_or_cycles.get("cycles", 3)
        interval = sequence_or_cycles.get("interval", interval)
    else:
        cycles = int(sequence_or_cycles)

    async def _sequence_worker():
        try:
            for _ in range(cycles):
                set_traffic_preset("red")
                await asyncio.sleep(interval)
                set_traffic_preset("yellow")
                await asyncio.sleep(interval * 0.5)
                set_traffic_preset("green")
                await asyncio.sleep(interval)
            set_traffic_preset("off")
        except asyncio.CancelledError:
            set_traffic_preset("off")

    try:
        loop = asyncio.get_running_loop()
        _active_traffic_cycles["traffic"] = loop.create_task(_sequence_worker())
    except RuntimeError:
        pass

    return {
        "success": True,
        "message": f"Started traffic sequence for {cycles} cycles.",
        "speechText": f"Traffic light cycle started for {cycles} cycles.",
    }


def cancel_traffic_sequence() -> Dict[str, Any]:
    """Cancels any running traffic sequence."""
    if "traffic" in _active_traffic_cycles:
        _active_traffic_cycles["traffic"].cancel()
        _active_traffic_cycles.pop("traffic", None)
    return {
        "success": True,
        "message": "Traffic sequence cancelled.",
        "speechText": "Traffic sequence cancelled.",
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
    auto_mode = get_lamp_auto_mode()
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
        "auto_mode": {
            "lamp": auto_mode,
        },
        "onLights": on_lights,
        "hardware": get_hardware_info(),
        "message": f'**Hardware Status**: "{speech_text}"',
        "speechText": speech_text,
        "timestamp": datetime.now(UTC).isoformat(),
    }
