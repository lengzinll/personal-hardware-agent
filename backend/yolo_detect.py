import time
import json
import urllib.request
import urllib.error
import cv2
from ultralytics import YOLO

# ==========================================
# 1. CONFIGURATION
# ==========================================
TRIGGER_DURATION = 30.0  # 30 seconds timer
GRACE_TOLERANCE = 1.5   # 1.5s tolerance to handle occasional missed frames/flicker

SERVER_HOST = "192.168.39.227:8000"
LAMP_ON_URL = f"http://{SERVER_HOST}/api/led/lamp/on"
LAMP_OFF_URL = f"http://{SERVER_HOST}/api/led/lamp/off"
STATUS_URL = f"http://{SERVER_HOST}/api/led/lamp/auto"

# Load pretrained YOLO model
model = YOLO("yolo11n.pt")

# Camera RTSP URL
rtsp_url = "rtsp://admin:Admin123456@192.168.39.128:554"


def send_lamp_command(action: str):
    """Sends HTTP request to turn the lamp ON or OFF."""
    target_url = LAMP_ON_URL if action.upper() == "ON" else LAMP_OFF_URL
    try:
        req = urllib.request.Request(
            target_url,
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=1.5) as response:
            if response.status == 200:
                res_data = json.loads(response.read().decode("utf-8"))
                if res_data.get("allowed", True):
                    new_state = res_data.get("state", action.upper())
                    msg = res_data.get("speechText", f"Lamp is now {new_state}")
                    print(f"💡 [HTTP Backend Response] {msg} (WebSocket Synced to UI)")
                else:
                    print(f"🔒 [Auto Mode OFF] Backend skipped automatic lamp {action.upper()}: {res_data.get('message')}")
    except urllib.error.URLError as err:
        print(f"❌ [Backend Offline] Could not reach {target_url} ({err.reason}).")
    except Exception as e:
        print(f"❌ [Request Failed] {e}")


def check_auto_mode():
    """Check if Auto Mode is enabled on the backend."""
    try:
        req = urllib.request.Request(STATUS_URL, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=1.0) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                return data.get("auto_mode", False)
    except Exception:
        pass
    return False


# Open RTSP stream
cap = cv2.VideoCapture(rtsp_url)

if not cap.isOpened():
    print(f"❌ Error: Cannot connect to RTSP camera at {rtsp_url}")
    exit(1)

is_auto_on = check_auto_mode()

print("=" * 68)
print("  🎥 YOLO PERSON PRESENCE & ABSENCE MONITOR (30s AUTO-LAMP)")
print("=" * 68)
print(f"• Backend Target   : {SERVER_HOST}")
print(f"• Lamp Auto Mode   : {'ENABLED (Will trigger lamp)' if is_auto_on else 'DISABLED (Only AI/Manual allowed)'}")
print(f"• Presence Trigger : Turn ON after {TRIGGER_DURATION:.0f}s of continuous person presence")
print(f"• Absence Trigger  : Turn OFF after {TRIGGER_DURATION:.0f}s of continuous absence")
print("• Press 'Q' in the video window to quit")
print("=" * 68)
print("\nMonitoring video feed...\n")

person_first_seen = None
person_last_seen = None
no_person_first_seen = time.time()

person_alert_logged = False
no_person_alert_logged = False

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("⚠️ Failed to read frame from RTSP stream")
            time.sleep(0.5)
            continue

        now = time.time()
        frame = cv2.resize(frame, (640, 480))

        # Run YOLO detection for class 0 (person)
        results = model.predict(
            source=frame,
            conf=0.45,
            classes=[0],  # 0 is 'person' in COCO
            imgsz=640,
            verbose=False,
        )

        boxes = results[0].boxes
        has_person = boxes is not None and len(boxes) > 0

        # ==========================================
        # 2. PRESENCE & ABSENCE TIMERS
        # ==========================================
        if has_person:
            person_last_seen = now

            if person_first_seen is None:
                person_first_seen = now

            # Reset absence timer
            no_person_first_seen = None
            no_person_alert_logged = False

            person_duration = now - person_first_seen

            # Trigger presence after 30 seconds
            if person_duration >= TRIGGER_DURATION and not person_alert_logged:
                print(f"\n👤 [LOG] Person detected continuously for {person_duration:.1f}s!")
                send_lamp_command("ON")
                person_alert_logged = True

        else:
            # Check if within grace tolerance before dropping presence
            if person_last_seen is not None and (now - person_last_seen) < GRACE_TOLERANCE:
                person_duration = now - person_first_seen if person_first_seen else 0.0
            else:
                person_first_seen = None
                person_alert_logged = False

                if no_person_first_seen is None:
                    no_person_first_seen = now

                no_person_duration = now - no_person_first_seen

                # Trigger absence after 30 seconds
                if no_person_duration >= TRIGGER_DURATION and not no_person_alert_logged:
                    print(f"\n🚫 [LOG] No more person (Absent for {no_person_duration:.1f}s)!")
                    send_lamp_command("OFF")
                    no_person_alert_logged = True

        # ==========================================
        # 3. VISUAL HUD ON VIDEO FEED
        # ==========================================
        annotated_frame = results[0].plot()

        if has_person or (person_last_seen and (now - person_last_seen) < GRACE_TOLERANCE):
            dur = now - (person_first_seen or now)
            hud_text = f"Person Present: {dur:.1f}s / {TRIGGER_DURATION:.0f}s"
            color = (0, 255, 0) if dur >= TRIGGER_DURATION else (0, 200, 255)
        else:
            dur = now - (no_person_first_seen or now)
            hud_text = f"No Person: {dur:.1f}s / {TRIGGER_DURATION:.0f}s"
            color = (0, 0, 255) if dur >= TRIGGER_DURATION else (180, 180, 180)

        cv2.rectangle(annotated_frame, (10, 10), (380, 45), (0, 0, 0), -1)
        cv2.putText(
            annotated_frame,
            hud_text,
            (18, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            color,
            2,
        )

        cv2.imshow("YOLO RTSP Detection", annotated_frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

finally:
    cap.release()
    cv2.destroyAllWindows()
    print("\n👋 Stopped YOLO detector.")
