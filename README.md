# Mag-Cipher: Smart Wire & Fault Scanner Suite

> **Non-destructive, ML-powered electrical fault detection and conduit mapping suite.**

---

## ⚡ Overview

**Mag-Cipher** is an intelligent non-destructive testing (NDT) system combining embedded magnetic & electric field sensing with Machine Learning to:
- 🔍 **Locate energized wire conduits** hidden behind walls.
- ⚡ **Classify conductor state**: `NOT_FOUND`, `HEALTHY`, or `DAMAGED` (broken conductor / insulation breakdown).
- 📊 **Stream live real-time telemetry** (50 Hz) to mobile and web dashboards.
- 🔊 **Provide instant audio-visual and haptic alerts** upon fault detection.

---

## 📁 Repository Structure

```
├── MagCipher_Master_Spec.md    # Master engineering specification & pinout
├── PROJECT_DOCUMENTATION.md    # Complete academic & architectural documentation
├── firmware/                   # Hardware documentation
│   └── WIRING_GUIDE.md         # Hardware schematic & sensor alignment
├── sketch_aug11a/              # ESP32 C++ Arduino firmware
│   └── sketch_aug11a.ino       # 50 Hz Vpp sampling, OLED, LEDs & WebSocket
├── backend/                    # Python FastAPI + scikit-learn ML engine
│   ├── main.py                 # REST endpoints & WebSocket server
│   ├── model.py                # RandomForest classifier & 2-step calibration
│   └── requirements.txt        # Python dependencies
├── web-frontend/               # Vite + React 18 Telemetry Dashboard
│   ├── src/                    # Canvas-based real-time waveform & gauges
│   └── package.json
└── app-frontend/               # React Native (Expo SDK 52) Mobile App
    ├── src/                    # Screens (Scanner, Calibration, Settings)
    └── package.json
```

---

## 🚀 Quick Start Guide

### 1. Backend Server (FastAPI + ML)

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
- API Docs: `http://localhost:8000/docs`
- WebSocket Feed: `ws://localhost:8000/ws/stream`

---

### 2. Web Dashboard (React + Vite)

```bash
cd web-frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

### 3. Mobile App (Expo / React Native)

```bash
cd app-frontend
npm install
npx expo start
```
Scan the QR code with **Expo Go** on your Android device (ensure mobile & PC are on the same Wi-Fi network).

---

## 🧠 Key Features & Architecture

- **2-Step Calibration**: Calibrate using only baseline and healthy wire readings. The damaged boundary is synthesized mathematically without requiring a physically broken wire.
- **Random Forest Classifier**: Robust state classification with interpretable feature weights.
- **Synthetic Fallback Mode**: Test and demonstrate the entire UI/telemetry pipeline even without physical ESP32 hardware connected.
- **Cross-Platform**: Accessible simultaneously from field technician mobile devices and central desktop workstations.

---

## 📄 Documentation

For full system architecture, circuit diagrams, and technical details, refer to:
- [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)
- [MagCipher_Master_Spec.md](MagCipher_Master_Spec.md)

---

## ⚖️ License & Disclaimer

Designed for educational, research, and prototype evaluation purposes. Non-contact voltage detection is indicative and should follow standard electrical safety protocols.
