# Mag-Cipher: Smart Wire & Fault Scanner Suite
**System Architecture & Technical Specification Document v2.0**

---

## 1. Project Overview & Objective

Mag-Cipher is a non-destructive testing wand utilizing an **ESP32 microcontroller**, an **ADS1115 16-bit ADC**, three **SS49E linear Hall-effect sensors**, an **MPU6050 6-DOF IMU**, and an **AC Non-Contact Voltage (NCV)** probe.

The wand detects energized electrical conduits embedded in walls and identifies wire breaks, cuts, or damaged insulation by capturing electric and magnetic field flux gradients.

The system connects over local Wi-Fi to a single unified **Python FastAPI Machine Learning** backend, which streams inferences and telemetry to:
1. An **Android Mobile App** built with React Native (Expo Go) featuring real-time waveforms, state cards, audio cues, and `expo-haptics`.
2. A **Web Dashboard** built with React + Vite featuring real-time canvas waveforms and a dark technical HUD.

---

## 2. Hardware Telemetry & Communication Protocol

| Component | Specification |
|---|---|
| **Microcontroller** | ESP32 in Station Mode (`WiFi.begin`) with `ArduinoOTA` |
| **Sampling Window** | 20ms AC integration window (Indian 230V / 50Hz grid) |
| **ADC Rate** | ADS1115 at `RATE_ADS1115_860SPS` |
| **Hall Sensors** | 3× SS49E peak-to-peak voltage amplitudes (`s1`, `s2`, `s3`) on A0–A2 |
| **NCV Probe** | Non-Contact Voltage antenna peak-to-peak swing (`ncv`) on A3 |
| **IMU** | MPU6050 accelerometer (`tiltX`, `tiltY`, `tiltZ`) in m/s² |

**ESP32 WebSocket Server** broadcasts at `ws://<ESP32_IP>:8765` every ~20ms:
```json
{
  "s1": 0.042, "s2": 0.038, "s3": 0.041,
  "ncv": 0.352,
  "tiltX": 0.12, "tiltY": -0.05, "tiltZ": 9.81
}
```

---

## 3. Two-Step Adaptive Calibration & ML Engine

The user **never** calibrates against a broken wire. Calibration learns environment boundaries:

### Step 1 — IDLE Baseline (Ambient Air)
- User holds wand in free air, away from wires.
- Collects **100 samples**. Establishes baseline: `μ_idle`, `σ_idle`, `max(ncv_idle)`.
- **Retry Mechanism**: "Retry Idle" button flushes buffer and re-records.

### Step 2 — LIVE Wire Reference (Healthy 230V Standard)
- User places wand against a known powered 230V wire.
- Collects **100 samples**. Establishes healthy envelope: `μ_live`, `min(ncv_live)`, magnetic flux baseline.
- **Retry Mechanism**: "Retry Live" button discards bad readings.

### ML Classifier & Heuristic Boundary
Upon clicking **"Train Model"**:
- Synthetic interpolation models intermediate transition states.
- A **RandomForestClassifier** (+ Gaussian Mixture / Threshold boundary) maps three operational states:

| State | Condition | Visual |
|---|---|---|
| **IDLE** | Signal within ambient baseline noise | Slate Gray `#64748B` |
| **LIVE** | Strong continuous E-field ≥ `Threshold_live` | Emerald Green `#10B981` |
| **DAMAGED** | Field drop into boundary zone / anomalous flux leakage | Crimson Red `#EF4444` + Siren + Haptic |

---

## 4. UI/UX Design System

| Token | Value |
|---|---|
| Base Background | `#08090A` (Deep Obsidian) |
| Surface Panels | `#111317` |
| Borders | `#1E2229` |
| IDLE Color | `#64748B` (Neutral Slate) |
| LIVE Color | `#10B981` (Neon Emerald) |
| DAMAGED Color | `#EF4444` (Crimson Red) |
| Header Font | Inter / Clean Sans |
| Telemetry Font | JetBrains Mono / Courier New |

### Visual Components
- Real-time animated Canvas/SVG line graphs for NCV and S1–S3
- 3-Axis dynamic tilt orientation indicator
- Full-screen audible beeper and heavy vibration via `expo-haptics` during DAMAGED state

---

## 5. Monorepo Directory Layout

```
mag-cipher-suite/
├── MagCipher_Master_Spec.md
├── PROJECT_DOCUMENTATION.md
├── README.md
├── firmware/
│   └── WIRING_GUIDE.md
├── sketch_aug11a/
│   └── sketch_aug11a.ino
├── backend/
│   ├── main.py
│   ├── model.py
│   ├── requirements.txt
│   └── calibration_store.json
├── app-frontend/
│   ├── package.json
│   ├── App.js
│   ├── app.json
│   └── src/
│       ├── components/
│       │   ├── WaveformChart.js
│       │   ├── StatusBanner.js
│       │   ├── TelemetryGrid.js
│       │   └── CalibrationCard.js
│       └── screens/
│           ├── CalibrationScreen.js
│           └── ScannerScreen.js
└── web-frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        └── components/
            ├── TelemetryHUD.jsx
            ├── WaveformCanvas.jsx
            └── CalibrationWizard.jsx
```

---

## 6. API Contract

| Endpoint | Method | Description |
|---|---|---|
| `/api/connect` | POST | Set ESP32 IP address |
| `/api/calibrate/idle` | POST | Record 100 frames of ambient air |
| `/api/calibrate/live` | POST | Record 100 frames of healthy wire |
| `/api/calibrate/reset/{label}` | POST | Clear/retry a specific calibration step |
| `/api/train` | POST | Fit RandomForestClassifier, return metrics |
| `/ws/stream` | WebSocket | Broadcast real-time classified telemetry |