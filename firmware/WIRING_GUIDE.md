# Mag-Cipher Wand Hardware Wiring & Assembly Guide

This document details the exact hardware schematic, pinouts, and sensor alignment for the **Mag-Cipher Smart Wire & Fault Scanner** wand.

---

## 🔌 1. Pinout Connection Matrix

### 1.1 I²C Shared Bus
The ESP32 communicates with the **ADS1115 (16-bit ADC)**, **MPU6050 (6-DOF IMU)**, and **SSD1306 OLED Display** over the primary I²C bus:

| ESP32 Pin | ADS1115 Pin | MPU6050 Pin | SSD1306 OLED | Description |
|---|---|---|---|---|
| **3V3** | VDD | VCC | VCC | 3.3V System Power |
| **GND** | GND | GND | GND | Common Ground Reference |
| **GPIO 21** | SDA | SDA | SDA | I²C Data Line |
| **GPIO 22** | SCL | SCL | SCL | I²C Clock Line |
| **GND** | ADDR | — | — | Sets ADS1115 I²C Address to `0x48` |
| — | — | AD0 (to GND) | — | Sets MPU6050 I²C Address to `0x68` |
| — | — | — | Address `0x3C` | 128×64 Monochrome OLED Display |

---

### 1.2 Hardware Feedback & Indicator Pins (from `sketch_aug11a.ino`)

| ESP32 Pin | Hardware Component | Logic / Role |
|---|---|---|
| **GPIO 15** | **RED LED** | High during **DAMAGED** wire fault state |
| **GPIO 2** | **GREEN LED** | High during **LIVE** wire healthy state |
| **GPIO 5** | **BLUE LED** | High when WebSocket backend client is connected |
| **GPIO 4** | **Buzzer** | Active High alert siren during **DAMAGED** fault |

---

### 1.3 Analog Sensing Array (Connected to ADS1115)

| Sensor | Sensor Pin | ADS1115 Pin | Signal Description |
|---|---|---|---|
| **SS49E Hall #1** | OUT | **A0** | Channel 1 Magnetic Flux Peak-to-Peak (`s1`) |
| **SS49E Hall #2** | OUT | **A1** | Channel 2 Magnetic Flux Peak-to-Peak (`s2`) |
| **SS49E Hall #3** | OUT | **A2** | Channel 3 Magnetic Flux Peak-to-Peak (`s3`) |
| **NCV Antenna Probe** | Signal Out | **A3** | Capacitive AC Electric Field Peak-to-Peak (`ncv`) |

*Note: All three SS49E Hall sensors are powered via `3V3` and `GND`.*

---

## 📐 2. Spatial Sensor Alignment on Wand Head

To reliably detect conduit orientation and flux leakage from insulation breaks, arrange the sensors in a **triangular/collinear array**:

```
            [ NCV Copper Foil Antenna ]
                        ▲
                        │ (Tip of Wand)
            ┌───────────┴───────────┐
            │   [SS49E Hall 2]      │ (Center / Axis Y)
            │          ▲            │
    [SS49E] ├─── 12mm ─┼─── 12mm ───┤ [SS49E]
    (Hall 1)│          │            │ (Hall 3)
   (Left/X-)│     [MPU6050 IMU]     │ (Right/X+)
            └───────────────────────┘
```

- **NCV Antenna**: Copper foil (approx 15mm × 25mm) wrapped in heat-shrink tubing at the very tip of the wand. A high-value resistor (1MΩ to GND) can be placed to bleed static charge.
- **Differential Hall Gradients**: S1 and S3 measure lateral flux deviation, while S2 measures center wire proximity.

---

## 🛠️ 3. Required Arduino Libraries

In Arduino IDE (or PlatformIO), install the following libraries via the Library Manager:
1. `Adafruit ADS1X15` (by Adafruit)
2. `Adafruit MPU6050` & `Adafruit Unified Sensor` (by Adafruit)
3. `Adafruit SSD1306` & `Adafruit GFX Library` (by Adafruit)
4. `ArduinoWebsockets` (by Gil Maimon)
5. `ArduinoOTA` & `ESPmDNS` (built-in ESP32 core)

---

## ⚡ 4. Hardware Sketch Location & Flashing

1. Open `sketch_aug11a/sketch_aug11a.ino` in Arduino IDE.
2. Select Board: **ESP32 Dev Module**.
3. Set Upload Speed: **921600** (or 115200).
4. Verify your Wi-Fi credentials in `ssid` and `password`.
5. Click **Upload**.
6. The OLED and Serial Monitor will show the connected IP address (e.g. `192.168.0.170`).
7. The Python ML backend will automatically connect, read raw sensor telemetry at 50 Hz, and send back real-time `STATE:CONFIDENCE` classification commands to control the OLED display, LEDs, and Buzzer.
