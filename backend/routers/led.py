from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Literal
from services.led_tool import (
    control_leds,
    get_led_status,
    set_traffic_preset,
    control_lamp,
    get_lamp_state,
    get_lamp_auto_mode,
    set_lamp_auto_mode,
    get_hardware_info,
)

router = APIRouter(prefix="/api/led", tags=["LED Control"])

class LedActionRequest(BaseModel):
    color: Optional[Literal["red", "yellow", "green", "lamp", "all"]] = "all"
    action: Optional[Literal["ON", "OFF", "TOGGLE"]] = "TOGGLE"
    preset: Optional[Literal["red", "yellow", "green", "off", "all"]] = None
    force: Optional[bool] = False
    source: Optional[Literal["manual", "agent", "auto"]] = "manual"

class AutoModeRequest(BaseModel):
    enabled: Optional[bool] = None

@router.get("")
def read_led():
    """Get the live status of all LEDs (Red, Yellow, Green, Lamp) with hardware health and auto mode."""
    return get_led_status()

@router.get("/hardware")
def read_hardware():
    """Get physical hardware diagnostics, pin allocations, and signal health."""
    return get_hardware_info()

@router.post("")
def set_led(body: Optional[LedActionRequest] = None):
    """
    Control a specific LED (red, yellow, green, lamp) or all LEDs at the same time,
    or apply a traffic light preset.
    """
    if body and body.preset:
        return set_traffic_preset(body.preset)

    color = body.color if body and body.color else "all"
    action = body.action if body and body.action else "TOGGLE"
    force = body.force if body and body.force is not None else False
    source = body.source if body and body.source else "manual"

    if color == "lamp":
        return control_lamp(action=action, force=force, source=source)

    return control_leds(color=color, action=action)

# --- Lamp Auto Mode Endpoints ---

@router.get("/lamp/auto")
def get_lamp_auto_status():
    """Check whether automatic detection / endpoint triggers are allowed to control the lamp."""
    return {
        "success": True,
        "auto_mode": get_lamp_auto_mode(),
        "state": get_lamp_state(),
    }

@router.post("/lamp/auto")
def set_lamp_auto_status(body: Optional[AutoModeRequest] = None):
    """Enable or disable Auto Mode for the lamp."""
    if body is not None and body.enabled is not None:
        target_val = body.enabled
    else:
        # Toggle if not explicitly specified
        target_val = not get_lamp_auto_mode()
    return set_lamp_auto_mode(target_val)

# --- Direct Convenience Endpoints for Lamp & Presets ---

@router.get("/lamp/toggle")
@router.post("/lamp/toggle")
def toggle_lamp_endpoint(auto: bool = True, force: bool = False):
    """
    Toggle the lamp relay state (ON <-> OFF).
    If auto=True and Auto Mode is disabled, request is safely ignored.
    """
    source = "auto" if auto and not force else "manual"
    return control_lamp(action="TOGGLE", force=force, source=source)

@router.get("/lamp/on")
@router.post("/lamp/on")
def lamp_on_endpoint(auto: bool = True, force: bool = False):
    """
    Turn the lamp relay ON.
    If auto=True and Auto Mode is disabled, request is safely ignored.
    """
    source = "auto" if auto and not force else "manual"
    return control_lamp(action="ON", force=force, source=source)

@router.get("/lamp/off")
@router.post("/lamp/off")
def lamp_off_endpoint(auto: bool = True, force: bool = False):
    """
    Turn the lamp relay OFF.
    If auto=True and Auto Mode is disabled, request is safely ignored.
    """
    source = "auto" if auto and not force else "manual"
    return control_lamp(action="OFF", force=force, source=source)

@router.get("/lamp")
@router.post("/lamp")
def lamp_endpoint(action: Optional[Literal["ON", "OFF", "TOGGLE"]] = "TOGGLE", auto: bool = False, force: bool = True):
    """Control the lamp relay with a specified action (Defaults to manual/forced)."""
    source = "auto" if auto and not force else "manual"
    return control_lamp(action=action, force=force, source=source)

@router.get("/red")
def red_preset():
    """Activate Red LED only (Traffic Red)."""
    return set_traffic_preset("red")

@router.get("/yellow")
def yellow_preset():
    """Activate Yellow LED only (Traffic Yellow)."""
    return set_traffic_preset("yellow")

@router.get("/green")
def green_preset():
    """Activate Green LED only (Traffic Green)."""
    return set_traffic_preset("green")

@router.get("/off")
def off_preset():
    """Turn all LEDs OFF."""
    return set_traffic_preset("off")

@router.get("/all")
def all_preset():
    """Turn all LEDs ON."""
    return set_traffic_preset("all")

@router.get("/preset/{mode}")
def apply_preset(mode: Literal["red", "yellow", "green", "off", "all"]):
    """Set a specific preset: red, yellow, green, off, all."""
    return set_traffic_preset(mode)
