"""
Mag-Cipher ML Model Module
===========================
Feature extraction, synthetic data generation, and RandomForestClassifier
training for three-state wire classification: IDLE, LIVE, DAMAGED.
"""

import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.metrics import classification_report
import joblib
import os
import json
import logging

logger = logging.getLogger("mag-cipher.model")

MODEL_PATH = os.path.join(os.path.dirname(__file__), "trained_model.joblib")
STORE_PATH = os.path.join(os.path.dirname(__file__), "calibration_store.json")

# ─────────────────────────────────────────────────────────
# Feature Extraction
# ─────────────────────────────────────────────────────────

from collections import deque

ncv_rolling_buffer = deque(maxlen=10)

def reset_feature_buffers():
    """Clear rolling feature filters (e.g. on disconnect or mode reset)."""
    ncv_rolling_buffer.clear()

def extract_features(sample: dict, use_smoothing: bool = True) -> list:
    """
    Extract a 6-dimensional feature vector from a sensor sample.
    Uses a 10-frame rolling median filter on NCV to strip erratic micro-fluctuations
    and ambient noise spikes before model inference.
    Features: [s1, s2, s3, ncv_filtered, max(s1,s2,s3), ncv_diff]
    """
    s1 = float(sample.get("s1", 0))
    s2 = float(sample.get("s2", 0))
    s3 = float(sample.get("s3", 0))
    raw_ncv = float(sample.get("ncv", 0))

    if use_smoothing:
        ncv_rolling_buffer.append(raw_ncv)
        ncv = float(np.median(ncv_rolling_buffer))
    else:
        ncv = raw_ncv

    mag_max = max(s1, s2, s3)
    # NCV differential proxy: ratio of ncv to max magnetic signal
    ncv_diff = ncv - mag_max if mag_max > 0 else ncv
    return [s1, s2, s3, ncv, mag_max, ncv_diff]


# ─────────────────────────────────────────────────────────
# Synthetic Data Generation
# ─────────────────────────────────────────────────────────

def generate_synthetic_damaged(idle_samples: list, live_samples: list) -> list:
    """
    Generate synthetic DAMAGED-state samples by taking the recorded LIVE data samples
    and overwriting their ncv feature to sit exactly at the mathematical midpoint:
    (max_idle_ncv + min_live_ncv) / 2.0.
    
    This explicitly trains the model to recognize a sudden voltage drop boundary
    without overlapping into the ambient noise floor.
    """
    if not idle_samples or not live_samples:
        return []

    max_idle_ncv = max(float(s.get("ncv", 0)) for s in idle_samples)
    min_live_ncv = min(float(s.get("ncv", 0)) for s in live_samples)

    # In case the wand was briefly lifted during live calibration recording,
    # isolate the live contact samples so midpoint never overlaps into ambient noise
    if min_live_ncv <= max_idle_ncv:
        above_idle = [float(s.get("ncv", 0)) for s in live_samples if float(s.get("ncv", 0)) > max_idle_ncv]
        if above_idle:
            min_live_ncv = min(above_idle)

    midpoint_ncv = (max_idle_ncv + min_live_ncv) / 2.0

    logger.info(
        f"Synthesizing DAMAGED dataset at exact midpoint: "
        f"max_idle_ncv={max_idle_ncv:.4f}, min_live_ncv={min_live_ncv:.4f}, "
        f"damaged_midpoint={midpoint_ncv:.4f}"
    )

    damaged_features = []
    for sample in live_samples:
        s_copy = dict(sample)
        s_copy["ncv"] = midpoint_ncv
        damaged_features.append(extract_features(s_copy, use_smoothing=False))

    return damaged_features


# ─────────────────────────────────────────────────────────
# Model Training
# ─────────────────────────────────────────────────────────

def train_model(idle_samples: list, live_samples: list) -> dict:
    """
    Train a RandomForestClassifier on real calibration data + synthetic damaged midpoint data.
    """
    reset_feature_buffers()
    max_idle_ncv = max(float(s.get("ncv", 0)) for s in idle_samples)
    min_live_ncv = min(float(s.get("ncv", 0)) for s in live_samples)
    if min_live_ncv <= max_idle_ncv:
        above_idle = [float(s.get("ncv", 0)) for s in live_samples if float(s.get("ncv", 0)) > max_idle_ncv]
        if above_idle:
            min_live_ncv = min(above_idle)

    midpoint_ncv = (max_idle_ncv + min_live_ncv) / 2.0

    logger.info(
        f"Training ML model with strict midpoint boundary synthesis: "
        f"max_idle={max_idle_ncv:.4f}, min_live={min_live_ncv:.4f}, midpoint={midpoint_ncv:.4f}"
    )

    # Extract features from real calibration samples (exact calibration values)
    idle_features = [extract_features(s, use_smoothing=False) for s in idle_samples]
    live_features = [extract_features(s, use_smoothing=False) for s in live_samples]

    # Generate synthetic DAMAGED samples at exact midpoint
    damaged_features = generate_synthetic_damaged(idle_samples, live_samples)
    reset_feature_buffers()

    # Assemble training dataset
    X = np.array(idle_features + live_features + damaged_features)
    y = np.array(
        ["IDLE"] * len(idle_features) +
        ["LIVE"] * len(live_features) +
        ["DAMAGED"] * len(damaged_features)
    )

    # Shuffle the dataset
    indices = np.random.permutation(len(X))
    X = X[indices]
    y = y[indices]

    logger.info(f"Training dataset: {len(X)} samples "
                f"(IDLE: {sum(y == 'IDLE')}, LIVE: {sum(y == 'LIVE')}, DAMAGED: {sum(y == 'DAMAGED')})")

    # Train RandomForestClassifier
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=1
    )
    clf.fit(X, y)

    # Cross-validation score
    cv_scores = cross_val_score(clf, X, y, cv=5, scoring="accuracy")
    logger.info(f"Cross-validation accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # Feature importance
    feature_names = ["s1", "s2", "s3", "ncv", "mag_max", "ncv_diff"]
    importances = dict(zip(feature_names, clf.feature_importances_.tolist()))

    # Save model
    joblib.dump(clf, MODEL_PATH)
    logger.info(f"Model saved to {MODEL_PATH}")

    # Compute and store calibration statistics
    idle_feat_arr = np.array(idle_features)
    live_feat_arr = np.array(live_features)

    stats = {
        "idle": {
            "mean": idle_feat_arr.mean(axis=0).tolist(),
            "std": idle_feat_arr.std(axis=0).tolist(),
            "max_ncv": max_idle_ncv
        },
        "live": {
            "mean": live_feat_arr.mean(axis=0).tolist(),
            "std": live_feat_arr.std(axis=0).tolist(),
            "min_ncv": min_live_ncv
        },
        "midpoint_ncv": midpoint_ncv
    }

    return {
        "status": "trained",
        "samples_total": len(X),
        "cv_accuracy": round(float(cv_scores.mean()), 4),
        "cv_std": round(float(cv_scores.std()), 4),
        "feature_importances": importances,
        "calibration_stats": stats,
        "classes": clf.classes_.tolist(),
        "midpoint_ncv": round(midpoint_ncv, 4)
    }


def load_model() -> RandomForestClassifier | None:
    """Load a previously trained model from disk."""
    if os.path.exists(MODEL_PATH):
        try:
            return joblib.load(MODEL_PATH)
        except Exception:
            return None
    return None


def predict(sample: dict, model: RandomForestClassifier) -> tuple:
    """
    ML Prediction: Predict the state of a sensor sample and return (predicted_state, confidence).
    
    Returns:
        tuple: (predicted_state: str, confidence: float 0-100)
    """
    features = np.array([extract_features(sample)])
    predicted_state = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]
    confidence = float(max(probabilities)) * 100
    return predicted_state, round(confidence, 1)


# ─────────────────────────────────────────────────────────
# Calibration Store I/O
# ─────────────────────────────────────────────────────────

def save_store(data: dict):
    """Persist calibration data to JSON."""
    with open(STORE_PATH, "w") as f:
        json.dump(data, f, indent=2)


def load_store() -> dict:
    """Load calibration data from JSON."""
    if os.path.exists(STORE_PATH):
        with open(STORE_PATH, "r") as f:
            return json.load(f)
    return {
        "idle_samples": [],
        "live_samples": [],
        "model_trained": False,
        "idle_stats": None,
        "live_stats": None
    }
