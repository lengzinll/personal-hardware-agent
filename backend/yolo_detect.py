import json
import os
import time
import urllib.error
import urllib.request
import cv2
from ultralytics import YOLO

# ==========================================
# 1. CONFIGURATION
# ==========================================
TRIGGER_DURATION = 5.0  # Time required in seconds (10s)
GRACE_TOLERANCE = 1.5   # 1.5s tolerance to handle occasional missed frames/flicker
SERVER_HOST = os.getenv("SERVER_HOST", "192.168.39.227:8000")

# Load pretrained YOLO model
model = YOLO("yolo11m.pt")

# Camera RTSP URL
rtsp_url = "rtsp://admin:Admin123456@192.168.39.128:554"

# Open RTSP stream
cap = cv2.VideoCapture(rtsp_url)

if not cap.isOpened():
    print("❌ Error: Cannot connect to RTSP camera at", rtsp_url)
    exit(1)

print("=" * 65)
print("  🎥 YOLO PERSON PRESENCE & ABSENCE MONITOR (10s TIMER)")
print("=" * 65)
print(f"• Presence Trigger : Log after {TRIGGER_DURATION:.0f}s of continuous person detection")
print(f"• Absence Trigger  : Log after {TRIGGER_DURATION:.0f}s of continuous no-person")
print("• Press 'Q' in the video window to quit")
print("=" * 65)
print("\nMonitoring video feed...\n")

# State tracking variables
person_first_seen = None
person_last_seen = None
no_person_first_seen = time.time()

person_alert_logged = False
no_person_alert_logged = False


def request_lamp_action(action: str = "TOGGLE"):
    """
    Sends an HTTP POST to control the lamp.
    :param action: "ON", "OFF", or "TOGGLE"
    """
    action_url = f"http://{SERVER_HOST}/api/led/lamp/{action.lower()}"
    try:
        req = urllib.request.Request(
            action_url,
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=1.5) as response:
            if response.status == 200:
                res_data = json.loads(response.read().decode("utf-8"))
                new_state = res_data.get("state", action.upper())
                msg = res_data.get("speechText", f"Lamp is now {new_state}")
                print(f"💡 [HTTP Backend Synced] {msg} (WebSocket broadcasted to UI)")
                return new_state
            else:
                print(f"⚠️ [Backend Error] Status {response.status}")
    except urllib.error.URLError as err:
        print(f"❌ [Backend Offline] Could not reach {action_url} ({err.reason}).")
    except Exception as e:
        print(f"❌ [Request Failed] {e}")
    return None


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
            conf=0.8,
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

            # Trigger presence log and lamp action when 10 seconds threshold is reached
            if person_duration >= TRIGGER_DURATION and not person_alert_logged:
                print(f"👤 [LOG] Person detected! (Present for {person_duration:.1f}s)")
                person_alert_logged = True
                request_lamp_action("ON")

        else:
            # Check if within grace period before dropping person presence
            if person_last_seen is not None and (now - person_last_seen) < GRACE_TOLERANCE:
                person_duration = now - person_first_seen if person_first_seen else 0.0
            else:
                person_first_seen = None
                person_alert_logged = False

                if no_person_first_seen is None:
                    no_person_first_seen = now

                no_person_duration = now - no_person_first_seen

                # Trigger absence log and lamp action when 10 seconds threshold is reached
                if no_person_duration >= TRIGGER_DURATION and not no_person_alert_logged:
                    print(f"🚫 [LOG] No more person (Absent for {no_person_duration:.1f}s)")
                    no_person_alert_logged = True
                    request_lamp_action("OFF")

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

        # Draw HUD badge
        cv2.rectangle(annotated_frame, (10, 10), (360, 45), (0, 0, 0), -1)
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
    request_lamp_action("OFF")
    print("\n👋 Stopped YOLO detector.")
