# Mag-Cipher: Smart Wire & Fault Scanner Suite
## Project Documentation — Technology Stack, Architecture & Implementation

---

### Prepared By: [Your Name / Team Name]
### Academic Session: 2026–27
### Project Category: Embedded Systems × Machine Learning × Full-Stack Development

---

## 1. Executive Summary

**Mag-Cipher** is an intelligent, non-destructive electrical fault detection system that combines embedded hardware sensing with machine learning classification and real-time full-stack telemetry. The system identifies **energized wires**, **locates conduit paths** inside walls, and **detects wire breaks or insulation damage** — all without cutting into surfaces.

The project spans three engineering disciplines:
- **Embedded Systems** (ESP32 + sensors)
- **Machine Learning** (Python + scikit-learn)
- **Full-Stack Software Development** (FastAPI + React Native + React Web)

---

## 2. Technology Stack

### 2.1 Hardware Layer

| Component | Model / Specification | Role |
|---|---|---|
| **Microcontroller** | ESP32 (Dual-core Xtensa LX6, 240 MHz) | Wi-Fi communication, sensor orchestration, WebSocket server |
| **ADC** | ADS1115 (16-bit, 860 SPS, I²C) | High-resolution analog-to-digital conversion for Hall sensors & NCV |
| **Hall-Effect Sensors** | SS49E × 3 (Linear, Analog Output) | Detect magnetic flux gradients around current-carrying conductors |
| **NCV Probe** | Custom antenna (capacitive coupling) | Non-contact AC voltage detection via electric field coupling |
| **IMU** | MPU6050 (6-DOF: 3-axis accel + 3-axis gyro) | Wand orientation tracking for tilt compensation |
| **Communication** | IEEE 802.11 b/g/n Wi-Fi (Station Mode) | Real-time WebSocket streaming at ~50 Hz |

**Sampling Strategy:**
- 20ms integration window matched to the Indian 230V / 50Hz grid standard
- Peak-to-peak amplitude extraction across full AC cycles
- ADS1115 configured at `RATE_ADS1115_860SPS` for maximum resolution

### 2.2 Backend — Python FastAPI + Machine Learning

| Technology | Version | Purpose |
|---|---|---|
| **Python** | 3.11+ | Core runtime language |
| **FastAPI** | ≥ 0.110.0 | Asynchronous REST API & WebSocket server |
| **Uvicorn** | ≥ 0.28.0 | ASGI server with WebSocket support |
| **scikit-learn** | ≥ 1.4.0 | RandomForestClassifier for 3-state wire classification |
| **NumPy** | ≥ 1.26.0 | Numerical computation & feature extraction |
| **Pandas** | ≥ 2.2.0 | Data frame operations for calibration datasets |
| **Joblib** | ≥ 1.3.2 | Efficient model serialization & persistence |
| **websockets** | ≥ 12.0 | ESP32 WebSocket client bridge |

**Why FastAPI?**
- Native `async/await` support for concurrent WebSocket handling
- Automatic OpenAPI documentation generation
- High performance (Starlette + Pydantic under the hood)
- Single codebase serves both mobile app and web dashboard

### 2.3 Mobile App — React Native with Expo

| Technology | Version | Purpose |
|---|---|---|
| **React Native** | 0.76.3 | Cross-platform mobile framework |
| **Expo SDK** | ~52.0.0 | Managed workflow, OTA updates, device APIs |
| **expo-haptics** | ~14.0.0 | Physical vibration feedback for DAMAGED state alerts |
| **expo-av** | ~15.0.0 | Audio playback for audible alarm tones |
| **react-native-svg** | 15.8.0 | Real-time SVG waveform rendering |
| **React Navigation** | 6.x | Screen-to-screen navigation (Calibration ↔ Scanner) |

**Why Expo?**
- Instant testing on physical Android devices via **Expo Go** (no build required)
- Access to native device APIs (haptics, audio, sensors) through managed plugins
- Simplified development workflow for rapid iteration

### 2.4 Web Dashboard — React + Vite

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.3.1 | Component-based UI framework |
| **Vite** | 6.x | Lightning-fast dev server with HMR (Hot Module Replacement) |
| **Canvas API** | Native | GPU-accelerated real-time waveform rendering |
| **Web Audio API** | Native | Browser-based audible alert synthesis for DAMAGED state |
| **WebSocket API** | Native | Real-time bidirectional telemetry streaming |
| **Google Fonts** | Inter + JetBrains Mono | Professional typography (sans-serif + monospace) |

**Why Vite?**
- Near-instant cold start (< 300ms)
- Native ES module support for optimal development speed
- Built-in proxy for seamless backend API/WebSocket integration
- Optimized production builds with code splitting

---

## 3. System Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    HARDWARE LAYER (ESP32)                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ SS49E×3 │  │   NCV   │  │ MPU6050 │  │ ADS1115 │        │
│  │ Hall    │  │ Antenna │  │   IMU   │  │  16-bit │        │
│  │ Sensors │  │  Probe  │  │  6-DOF  │  │   ADC   │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       └─────────────┴───────────┴─────────────┘              │
│                         │                                     │
│              WebSocket Server (ws://:8765)                    │
│              JSON @ 50Hz: {s1,s2,s3,ncv,tiltX,Y,Z}          │
└────────────────────────┬──────────────────────────────────────┘
                         │ Wi-Fi (IEEE 802.11)
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                BACKEND (Python FastAPI)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  ESP32 WS    │  │  Calibration │  │  ML Inference Engine │ │
│  │  Client      │──│  Manager     │──│  RandomForest (3-cls)│ │
│  │  Bridge      │  │  (2-step)    │  │  + Feature Extractor │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  REST API    │  │  WebSocket   │  │  Synthetic Data Gen  │ │
│  │  Endpoints   │  │  Broadcaster │  │  (Fallback Testing)  │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└──────────┬──────────────────┬─────────────────────────────────┘
           │                  │
     REST API          WebSocket /ws/stream
     (Calibrate,       (Classified Telemetry)
      Train, etc.)            │
           │                  │
     ┌─────┴──────┐    ┌─────┴──────┐
     ▼            ▼    ▼            ▼
┌─────────────┐  ┌─────────────────────┐
│ Mobile App  │  │   Web Dashboard     │
│ React Native│  │   React + Vite      │
│ (Expo Go)   │  │   (Canvas Waveforms)│
│             │  │                     │
│ • Haptics   │  │ • Canvas Graphs     │
│ • Audio     │  │ • Web Audio Alert   │
│ • SVG Waves │  │ • Telemetry HUD     │
│ • Tilt Data │  │ • Calibration UI    │
└─────────────┘  └─────────────────────┘
```

---

## 4. Machine Learning Pipeline

### 4.1 Two-Step Adaptive Calibration (No Broken Wire Needed)

The calibration process requires **only two steps** — the system **infers** the damaged state automatically:

| Step | Action | Data Collected | Statistical Output |
|---|---|---|---|
| **Step 1: IDLE** | Hold wand in free air | 100 ambient noise samples | μ_idle, σ_idle, max(ncv_idle) |
| **Step 2: LIVE** | Place wand on powered 230V wire | 100 healthy signal samples | μ_live, σ_live, min(ncv_live) |

### 4.2 Feature Engineering

Six features are extracted from each sensor sample:

| Feature | Formula | Physical Meaning |
|---|---|---|
| `s1` | Raw Hall A0 voltage | Magnetic flux at sensor position 1 |
| `s2` | Raw Hall A1 voltage | Magnetic flux at sensor position 2 |
| `s3` | Raw Hall A2 voltage | Magnetic flux at sensor position 3 |
| `ncv` | Raw NCV probe voltage | Electric field strength |
| `mag_max` | `max(s1, s2, s3)` | Peak magnetic flux across all axes |
| `ncv_diff` | `ncv - mag_max` | Electric-magnetic field differential |

### 4.3 Synthetic DAMAGED Data Generation

Since the user never calibrates against a broken wire, the system generates synthetic DAMAGED-state training data through **statistical interpolation**:

1. **Boundary Zone Modeling**: DAMAGED signals sit between 15–55% of the IDLE→LIVE range
2. **Flux Instability Simulation**: High variance noise (1.5× live σ, 2× idle σ) models the erratic signal behavior at break points
3. **Physical Plausibility Enforcement**: Values are clamped above 0.5× ambient baseline

### 4.4 RandomForestClassifier Configuration

```python
RandomForestClassifier(
    n_estimators=150,        # 150 decision trees
    max_depth=12,            # Controlled depth to prevent overfitting
    min_samples_split=5,     # Minimum samples to split a node
    min_samples_leaf=2,      # Minimum samples at leaf node
    class_weight="balanced", # Handles class imbalance
    random_state=42,         # Reproducible results
    n_jobs=-1                # Parallel training on all CPU cores
)
```

### 4.5 Classification States

| State | Color Code | Detection Logic |
|---|---|---|
| **IDLE** | `#64748B` (Slate) | Signal within ambient baseline noise envelope |
| **LIVE** | `#10B981` (Emerald) | Strong continuous E-field ≥ live threshold |
| **DAMAGED** | `#EF4444` (Crimson) | Field drop into boundary zone + anomalous flux variance |

---

## 5. API Contract

### 5.1 REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | System health check and status |
| `POST` | `/api/connect` | Set ESP32 IP address for WebSocket bridge |
| `POST` | `/api/calibrate/idle` | Record 100 ambient air baseline samples |
| `POST` | `/api/calibrate/live` | Record 100 healthy wire reference samples |
| `POST` | `/api/calibrate/reset/{label}` | Clear/retry calibration for `idle` or `live` |
| `POST` | `/api/train` | Train RandomForestClassifier, return metrics |
| `GET` | `/api/status` | Full system status (connections, calibration, model) |

### 5.2 WebSocket Stream

**Endpoint:** `ws://<BACKEND_IP>:8000/ws/stream`

**Packet Format (JSON, ~50 Hz):**
```json
{
  "s1": 0.042,
  "s2": 0.038,
  "s3": 0.041,
  "ncv": 0.352,
  "tiltX": 0.12,
  "tiltY": -0.05,
  "tiltZ": 9.81,
  "state": "LIVE",
  "confidence": 94.7,
  "timestamp": 1697558400.123,
  "synthetic": false,
  "model_loaded": true
}
```

---

## 6. UI/UX Design System

### 6.1 Theme: Deep Obsidian Technical HUD

| Token | Hex Code | Usage |
|---|---|---|
| Base Background | `#08090A` | Page/screen background |
| Surface Panels | `#111317` | Card backgrounds |
| Borders | `#1E2229` | Panel borders, dividers |
| Text Primary | `#E2E8F0` | Headings, values |
| Text Secondary | `#94A3B8` | Labels, descriptions |
| Text Dim | `#64748B` | Metadata, timestamps |

### 6.2 Typography

| Role | Font | Weight | Tracking |
|---|---|---|---|
| Headers & UI Labels | **Inter** (Google Fonts) | 600–800 | 1–3px |
| Numeric Telemetry | **JetBrains Mono** (Google Fonts) | 400–700 | 0–1.5px |

### 6.3 Status Color System

| State | Primary Color | Glow Effect | Animation |
|---|---|---|---|
| IDLE | `#64748B` Neutral Slate | Subtle shadow | Static |
| LIVE | `#10B981` Neon Emerald | `0 0 20px` green glow | Gentle 2s pulse |
| DAMAGED | `#EF4444` Crimson Red | `0 0 40px` red glow | Rapid 0.5s pulse + scale |

### 6.4 Visual Components

- **Real-time Canvas/SVG Waveform Graphs**: Rolling line charts for NCV and S1/S2/S3
- **Dynamic Status Orb**: Color-coded pulsating sphere reflecting current classification
- **Bento Telemetry Grid**: Card-based sensor value display with monospaced numerics
- **3-Axis Tilt Indicator**: MPU6050 accelerometer data visualization
- **Haptic Feedback** (Mobile): `expo-haptics` error notification pattern
- **Audible Alert**: Web Audio API square-wave oscillator at 880 Hz

---

## 7. Project Directory Structure

```
mag-cipher-suite/
├── MagCipher_Master_Spec.md          # Technical specification document
├── PROJECT_DOCUMENTATION.md          # This file — stack & architecture docs
├── README.md                         # Quick start & project overview
│
├── firmware/                         # Hardware documentation
│   └── WIRING_GUIDE.md               # Sensor wiring & hardware alignment
├── sketch_aug11a/                    # ESP32 C++ Arduino Firmware
│   └── sketch_aug11a.ino             # 50Hz Vpp AC sampling, OLED, LEDs & WebSocket
│
├── backend/                          # Python FastAPI ML Backend
│   ├── main.py                       # Server: REST API + WebSocket + ESP32 bridge
│   ├── model.py                      # ML: Feature extraction, training, prediction
│   ├── requirements.txt              # Python dependencies
│   └── calibration_store.json        # Persisted calibration data
│
├── app-frontend/                     # React Native Mobile App (Expo)
│   ├── App.js                        # Root component & navigation
│   ├── app.json                      # Expo configuration
│   ├── package.json                  # Node.js dependencies
│   └── src/
│       ├── components/
│       │   ├── CalibrationCard.js     # Individual calibration step card
│       │   ├── StatusBanner.js        # Dynamic state indicator banner
│       │   ├── TelemetryGrid.js       # Sensor value bento grid
│       │   └── WaveformChart.js       # SVG rolling waveform graph
│       └── screens/
│           ├── CalibrationScreen.js   # 2-step calibration wizard
│           └── ScannerScreen.js       # Live scanner with haptics + audio
│
└── web-frontend/                     # React + Vite Web Dashboard
    ├── index.html                    # HTML entry with font loading
    ├── package.json                  # Node.js dependencies
    ├── vite.config.js                # Vite config with API proxy
    └── src/
        ├── main.jsx                  # React bootstrap
        ├── index.css                 # Design system (CSS custom properties)
        ├── App.jsx                   # Root component with WebSocket stream
        └── components/
            ├── CalibrationWizard.jsx  # Web calibration interface
            ├── TelemetryHUD.jsx       # Sensor dashboard + status display
            └── WaveformCanvas.jsx     # Canvas-based waveform renderer
```

---

## 8. How to Run

### 8.1 Backend (FastAPI Server)

```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Launch the server on port 8000
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend automatically falls back to **synthetic data generation** if no ESP32 hardware is connected, ensuring the system is fully testable without physical hardware.

### 8.2 Mobile App (Expo / React Native)

```bash
# Navigate to app-frontend directory
cd app-frontend

# Install Node.js dependencies
npm install

# Start Expo development server
npx expo start
```

Then scan the QR code with **Expo Go** on your Android device (connected to the same Wi-Fi network).

> **Note:** Use the in-app **⚙ IP Config** button in the top header to enter your PC's local Wi-Fi IP address (e.g., `192.168.1.xxx`) without needing to modify source code.

### 8.3 Web Dashboard (Vite + React)

```bash
# Navigate to web-frontend directory
cd web-frontend

# Install Node.js dependencies
npm install

# Start Vite dev server
npm run dev
```

Open `http://localhost:5173` in your browser. The Vite proxy automatically routes API calls and WebSocket connections to the backend on port 8000.

### 8.4 ESP32 Hardware Wand (Firmware)

1. Open `sketch_aug11a/sketch_aug11a.ino` in Arduino IDE.
2. Install required libraries: `Adafruit ADS1X15`, `Adafruit MPU6050`, `Adafruit SSD1306`, `Adafruit GFX`, `ArduinoWebsockets`.
3. Set your Wi-Fi credentials in `ssid` and `password`.
4. Connect ESP32 via USB and click **Upload**.
5. The ESP32 will connect to Wi-Fi and broadcast 50 Hz Vpp telemetry at `ws://<ESP32_IP>:8765`.
6. The Python ML backend bridges to the ESP32 and provides two-way synchronization: classifying states and sending `STATE:CONFIDENCE` back to control the OLED display, LEDs (Green/Red/Blue), and Buzzer.
7. Refer to `firmware/WIRING_GUIDE.md` for pinouts and hardware schematic.

---

## 9. Key Design Decisions & Rationale

| Decision | Rationale |
|---|---|
| **2-Step Calibration (no broken wire)** | Users cannot be expected to have a damaged wire available for calibration. The ML model synthesizes the DAMAGED boundary mathematically. |
| **RandomForestClassifier over Neural Networks** | Ensemble tree methods work exceptionally well with small calibration datasets (100 samples) and provide interpretable feature importances. No GPU required. |
| **FastAPI over Flask/Django** | Native async support is essential for concurrent WebSocket streaming to multiple clients. Auto-generated API docs aid development. |
| **Expo over bare React Native** | Expo Go allows instant testing on physical devices without native build toolchains. Critical for rapid development and on-site demonstrations. |
| **Canvas over SVG for web waveforms** | Canvas offers superior rendering performance at 50 Hz update rates with hundreds of data points. SVG is used in the mobile app where react-native-svg is the standard. |
| **Synthetic data fallback** | The system must be demonstrable at any time, even without ESP32 hardware connected. The synthetic generator produces realistic, mode-cycling telemetry. |
| **Web Audio API for browser alerts** | Eliminates the need for external audio files. Generates precise square-wave tones programmatically for the DAMAGED state alert. |

---

## 10. Safety & Compliance Notes

- This system is a **non-destructive testing prototype** designed for educational and research purposes.
- The NCV (Non-Contact Voltage) detection is for **indication only** and should not be used as the sole method to verify the absence of voltage.
- Always follow local electrical safety standards and regulations.
- The wand does not make electrical contact with any live conductor.

---

## 11. Future Scope

1. **Cloud Deployment**: Deploy the FastAPI backend on AWS/GCP with persistent model storage.
2. **Bluetooth Low Energy (BLE)**: Add BLE as an alternative to Wi-Fi for scenarios with no router available.
3. **Deep Learning Upgrade**: Migrate from RandomForest to a 1D-CNN or LSTM for temporal pattern recognition.
4. **iOS Support**: Extend the Expo app to support iOS devices.
5. **3D Conduit Mapping**: Use the MPU6050 IMU data to build spatial wire path maps.

---

*Document generated for academic presentation and evaluation purposes.*
*Mag-Cipher Smart Wire & Fault Scanner Suite © 2026*
