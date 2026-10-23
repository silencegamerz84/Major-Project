"""
Mag-Cipher Backend Server
=========================
FastAPI + WebSocket server that bridges ESP32 hardware telemetry to
the mobile app and web dashboard. Includes calibration endpoints,
ML model training, and real-time classified telemetry streaming.

Features:
- Pure ML inference with Scikit-Learn RandomForestClassifier
- Midpoint synthetic boundary generation for DAMAGED state to reject ambient noise
- Rolling prediction buffer with majority-vote debouncing (smoothing)
- Resilient auto-reconnect with real hardware pause/resume
"""

import warnings
warnings.filterwarnings("ignore")

import asyncio
import json
import math
import random
import time
import logging
from typing import Optional
from contextlib import asynccontextmanager
from collections import deque, Counter

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import websockets

from model import (
    extract_features, generate_synthetic_damaged, train_model,
    load_model, predict, save_store, load_store, reset_feature_buffers
)

# ─────────────────────────────────────────────────────────
# Logging Configuration
# ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-18s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("mag-cipher.server")

# ─────────────────────────────────────────────────────────
# Application State
# ─────────────────────────────────────────────────────────

class AppState:
    """Global application state container."""
    def __init__(self):
        self.esp32_ip: Optional[str] = "192.168.0.170"
        self.esp32_connected: bool = False
        self.esp32_timeout_count: int = 0
        self.esp32_ws = None
        self.model = load_model()
        self.calibration_data = load_store()
        self.is_calibrating: bool = False
        self.calibration_target: Optional[str] = None
        self.calibration_buffer: list = []
        self.connected_clients: set = set()
        self.latest_reading: dict = {}
        self.use_synthetic: bool = False  # Prefer real hardware when IP configured
        self.stream_task: Optional[asyncio.Task] = None

state = AppState()

# ─────────────────────────────────────────────────────────
# Synthetic Data Generator (Fallback when no ESP32 configured)
# ─────────────────────────────────────────────────────────

class SyntheticDataGenerator:
    """
    Generates realistic synthetic sensor data for testing without hardware.
    Simulates three operational modes with smooth transitions.
    """
    def __init__(self):
        self.t = 0.0
        self.mode = "idle"  # idle, live, damaged
        self.mode_timer = 0
        self.transition_progress = 0.0

    def set_mode(self, mode: str):
        self.mode = mode
        self.mode_timer = 0

    def generate(self) -> dict:
        self.t += 0.02  # 20ms steps (50Hz)
        self.mode_timer += 1

        # Auto-cycle through modes every ~10 seconds for demo purposes
        cycle_period = 500  # 10 seconds at 50Hz
        cycle_pos = self.mode_timer % (cycle_period * 3)

        if cycle_pos < cycle_period:
            current_mode = "idle"
        elif cycle_pos < cycle_period * 2:
            current_mode = "live"
        else:
            current_mode = "damaged"

        # Base signals per mode
        if current_mode == "idle":
            s1_base = 0.008 + 0.003 * math.sin(self.t * 0.5)
            s2_base = 0.007 + 0.002 * math.cos(self.t * 0.7)
            s3_base = 0.009 + 0.003 * math.sin(self.t * 0.3)
            ncv_base = 0.015 + 0.008 * math.sin(self.t * 1.2)
        elif current_mode == "live":
            s1_base = 0.180 + 0.015 * math.sin(self.t * 2.0)
            s2_base = 0.165 + 0.012 * math.cos(self.t * 2.2)
            s3_base = 0.175 + 0.014 * math.sin(self.t * 1.8)
            ncv_base = 0.850 + 0.080 * math.sin(self.t * 3.0)
        else:  # damaged
            s1_base = 0.040 + 0.010 * math.sin(self.t * 4.0)
            s2_base = 0.035 + 0.008 * math.cos(self.t * 4.5)
            s3_base = 0.038 + 0.009 * math.sin(self.t * 3.8)
            ncv_base = 0.280 + 0.040 * math.sin(self.t * 5.0)

        # Add Gaussian noise
        s1 = max(0.0, s1_base + random.gauss(0, 0.002))
        s2 = max(0.0, s2_base + random.gauss(0, 0.002))
        s3 = max(0.0, s3_base + random.gauss(0, 0.002))
        ncv = max(0.0, ncv_base + random.gauss(0, 0.005))

        # Simulated accelerometer with slight tilt jitter
        tilt_x = round(0.1 + 0.05 * math.sin(self.t * 0.2) + random.gauss(0, 0.02), 3)
        tilt_y = round(-0.05 + 0.03 * math.cos(self.t * 0.15) + random.gauss(0, 0.02), 3)
        tilt_z = round(9.81 + random.gauss(0, 0.03), 3)

        return {
            "s1": round(s1, 4), "s2": round(s2, 4), "s3": round(s3, 4),
            "ncv": round(ncv, 4),
            "tiltX": tilt_x, "tiltY": tilt_y, "tiltZ": tilt_z,
            "synthetic": True
        }

synthetic_gen = SyntheticDataGenerator()

# ─────────────────────────────────────────────────────────
# Calibration-mode Synthetic Generator (Used ONLY if no hardware IP)
# ─────────────────────────────────────────────────────────

def generate_calibration_sample(mode: str) -> dict:
    """Generate a single calibration sample for the given mode (fallback demo only)."""
    if mode == "idle":
        return {
            "s1": round(random.gauss(0.008, 0.003), 4),
            "s2": round(random.gauss(0.007, 0.002), 4),
            "s3": round(random.gauss(0.009, 0.003), 4),
            "ncv": round(random.gauss(0.015, 0.008), 4),
            "tiltX": round(random.gauss(0.1, 0.05), 3),
            "tiltY": round(random.gauss(-0.05, 0.03), 3),
            "tiltZ": round(random.gauss(9.81, 0.02), 3),
        }
    else:  # live
        return {
            "s1": round(random.gauss(0.180, 0.020), 4),
            "s2": round(random.gauss(0.165, 0.018), 4),
            "s3": round(random.gauss(0.175, 0.019), 4),
            "ncv": round(random.gauss(0.850, 0.100), 4),
            "tiltX": round(random.gauss(0.1, 0.05), 3),
            "tiltY": round(random.gauss(-0.05, 0.03), 3),
            "tiltZ": round(random.gauss(9.81, 0.02), 3),
        }

# ─────────────────────────────────────────────────────────
# ESP32 Connection Manager
# ─────────────────────────────────────────────────────────

async def connect_esp32():
    """Attempt to connect to the ESP32 WebSocket server without ping timeouts."""
    if not state.esp32_ip:
        state.use_synthetic = True
        return

    uri = f"ws://{state.esp32_ip}:8765"
    try:
        if state.esp32_ws:
            try:
                await state.esp32_ws.close()
            except Exception:
                pass
        state.esp32_ws = await asyncio.wait_for(
            websockets.connect(uri, ping_interval=None), timeout=3.0
        )
        was_disconnected = not state.esp32_connected
        state.esp32_connected = True
        state.use_synthetic = False
        state.esp32_timeout_count = 0
        if was_disconnected:
            logger.info(f"✓ Connected to ESP32 at {uri}")
    except Exception as e:
        if state.esp32_connected:
            logger.warning(f"ESP32 disconnected from {uri}: {e}")
        state.esp32_connected = False
        state.use_synthetic = not bool(state.esp32_ip)


async def read_esp32() -> Optional[dict]:
    """Read a single frame from the ESP32 WebSocket with fast disconnect detection."""
    if not state.esp32_connected or not state.esp32_ws:
        return None
    try:
        raw = await asyncio.wait_for(state.esp32_ws.recv(), timeout=1.2)
        state.esp32_timeout_count = 0
        return json.loads(raw)
    except (asyncio.TimeoutError, websockets.ConnectionClosed, Exception) as e:
        state.esp32_timeout_count += 1
        if state.esp32_timeout_count >= 1:
            state.esp32_connected = False
            logger.warning(f"ESP32 disconnected ({e}), attempting auto-reconnect...")
        return None

# ─────────────────────────────────────────────────────────
# ML Inference Worker & Prediction Smoothing Loop
# ─────────────────────────────────────────────────────────

async def esp32_worker():
    """
    Main telemetry & ML inference worker loop:
    1. Reads raw telemetry from ESP32 hardware (or synthetic generator fallback).
    2. Runs pure ML classification via RandomForestClassifier.
    3. Smooths ML predictions using a 5-frame rolling deque buffer with majority voting (mode).
    4. Syncs smoothed state to ESP32 hardware to prevent physical buzzer stutter.
    5. Broadcasts debounced telemetry to connected Web/Mobile frontends.
    6. Automatically pauses calibration/scanning when disconnected, and resumes on reconnection.
    """
    logger.info("esp32_worker ML inference and telemetry loop started")
    last_reconnect_attempt = 0.0

    # Rolling buffers for noise filtering & majority-vote debouncing (10 frames)
    prediction_buffer = deque(maxlen=10)
    ncv_buffer = deque(maxlen=10)
    ncv_tracking_buffer = deque(maxlen=30)

    while True:
        try:
            now = time.time()
            # Auto-reconnect if ESP32 IP is set but disconnected
            if state.esp32_ip and not state.esp32_connected and (now - last_reconnect_attempt > 2.0):
                last_reconnect_attempt = now
                await connect_esp32()

            # Acquire sensor reading
            if not state.esp32_ip:
                raw = synthetic_gen.generate()
            elif not state.esp32_connected:
                raw = {
                    "s1": 0.0, "s2": 0.0, "s3": 0.0, "ncv": 0.0,
                    "tiltX": 0.0, "tiltY": 0.0, "tiltZ": 0.0,
                    "disconnected": True
                }
            else:
                raw = await read_esp32()
                if raw is None:
                    if not state.esp32_connected:
                        raw = {
                            "s1": 0.0, "s2": 0.0, "s3": 0.0, "ncv": 0.0,
                            "tiltX": 0.0, "tiltY": 0.0, "tiltZ": 0.0,
                            "disconnected": True
                        }
                    else:
                        await asyncio.sleep(0.02)
                        continue

            # Classify signal using ML + Median NCV Filter + 10-Frame Majority Debounce
            classified_state = "IDLE"
            confidence = 0.0

            if state.esp32_ip and not state.esp32_connected:
                classified_state = "DISCONNECTED"
                confidence = 0.0
                prediction_buffer.clear()
                ncv_buffer.clear()
                ncv_tracking_buffer.clear()
                reset_feature_buffers()
            elif state.model is not None and not raw.get("disconnected"):
                # Apply 10-frame rolling median filter on NCV reading to strip erratic ambient spikes
                raw_ncv = float(raw.get("ncv", 0))
                ncv_buffer.append(raw_ncv)
                smoothed_ncv = float(np.median(ncv_buffer))
                raw["ncv_raw"] = raw_ncv
                raw["ncv"] = round(smoothed_ncv, 4)

                # Raw Scikit-Learn ML inference
                raw_predicted_state, raw_confidence = predict(raw, state.model)
                
                # Append raw ML prediction to rolling 10-frame buffer
                prediction_buffer.append(raw_predicted_state)

                # Calculate majority vote (mode) across 10 frames
                vote_counts = Counter(prediction_buffer)
                majority_state = vote_counts.most_common(1)[0][0]

                classified_state = majority_state
                confidence = raw_confidence
            else:
                # If no model trained yet, default to IDLE
                classified_state = "IDLE"
                confidence = 0.0

            # NCV DROP DETECTOR (Rule-based break detection alongside ML)
            # Get idle baseline from calibration data
            idle_samples = state.calibration_data.get("idle_samples", [])
            if idle_samples:
                idle_baseline_ncv = float(np.mean([float(s.get("ncv", 0)) for s in idle_samples]))
            else:
                idle_baseline_ncv = 0.02  # fallback default

            tracking_level = 0.0
            near_wire = False

            if not raw.get("disconnected") and classified_state != "DISCONNECTED":
                # Maintain 30-frame tracking buffer
                ncv_tracking_buffer.append(float(raw.get("ncv", 0)))
                if len(ncv_tracking_buffer) >= 10:
                    tracking_level = float(np.percentile(list(ncv_tracking_buffer), 75))
                    current_ncv = float(raw.get("ncv", 0))
                    
                    # Only activate if we are actually near a wire (tracking level meaningfully above baseline)
                    near_wire = tracking_level > (idle_baseline_ncv * 1.5 + 0.01)
                    
                    if near_wire:
                        drop_threshold = idle_baseline_ncv + 0.3 * (tracking_level - idle_baseline_ncv)
                        if current_ncv < drop_threshold:
                            classified_state = "DAMAGED"  # Override ML with rule-based break detection
                            if confidence == 0.0:
                                confidence = 95.0

            # Two-way sync: Send smoothed ML classification back to ESP32 hardware
            if state.esp32_connected and state.esp32_ws and not state.use_synthetic:
                try:
                    sync_payload = f"{classified_state}:{int(confidence)}"
                    await state.esp32_ws.send(sync_payload)
                except Exception as sync_err:
                    logger.debug(f"Could not sync state to ESP32: {sync_err}")

            # Calibration sample collection (ONLY genuine hardware samples if IP set)
            if state.is_calibrating and len(state.calibration_buffer) < 100:
                if state.esp32_ip:
                    if state.esp32_connected and not raw.get("disconnected") and not raw.get("synthetic"):
                        state.calibration_buffer.append(raw)
                else:
                    state.calibration_buffer.append(raw)

            # Build broadcast packet with smoothed state
            packet = {
                "s1": raw.get("s1", 0),
                "s2": raw.get("s2", 0),
                "s3": raw.get("s3", 0),
                "ncv": raw.get("ncv", 0),
                "ncv_raw": raw.get("ncv_raw", raw.get("ncv", 0)),        # raw unsmoothed NCV
                "idle_baseline": idle_baseline_ncv,                         # calibrated baseline
                "ncv_tracking": tracking_level if len(ncv_tracking_buffer) >= 10 else 0,  # current tracking level
                "drop_detected": classified_state == "DAMAGED" and near_wire,  # true if rule fired
                "tiltX": raw.get("tiltX", 0),
                "tiltY": raw.get("tiltY", 0),
                "tiltZ": raw.get("tiltZ", 0),
                "state": classified_state,
                "confidence": confidence,
                "timestamp": time.time(),
                "synthetic": raw.get("synthetic", False),
                "esp32_connected": state.esp32_connected,
                "esp32_ip": state.esp32_ip,
                "model_loaded": state.model is not None,
                "calibrating": state.is_calibrating,
                "calibration_target": state.calibration_target,
                "calibration_progress": len(state.calibration_buffer) if state.is_calibrating else 0,
                "calibration_paused": state.is_calibrating and bool(state.esp32_ip and not state.esp32_connected),
            }
            state.latest_reading = packet

            # Broadcast to all connected WebSocket clients
            if state.connected_clients:
                message = json.dumps(packet)
                dead_clients = set()
                for client in state.connected_clients:
                    try:
                        await client.send_text(message)
                    except Exception:
                        dead_clients.add(client)
                state.connected_clients -= dead_clients

            await asyncio.sleep(0.02)  # 50Hz update rate

        except asyncio.CancelledError:
            logger.info("esp32_worker loop cancelled")
            break
        except Exception as e:
            logger.error(f"Worker loop error: {e}")
            await asyncio.sleep(0.1)

# Backward-compatibility alias
telemetry_stream_loop = esp32_worker

# ─────────────────────────────────────────────────────────
# FastAPI App Lifecycle
# ─────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: start background tasks on startup."""
    logger.info("═══════════════════════════════════════════════")
    logger.info("  Mag-Cipher Backend Server v2.0 (ML Engine)")
    logger.info("  Smart Wire & Fault Scanner Suite")
    logger.info("═══════════════════════════════════════════════")
    
    # Attempt initial ESP32 connection
    await connect_esp32()
    
    # Start ML inference & telemetry stream worker
    state.stream_task = asyncio.create_task(esp32_worker())
    
    yield
    
    # Cleanup
    if state.stream_task:
        state.stream_task.cancel()
    if state.esp32_ws:
        await state.esp32_ws.close()

app = FastAPI(
    title="Mag-Cipher Backend",
    description="Smart Wire & Fault Scanner ML Inference Engine",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware for cross-origin requests from web and mobile
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    ip: str

class TrainResponse(BaseModel):
    status: str
    samples_total: int
    cv_accuracy: float
    cv_std: float
    feature_importances: dict
    classes: list
    midpoint_ncv: Optional[float] = None

# ─────────────────────────────────────────────────────────
# REST Endpoints
# ─────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "Mag-Cipher Backend",
        "version": "2.0.0",
        "esp32_connected": state.esp32_connected,
        "esp32_ip": state.esp32_ip,
        "model_trained": state.model is not None,
        "clients_connected": len(state.connected_clients),
        "using_synthetic": state.use_synthetic
    }


@app.post("/api/connect")
async def connect_to_esp32(req: ConnectRequest):
    """Set ESP32 IP address and attempt WebSocket connection."""
    state.esp32_ip = req.ip.strip()
    logger.info(f"ESP32 IP configured to {state.esp32_ip}")
    await connect_esp32()
    return {
        "status": "connected" if state.esp32_connected else "disconnected",
        "ip": state.esp32_ip,
        "esp32_connected": state.esp32_connected,
        "using_synthetic": state.use_synthetic
    }


@app.post("/api/calibrate/cancel")
async def cancel_calibration():
    """Cancel any active calibration session."""
    state.is_calibrating = False
    state.calibration_target = None
    state.calibration_buffer = []
    logger.info("Calibration cancelled by user")
    return {"status": "cancelled"}


@app.post("/api/calibrate/idle")
async def calibrate_idle():
    """
    Start IDLE baseline calibration.
    Collects 100 real samples of ambient air electromagnetic noise.
    Pauses if ESP32 disconnects and resumes when reconnected.
    """
    logger.info("Starting IDLE calibration (ambient air baseline)...")
    state.is_calibrating = True
    state.calibration_target = "idle"
    state.calibration_buffer = []

    if not state.esp32_ip:
        while len(state.calibration_buffer) < 100:
            state.calibration_buffer.append(generate_calibration_sample("idle"))
            await asyncio.sleep(0.01)
    else:
        # Wait until 100 real hardware samples are gathered.
        # If ESP32 disconnects, it pauses collection and waits for auto-reconnect.
        timeout = 0
        max_timeout = 6000  # 300 seconds (5 minutes) max timeout
        while len(state.calibration_buffer) < 100 and timeout < max_timeout:
            await asyncio.sleep(0.05)
            timeout += 1
            if not state.is_calibrating:
                return {"status": "cancelled", "samples_collected": len(state.calibration_buffer)}

        if len(state.calibration_buffer) < 100:
            state.is_calibrating = False
            state.calibration_target = None
            raise HTTPException(status_code=408, detail="Calibration timed out waiting for ESP32 reconnection.")

    state.is_calibrating = False
    state.calibration_target = None

    # Store calibration data
    state.calibration_data["idle_samples"] = state.calibration_buffer[:100]
    save_store(state.calibration_data)

    # Compute statistics
    features = np.array([extract_features(s) for s in state.calibration_buffer[:100]])
    stats = {
        "mean_s1": round(float(features[:, 0].mean()), 5),
        "mean_s2": round(float(features[:, 1].mean()), 5),
        "mean_s3": round(float(features[:, 2].mean()), 5),
        "mean_ncv": round(float(features[:, 3].mean()), 5),
        "std_ncv": round(float(features[:, 3].std()), 5),
        "max_ncv": round(float(features[:, 3].max()), 5),
    }

    logger.info(f"IDLE calibration complete: {stats}")
    return {
        "status": "idle_calibrated",
        "samples_collected": len(state.calibration_buffer),
        "stats": stats
    }


@app.post("/api/calibrate/live")
async def calibrate_live():
    """
    Start LIVE wire reference calibration.
    Collects 100 real samples against a known powered 230V wire.
    Pauses if ESP32 disconnects and resumes when reconnected.
    """
    logger.info("Starting LIVE calibration (healthy 230V wire reference)...")
    state.is_calibrating = True
    state.calibration_target = "live"
    state.calibration_buffer = []

    if not state.esp32_ip:
        while len(state.calibration_buffer) < 100:
            state.calibration_buffer.append(generate_calibration_sample("live"))
            await asyncio.sleep(0.01)
    else:
        # Wait until 100 real hardware samples are gathered.
        # If ESP32 disconnects, it pauses collection and waits for auto-reconnect.
        timeout = 0
        max_timeout = 6000  # 300 seconds (5 minutes) max timeout
        while len(state.calibration_buffer) < 100 and timeout < max_timeout:
            await asyncio.sleep(0.05)
            timeout += 1
            if not state.is_calibrating:
                return {"status": "cancelled", "samples_collected": len(state.calibration_buffer)}

        if len(state.calibration_buffer) < 100:
            state.is_calibrating = False
            state.calibration_target = None
            raise HTTPException(status_code=408, detail="Calibration timed out waiting for ESP32 reconnection.")

    state.is_calibrating = False
    state.calibration_target = None

    # Store calibration data
    state.calibration_data["live_samples"] = state.calibration_buffer[:100]
    save_store(state.calibration_data)

    # Compute statistics
    features = np.array([extract_features(s) for s in state.calibration_buffer[:100]])
    stats = {
        "mean_s1": round(float(features[:, 0].mean()), 5),
        "mean_s2": round(float(features[:, 1].mean()), 5),
        "mean_s3": round(float(features[:, 2].mean()), 5),
        "mean_ncv": round(float(features[:, 3].mean()), 5),
        "std_ncv": round(float(features[:, 3].std()), 5),
        "min_ncv": round(float(features[:, 3].min()), 5),
    }

    logger.info(f"LIVE calibration complete: {stats}")
    return {
        "status": "live_calibrated",
        "samples_collected": len(state.calibration_buffer),
        "stats": stats
    }


@app.post("/api/calibrate/reset/{label}")
async def reset_calibration(label: str):
    """Reset/clear calibration data for a specific state (idle or live)."""
    if label not in ("idle", "live"):
        raise HTTPException(status_code=400, detail="Label must be 'idle' or 'live'")

    state.calibration_data[f"{label}_samples"] = []
    state.calibration_data["model_trained"] = False
    save_store(state.calibration_data)

    # Invalidate model if either calibration is reset
    if state.model is not None:
        state.model = None
        logger.info(f"Model invalidated after {label} calibration reset")

    logger.info(f"Calibration data for '{label}' has been cleared")
    return {"status": f"{label}_reset", "message": f"{label.upper()} calibration data cleared"}


@app.post("/api/train")
async def train():
    """
    Train the RandomForestClassifier on calibration data with midpoint boundary synthesis.
    
    1. Calculates max_idle_ncv from recorded IDLE dataset.
    2. Calculates min_live_ncv from recorded LIVE dataset.
    3. Synthesizes DAMAGED class samples at the strict midpoint: (max_idle_ncv + min_live_ncv) / 2.0.
    4. Trains Scikit-Learn RandomForestClassifier with 100 estimators.
    """
    idle_samples = state.calibration_data.get("idle_samples", [])
    live_samples = state.calibration_data.get("live_samples", [])

    if len(idle_samples) < 10:
        raise HTTPException(
            status_code=400,
            detail="Insufficient IDLE calibration data. Complete Step 1 first."
        )
    if len(live_samples) < 10:
        raise HTTPException(
            status_code=400,
            detail="Insufficient LIVE calibration data. Complete Step 2 first."
        )

    # Calculate exact mathematical boundary
    max_idle_ncv = max(float(s.get("ncv", 0)) for s in idle_samples)
    min_live_ncv = min(float(s.get("ncv", 0)) for s in live_samples)
    if min_live_ncv <= max_idle_ncv:
        above_idle = [float(s.get("ncv", 0)) for s in live_samples if float(s.get("ncv", 0)) > max_idle_ncv]
        if above_idle:
            min_live_ncv = min(above_idle)
    midpoint_ncv = (max_idle_ncv + min_live_ncv) / 2.0

    logger.info(
        f"Training ML model with strict mathematical boundary synthesis: "
        f"max_idle_ncv={max_idle_ncv:.4f}, min_live_ncv={min_live_ncv:.4f}, "
        f"midpoint_ncv={midpoint_ncv:.4f}"
    )

    result = train_model(idle_samples, live_samples)

    # Reload the newly trained model into memory
    state.model = load_model()
    state.calibration_data["model_trained"] = True
    save_store(state.calibration_data)

    logger.info(f"Model trained successfully: accuracy={result['cv_accuracy']:.4f}")
    return result


@app.get("/api/status")
async def get_status():
    """Get current system status."""
    return {
        "esp32_ip": state.esp32_ip,
        "esp32_connected": state.esp32_connected,
        "using_synthetic": state.use_synthetic,
        "model_trained": state.model is not None,
        "idle_calibrated": len(state.calibration_data.get("idle_samples", [])) >= 100,
        "live_calibrated": len(state.calibration_data.get("live_samples", [])) >= 100,
        "clients_connected": len(state.connected_clients),
        "latest_reading": state.latest_reading
    }

# ─────────────────────────────────────────────────────────
# WebSocket Telemetry Stream Endpoint
# ─────────────────────────────────────────────────────────

@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time telemetry streaming.
    Broadcasts debounced, classified sensor data to all connected frontends.
    """
    await websocket.accept()
    state.connected_clients.add(websocket)
    client_id = id(websocket)
    logger.info(f"Client {client_id} connected (total: {len(state.connected_clients)})")

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"pong": True}))
    except WebSocketDisconnect:
        state.connected_clients.discard(websocket)
        logger.info(f"Client {client_id} disconnected (total: {len(state.connected_clients)})")
    except Exception as e:
        state.connected_clients.discard(websocket)
        logger.error(f"Client {client_id} error: {e}")


# ─────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
