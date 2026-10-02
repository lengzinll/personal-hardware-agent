import os
import time
import gpiod
from gpiod import LineSettings
from gpiod.line import Direction, Value

GPIO_CHIP = os.getenv("GPIO_CHIP", "/dev/gpiochip0")
RELAY_GPIO = 27  # BCM GPIO27, physical pin 13

# Active-low relay
RELAY_ON = Value.INACTIVE
RELAY_OFF = Value.ACTIVE

with gpiod.request_lines(
    GPIO_CHIP,
    consumer="relay-test",
    config={
        RELAY_GPIO: LineSettings(
            direction=Direction.OUTPUT,
            output_value=RELAY_OFF,
        )
    },
) as request:

    for i in range(5):
        print(f"Cycle {i + 1}: Relay ON")
        request.set_value(RELAY_GPIO, RELAY_ON)
        time.sleep(2)

        print(f"Cycle {i + 1}: Relay OFF")
        request.set_value(RELAY_GPIO, RELAY_OFF)
        time.sleep(2)

    print("Finished")