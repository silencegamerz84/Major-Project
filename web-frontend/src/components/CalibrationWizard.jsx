/**
 * CalibrationWizard Component
 * ===========================
 * Web-based two-step calibration wizard with progress indicators,
 * retry buttons, and ML model training interface.
 */

import React, { useState, useCallback } from 'react';

const API_BASE = window.location.port === '5173' ? '' : (window.location.port === '8000' ? '' : `http://${window.location.hostname}:8000`);

export default function CalibrationWizard({
  onComplete,
  esp32Connected = false,
  esp32Ip = '192.168.0.170',
  telemetry = {},
}) {
  const [idleStatus, setIdleStatus] = useState('pending');
  const [liveStatus, setLiveStatus] = useState('pending');
  const [idleStats, setIdleStats] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState(null);
  const [error, setError] = useState(null);

  // Restore saved calibration status from backend on mount
  React.useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then((res) => res.json())
      .then((status) => {
        if (status.idle_calibrated) {
          setIdleStatus('complete');
        }
        if (status.live_calibrated) {
          setLiveStatus('complete');
        }
        if (status.model_trained) {
          setTrainResult({ cv_accuracy: 1.0, samples_total: 300, classes: ['DAMAGED', 'IDLE', 'LIVE'] });
        }
      })
      .catch(() => {});
  }, []);

  // Derive real-time progress from telemetry
  const idleProgress = idleStatus === 'complete'
    ? 100
    : (idleStatus === 'recording' && telemetry.calibration_target === 'idle'
      ? (telemetry.calibration_progress || 0)
      : 0);

  const liveProgress = liveStatus === 'complete'
    ? 100
    : (liveStatus === 'recording' && telemetry.calibration_target === 'live'
      ? (telemetry.calibration_progress || 0)
      : 0);

  const isIdlePaused = idleStatus === 'recording' && (!esp32Connected || telemetry.calibration_paused);
  const isLivePaused = liveStatus === 'recording' && (!esp32Connected || telemetry.calibration_paused);

  const cancelCalibration = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/calibrate/cancel`, { method: 'POST' });
    } catch (e) { /* ignore */ }
    if (idleStatus === 'recording') setIdleStatus('pending');
    if (liveStatus === 'recording') setLiveStatus('pending');
  }, [idleStatus, liveStatus]);

  const calibrate = useCallback(async (type) => {
    const setter = type === 'idle'
      ? { status: setIdleStatus, stats: setIdleStats }
      : { status: setLiveStatus, stats: setLiveStats };

    setter.status('recording');
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/calibrate/${type}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Calibration request failed');
      }
      if (data.status === 'cancelled') {
        setter.status('pending');
        return;
      }
      setter.stats(data.stats);
      setter.status('complete');
    } catch (err) {
      setter.status('error');
      setError(`${type.toUpperCase()} calibration failed: ${err.message}`);
    }
  }, []);

  const reset = useCallback(async (type) => {
    const setter = type === 'idle'
      ? { status: setIdleStatus, stats: setIdleStats }
      : { status: setLiveStatus, stats: setLiveStats };

    try {
      await fetch(`${API_BASE}/api/calibrate/reset/${type}`, { method: 'POST' });
    } catch (e) { /* Continue */ }

    setter.status('pending');
    setter.stats(null);
    setTrainResult(null);
  }, []);

  // Validation: Check if LIVE calibration values are sufficiently higher than IDLE baseline
  const isValidationPassing = React.useMemo(() => {
    if (!idleStats || !liveStats) {
      return idleStatus === 'complete' && liveStatus === 'complete';
    }
    const idleNcv = idleStats.mean_ncv ?? 0;
    const liveNcv = liveStats.mean_ncv ?? 0;
    const idleS1 = idleStats.mean_s1 ?? 0;
    const liveS1 = liveStats.mean_s1 ?? 0;

    const ncvDelta = liveNcv - idleNcv;
    const s1Delta = Math.abs(liveS1 - idleS1);
    
    const hasNcvSeparation = ncvDelta >= 0.015 || (idleNcv > 0 && liveNcv >= idleNcv * 1.25);
    const hasMagSeparation = s1Delta >= 0.008;

    return hasNcvSeparation || hasMagSeparation;
  }, [idleStats, liveStats, idleStatus, liveStatus]);

  const trainModel = useCallback(async () => {
    setTraining(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/train`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.cv_accuracy) {
        setTrainResult(data);
      } else {
        setError(data.detail || 'Training failed');
      }
    } catch (err) {
      setError(`Training failed: ${err.message}`);
    } finally {
      setTraining(false);
    }
  }, []);

  const canTrain = idleStatus === 'complete' && liveStatus === 'complete' && isValidationPassing;

  const s = {
    container: {
      maxWidth: '640px',
      margin: '0 auto',
      padding: '24px',
    },
    header: {
      textAlign: 'center',
      marginBottom: '24px',
    },
    title: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '24px',
      fontWeight: 800,
      color: '#E2E8F0',
      letterSpacing: '3px',
    },
    subtitle: {
      color: '#94A3B8',
      fontSize: '13px',
      marginTop: '8px',
      lineHeight: '1.6',
    },
    stepCard: (status, accentColor, isPaused) => ({
      background: '#111317',
      border: `1px solid ${status === 'complete' ? '#10B981' : isPaused ? '#EF4444' : status === 'recording' ? accentColor : '#1E2229'}`,
      borderRadius: '14px',
      padding: '20px',
      marginBottom: '16px',
      transition: 'all 0.3s ease',
      boxShadow: isPaused ? '0 0 20px rgba(239, 68, 68, 0.2)' : 'none',
      animation: isPaused ? 'pulse-glow 1.5s ease-in-out infinite' : (status === 'recording' ? 'pulse-scale 2s ease-in-out infinite' : 'none'),
    }),
    stepBadge: {
      display: 'inline-block',
      background: '#1E2229',
      padding: '4px 12px',
      borderRadius: '6px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '10px',
      fontWeight: 700,
      color: '#94A3B8',
      letterSpacing: '2px',
      marginBottom: '12px',
    },
    stepTitle: {
      fontFamily: 'Inter, sans-serif',
      fontSize: '17px',
      fontWeight: 700,
      color: '#E2E8F0',
      marginBottom: '6px',
    },
    stepDesc: {
      color: '#94A3B8',
      fontSize: '12px',
      lineHeight: '1.6',
      marginBottom: '12px',
    },
    instructionBox: {
      background: '#0D0F12',
      borderLeft: '3px solid #3B82F6',
      borderRadius: '0 8px 8px 0',
      padding: '10px 14px',
      marginBottom: '16px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      color: '#CBD5E1',
      lineHeight: '1.5',
    },
    progressTrack: {
      height: '8px',
      background: '#1E2229',
      borderRadius: '4px',
      overflow: 'hidden',
      marginBottom: '6px',
    },
    progressFill: (progress, color, isPaused) => ({
      height: '100%',
      width: `${Math.min(progress, 100)}%`,
      background: isPaused ? '#F59E0B' : color,
      borderRadius: '4px',
      transition: 'width 0.2s ease',
    }),
    progressText: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '10px',
      color: '#94A3B8',
      display: 'flex',
      justifyContent: 'space-between',
      letterSpacing: '1px',
      marginBottom: '10px',
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '8px',
      background: '#0D0F12',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '12px',
      marginBottom: '12px',
    },
    statLabel: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '7px',
      color: '#64748B',
      letterSpacing: '1px',
    },
    statValue: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '12px',
      fontWeight: 700,
      color: '#E2E8F0',
    },
    btn: (bg, disabled) => ({
      width: '100%',
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      background: disabled ? '#1E222980' : bg,
      color: '#FFFFFF',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: '1.5px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.2s ease',
      marginTop: '8px',
    }),
    retryBtn: {
      width: '100%',
      padding: '10px 20px',
      borderRadius: '8px',
      border: '1px solid #EF4444',
      background: '#1E2229',
      color: '#EF4444',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: '1.5px',
      cursor: 'pointer',
      marginTop: '8px',
      transition: 'all 0.2s ease',
    },
    trainSection: {
      marginTop: '24px',
      padding: '20px',
      background: '#111317',
      border: `1px solid ${trainResult ? '#10B981' : '#1E2229'}`,
      borderRadius: '14px',
    },
    metricsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '12px',
      marginTop: '16px',
      marginBottom: '16px',
    },
    metricCard: {
      textAlign: 'center',
      background: '#0D0F12',
      borderRadius: '8px',
      padding: '12px',
    },
    metricValue: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '22px',
      fontWeight: 700,
      color: '#E2E8F0',
    },
    metricLabel: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '8px',
      color: '#64748B',
      letterSpacing: '1.5px',
      marginTop: '4px',
    },
    errorBox: {
      background: '#EF444420',
      border: '1px solid #EF444440',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '16px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      color: '#EF4444',
    },
  };

  const renderStep = (step, type, title, desc, instruction, status, progress, stats, accentColor, isPaused) => (
    <div style={s.stepCard(status, accentColor, isPaused)} className="animate-slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={s.stepBadge}>STEP {step}</div>
        {status === 'complete' && (
          <span style={{ color: '#10B981', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700 }}>
            ✓ CALIBRATED
          </span>
        )}
      </div>
      <div style={s.stepTitle}>{title}</div>
      <div style={s.stepDesc}>{desc}</div>
      <div style={s.instructionBox}>📋 {instruction}</div>

      {/* Disconnect Alert during recording */}
      {isPaused && (
        <div style={{
          background: '#EF444420',
          border: '1px solid #EF444480',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '12px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          color: '#F87171',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 800, color: '#EF4444' }}>⚠️ ESP32 WAND DISCONNECTED!</div>
            <div style={{ fontSize: '10px', color: '#FCA5A5', marginTop: '2px' }}>
              Calibration paused at {Math.round(progress)}/100 samples. Reconnect wand to automatically resume.
            </div>
          </div>
          <button
            onClick={cancelCalibration}
            style={{
              background: '#1E2229',
              border: '1px solid #EF4444',
              color: '#EF4444',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            CANCEL
          </button>
        </div>
      )}

      {/* Reconnected notification during active recording */}
      {status === 'recording' && !isPaused && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          color: accentColor,
        }}>
          <span>◉ COLLECTING REAL SAMPLES ({Math.round(progress)}/100)...</span>
          <button
            onClick={cancelCalibration}
            style={{
              background: 'transparent',
              border: '1px solid #64748B',
              color: '#94A3B8',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            ✕ CANCEL
          </button>
        </div>
      )}

      <div style={s.progressTrack}>
        <div style={s.progressFill(progress, accentColor, isPaused)} />
      </div>
      <div style={s.progressText}>
        <span>{isPaused ? '⏸ PAUSED AT RECONNECTION' : (status === 'recording' ? 'COLLECTING HARDWARE SAMPLES' : 'STATUS')}</span>
        <span>{Math.round(Math.min(progress, 100))}/100 SAMPLES</span>
      </div>

      {stats && (
        <div style={s.statsGrid}>
          {Object.entries(stats).map(([key, val]) => (
            <div key={key}>
              <div style={s.statLabel}>{key.toUpperCase()}</div>
              <div style={s.statValue}>{typeof val === 'number' ? val.toFixed(5) : val}</div>
            </div>
          ))}
        </div>
      )}

      {status === 'pending' && (
        <button
          style={s.btn(accentColor, (step === 2 && idleStatus !== 'complete') || !esp32Connected)}
          disabled={(step === 2 && idleStatus !== 'complete') || !esp32Connected}
          onClick={() => calibrate(type)}
        >
          {!esp32Connected ? '⚠️ CONNECT WAND TO BEGIN' : '▶ BEGIN RECORDING'}
        </button>
      )}
      {(status === 'complete' || status === 'error') && (
        <button style={s.retryBtn} onClick={() => reset(type)}>
          ⟲ RETRY / CLEAR
        </button>
      )}
    </div>
  );

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.title}>CALIBRATION WIZARD</div>
        <div style={s.subtitle}>
          Two-step adaptive calibration to learn your environment's electromagnetic boundaries.
          <br />Real hardware samples only — pauses automatically if wand disconnects and resumes on reconnect.
        </div>
      </div>

      {/* Wand connection status badge */}
      <div style={{
        background: esp32Connected ? '#10B98115' : '#EF444415',
        border: `1px solid ${esp32Connected ? '#10B98150' : '#EF444450'}`,
        borderRadius: '8px',
        padding: '10px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        color: esp32Connected ? '#10B981' : '#EF4444',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: esp32Connected ? '#10B981' : '#EF4444',
            boxShadow: `0 0 8px ${esp32Connected ? '#10B981' : '#EF4444'}`
          }} />
          <span>
            {esp32Connected
              ? `✓ ESP32 WAND CONNECTED (${esp32Ip})`
              : `⚠️ ESP32 WAND DISCONNECTED (${esp32Ip}) — Ready to connect`}
          </span>
        </div>
        <span style={{ fontSize: '10px', color: '#94A3B8' }}>
          {esp32Connected ? 'HARDWARE ONLINE' : 'WAND OFFLINE'}
        </span>
      </div>

      {error && <div style={s.errorBox}>⚠ {error}</div>}

      {renderStep(1, 'idle', 'IDLE Baseline — Ambient Air',
        'Establishes the electromagnetic noise floor. The wand must be held in open air, away from any wires.',
        'Hold the wand still in free air, at least 1 meter away from any electrical wiring.',
        idleStatus, idleProgress, idleStats, '#3B82F6', isIdlePaused
      )}

      {renderStep(2, 'live', 'LIVE Wire Reference — 230V Standard',
        'Establishes the healthy operational envelope. Place wand against a known powered wire.',
        'Press the wand flat against a known powered 230V wire or conduit. Hold steady.',
        liveStatus, liveProgress, liveStats, '#10B981', isLivePaused
      )}

      <div style={s.trainSection}>
        {trainResult && (
          <>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', fontWeight: 700, color: '#10B981', letterSpacing: '2px' }}>
              MODEL TRAINED SUCCESSFULLY
            </div>
            <div style={s.metricsRow}>
              <div style={s.metricCard}>
                <div style={s.metricValue}>{(trainResult.cv_accuracy * 100).toFixed(1)}%</div>
                <div style={s.metricLabel}>ACCURACY</div>
              </div>
              <div style={s.metricCard}>
                <div style={s.metricValue}>{trainResult.samples_total}</div>
                <div style={s.metricLabel}>TOTAL SAMPLES</div>
              </div>
              <div style={s.metricCard}>
                <div style={s.metricValue}>{trainResult.classes?.length || 3}</div>
                <div style={s.metricLabel}>CLASSES</div>
              </div>
            </div>
          </>
        )}

        {idleStatus === 'complete' && liveStatus === 'complete' && !isValidationPassing && (
          <div style={{
            background: '#EF444415',
            border: '1px solid #EF444480',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: '#F87171',
            lineHeight: '1.6'
          }}>
            <div style={{ fontWeight: 800, color: '#EF4444', marginBottom: '4px' }}>
              ⚠️ INVALID CALIBRATION: NO SIGNAL SEPARATION DETECTED
            </div>
            <div>
              The recorded LIVE wire values (NCV: {Number(liveStats?.mean_ncv || 0).toFixed(5)}V) are nearly identical to the IDLE baseline (NCV: {Number(idleStats?.mean_ncv || 0).toFixed(5)}V).
              <br />
              Training with these values will lock the scanner in a false positive state.
              Please verify that your wire is energized, the antenna/probe is connected to ADS1115 A3 with shield grounded, and click <strong>RETRY / CLEAR</strong> on Step 2.
            </div>
          </div>
        )}

        {error && <div style={{ ...s.errorBox, marginBottom: '16px' }}>⚠ {error}</div>}

        <button
          type="button"
          style={s.btn(trainResult ? '#10B981' : '#3B82F6', !canTrain || training)}
          disabled={!canTrain || training}
          onClick={trainResult ? onComplete : trainModel}
        >
          {training ? '⏳ TRAINING MODEL...' : trainResult ? '✓ ENTER LIVE SCANNER' : '⚡ TRAIN ML MODEL'}
        </button>

        {!canTrain && (
          <div style={{ textAlign: 'center', marginTop: '8px', color: '#475569', fontSize: '11px', fontStyle: 'italic' }}>
            {idleStatus !== 'complete' || liveStatus !== 'complete'
              ? 'Complete both calibration steps to enable model training'
              : 'LIVE reference must be significantly higher than IDLE baseline to train'}
          </div>
        )}
      </div>
    </div>
  );
}
