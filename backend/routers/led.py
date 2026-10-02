from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Literal
from services.led_tool import control_leds, get_led_status, set_traffic_preset

router = APIRouter(prefix="/api/led", tags=["LED Control"])

class LedActionRequest(BaseModel):
    color: Optional[Literal["red", "yellow", "green", "all"]] = "all"
    action: Optional[Literal["ON", "OFF", "TOGGLE"]] = "TOGGLE"
    preset: Optional[Literal["red", "yellow", "green", "off", "all"]] = None

@router.get("")
def read_led():
    """Get the live status of all LEDs (Red, Yellow, Green)."""
    return get_led_status()

@router.post("")
def set_led(body: Optional[LedActionRequest] = None):
    """
    Control a specific LED (red, yellow, green) or all LEDs at the same time,
    or apply a traffic light preset.
    """
    if body and body.preset:
        return set_traffic_preset(body.preset)

    color = body.color if body and body.color else "all"
    action = body.action if body and body.action else "TOGGLE"
    return control_leds(color=color, action=action)

# --- Direct Convenience Endpoints ---

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
