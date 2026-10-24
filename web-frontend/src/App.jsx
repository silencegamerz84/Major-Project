/**
 * Mag-Cipher Web Dashboard — App Root
 * ====================================
 * Main application component managing Calibration → Scanner flow
 * with 2-second heartbeat monitor, robust disconnect handling,
 * grayed-out waveforms on disconnect, and dedicated Stop Scan controls.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import CalibrationWizard from './components/CalibrationWizard';
import TelemetryHUD from './components/TelemetryHUD';
import WaveformCanvas from './components/WaveformCanvas';

const WS_URL = `ws://${window.location.hostname || 'localhost'}:8000/ws/stream`;
const MAX_HISTORY = 100;

export default function App() {
  const [view, setView] = useState('calibration'); // 'calibration' | 'scanner'
  const [telemetry, setTelemetry] = useState({});
  const [currentState, setCurrentState] = useState('IDLE');
  const [confidence, setConfidence] = useState(0);
  const [ncvHistory, setNcvHistory] = useState([]);
  const [magHistory, setMagHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [packetCount, setPacketCount] = useState(0);
  const [isScanning, setIsScanning] = useState(true);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [autoPausedByDisconnect, setAutoPausedByDisconnect] = useState(false);

  const isScanningRef = useRef(true);
  const autoPausedRef = useRef(false);
  const viewRef = useRef('calibration');
  const wsRef = useRef(null);
  const lastPacketTimeRef = useRef(Date.now());

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  useEffect(() => {
    autoPausedRef.current = autoPausedByDisconnect;
  }, [autoPausedByDisconnect]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // ─── 2-Second Heartbeat Monitor ───
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      const elapsed = Date.now() - lastPacketTimeRef.current;
      if (elapsed > 2000) {
        if (!isTimedOut) {
          setIsTimedOut(true);
          setCurrentState('DISCONNECTED');
          setNcvHistory([]);
          setMagHistory([]);
        }
      } else {
        if (isTimedOut) {
          setIsTimedOut(false);
        }
      }
    }, 250);

    return () => clearInterval(heartbeatInterval);
  }, [isTimedOut]);

  // ─── WebSocket connection (persistent across both views) ───
  useEffect(() => {
    let reconnectTimeout;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      try {
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          if (!isMounted) return;
          setConnected(true);
          lastPacketTimeRef.current = Date.now();
          setIsTimedOut(false);
          console.log('[WS] Connected to backend telemetry stream');
        };

        ws.onmessage = (e) => {
          if (!isMounted) return;
          lastPacketTimeRef.current = Date.now();
          if (isTimedOut) {
            setIsTimedOut(false);
          }

          try {
            const data = JSON.parse(e.data);
            setPacketCount((p) => p + 1);
            setTelemetry(data);

            const espConnected = Boolean(data.esp32_connected) && !Boolean(data.disconnected);

            // In scanner view: handle auto-stop and auto-resume
            if (viewRef.current === 'scanner') {
              if (!espConnected) {
                setCurrentState('DISCONNECTED');
                setNcvHistory([]);
                setMagHistory([]);
                if (isScanningRef.current) {
                  setIsScanning(false);
                  setAutoPausedByDisconnect(true);
                }
              } else {
                if (autoPausedRef.current) {
                  setIsScanning(true);
                  setAutoPausedByDisconnect(false);
                }
              }

              // Update history only when scanning is active and wand is connected
              if (isScanningRef.current && espConnected) {
                setCurrentState(data.state || 'IDLE');
                setConfidence(data.confidence || 0);

                setNcvHistory((prev) => {
                  const next = [...prev, { ncv: data.ncv }];
                  return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
                });
                setMagHistory((prev) => {
                  const next = [...prev, { s1: data.s1, s2: data.s2, s3: data.s3 }];
                  return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
                });
              }
            }
          } catch (err) {
            console.warn('[WS] Parse error', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setConnected(false);
          setIsTimedOut(true);
          setCurrentState('DISCONNECTED');
          setNcvHistory([]);
          setMagHistory([]);
          setTelemetry((prev) => ({ ...prev, esp32_connected: false }));
          if (viewRef.current === 'scanner' && isScanningRef.current) {
            setIsScanning(false);
            setAutoPausedByDisconnect(true);
          }
          reconnectTimeout = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          setIsTimedOut(true);
          setCurrentState('DISCONNECTED');
          setNcvHistory([]);
          setMagHistory([]);
          ws.close();
        };

        wsRef.current = ws;
      } catch (err) {
        setIsTimedOut(true);
        setCurrentState('DISCONNECTED');
        setNcvHistory([]);
        setMagHistory([]);
        reconnectTimeout = setTimeout(connect, 2000);
      }
    };

    connect();
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, [isTimedOut]);

  // ─── Scan Control Handlers ───
  const handleStartScan = useCallback(() => {
    setIsScanning(true);
    setAutoPausedByDisconnect(false);
  }, []);

  const handleStopScan = useCallback(() => {
    setIsScanning(false);
    setAutoPausedByDisconnect(false);
  }, []);

  // ─── Audible alert for DAMAGED state (only active when connected and scanning) ───
  const isEffectivelyDisconnected = isTimedOut || !connected || !Boolean(telemetry.esp32_connected);

  useEffect(() => {
    if (currentState !== 'DAMAGED' || !isScanning || isEffectivelyDisconnected) return;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();

    return () => {
      oscillator.stop();
      audioCtx.close();
    };
  }, [currentState, isScanning, isEffectivelyDisconnected]);

  const handleCalibrationComplete = useCallback(() => setView('scanner'), []);
  const handleRecalibrate = useCallback(() => setView('calibration'), []);

  // ─── Styles ───
  const styles = {
    app: {
      minHeight: '100vh',
      background: '#08090A',
      color: '#E2E8F0',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 24px',
      background: '#111317',
      borderBottom: '1px solid #1E2229',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    },
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    logoOrb: {
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      background: '#3B82F6',
      boxShadow: '0 0 8px #3B82F680',
    },
    headerTitle: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '16px',
      fontWeight: 700,
      color: '#E2E8F0',
      letterSpacing: '3px',
    },
    headerVersion: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '9px',
      color: '#64748B',
      letterSpacing: '1px',
    },
    recalBtn: {
      background: '#1E2229',
      border: '1px solid #3B82F6',
      borderRadius: '6px',
      padding: '6px 14px',
      color: '#3B82F6',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s',
      letterSpacing: '1px',
    },
    stopBtn: {
      background: '#EF444420',
      border: '1px solid #EF4444',
      borderRadius: '6px',
      padding: '6px 14px',
      color: '#EF4444',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      fontWeight: 800,
      cursor: 'pointer',
      transition: 'all 0.2s',
      letterSpacing: '1px',
      boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)'
    },
    startBtn: {
      background: '#10B98120',
      border: '1px solid #10B981',
      borderRadius: '6px',
      padding: '6px 14px',
      color: '#10B981',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      fontWeight: 800,
      cursor: 'pointer',
      transition: 'all 0.2s',
      letterSpacing: '1px',
      boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)'
    },
    connBar: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      margin: '12px 24px',
      background: '#111317',
      border: `1px solid ${isEffectivelyDisconnected ? '#F59E0B50' : '#10B98140'}`,
      borderRadius: '8px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '10px',
      color: '#94A3B8',
      letterSpacing: '1px',
    },
    connDot: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: isEffectivelyDisconnected ? '#F59E0B' : (!isScanning ? '#64748B' : '#10B981'),
      boxShadow: isEffectivelyDisconnected ? '0 0 6px #F59E0B' : '0 0 6px #10B981',
    },
    main: {
      display: 'grid',
      gridTemplateColumns: '1fr 380px',
      gap: '16px',
      padding: '0 24px 32px',
      maxWidth: '1400px',
      margin: '0 auto',
    },
    mainSingle: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '0 24px 32px',
    },
    chartsCol: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      transition: 'opacity 0.3s ease, filter 0.3s ease',
    },
    footer: {
      textAlign: 'center',
      padding: '16px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '9px',
      color: '#475569',
      borderTop: '1px solid #1E2229',
      letterSpacing: '1px',
    },
    synBadge: {
      background: '#F59E0B20',
      border: '1px solid #F59E0B40',
      borderRadius: '4px',
      padding: '2px 8px',
      color: '#F59E0B',
      fontSize: '8px',
      fontWeight: 700,
      letterSpacing: '1px',
    },
  };

  return (
    <div style={styles.app}>
      {/* ─── Header ─── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoOrb} />
          <div>
            <div style={styles.headerTitle}>MAG-CIPHER</div>
            <div style={styles.headerVersion}>SMART WIRE SCANNER v2.0</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {view === 'scanner' && (
            <>
              {isScanning ? (
                <button
                  style={styles.stopBtn}
                  onClick={handleStopScan}
                  title="Completely stop and terminate live scanning"
                >
                  ■ STOP SCAN
                </button>
              ) : (
                <button
                  style={styles.startBtn}
                  onClick={handleStartScan}
                  disabled={isEffectivelyDisconnected}
                  title="Start/Resume live scanner"
                >
                  ▶ START SCAN
                </button>
              )}
              <button style={styles.recalBtn} onClick={handleRecalibrate}>
                ⟲ RECALIBRATE
              </button>
            </>
          )}
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isEffectivelyDisconnected ? '#F59E0B' : (!isScanning ? '#64748B' : '#10B981'),
          }} />
        </div>
      </header>

      {/* ─── Content ─── */}
      {view === 'calibration' ? (
        <div style={styles.mainSingle}>
          <CalibrationWizard
            onComplete={handleCalibrationComplete}
            esp32Connected={!isEffectivelyDisconnected}
            esp32Ip={telemetry.esp32_ip || '192.168.0.170'}
            telemetry={telemetry}
          />
        </div>
      ) : (
        <>
          {/* Heartbeat / Disconnect Pulsing Banner */}
          {isEffectivelyDisconnected && (
            <div style={{
              background: '#16191E',
              border: '1px solid #F59E0B',
              borderRadius: '10px',
              padding: '14px 20px',
              margin: '0 24px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'JetBrains Mono, monospace',
              color: '#FCD34D',
              boxShadow: '0 0 25px rgba(245, 158, 11, 0.3)',
              animation: 'amber-pulse 1.8s ease-in-out infinite'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#F59E0B', letterSpacing: '1px' }}>
                    ⚠️ ESP32 DISCONNECTED - CHECK POWER & WIFI ({telemetry.esp32_ip || '192.168.0.170'})
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>
                    No telemetry packets received for more than 2 seconds. Live scanning stopped automatically. Check power switch on wand and Wi-Fi connection.
                  </div>
                </div>
              </div>
              <div style={{
                background: '#F59E0B20',
                border: '1px solid #F59E0B',
                color: '#F59E0B',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '1px',
                whiteSpace: 'nowrap'
              }}>
                AWAITING WAND...
              </div>
            </div>
          )}

          {/* Connection status bar */}
          <div style={styles.connBar}>
            <div style={styles.connDot} />
            <span style={{ flex: 1, letterSpacing: '1px' }}>
              {isEffectivelyDisconnected
                ? `⚠️ ESP32 DISCONNECTED (${telemetry.esp32_ip || '192.168.0.170'}) — TELEMETRY PAUSED`
                : (!isScanning
                  ? '⏸ SCAN TERMINATED / STOPPED'
                  : 'STREAM ACTIVE — NOISE-FILTERED LIVE SCAN')}
            </span>
            <span style={{ color: '#64748B' }}>{packetCount} PKT</span>
            {telemetry.synthetic ? (
              <span style={styles.synBadge}>SYNTHETIC DEMO</span>
            ) : (
              <span style={{
                ...styles.synBadge,
                background: isEffectivelyDisconnected ? '#F59E0B20' : '#10B98120',
                borderColor: isEffectivelyDisconnected ? '#F59E0B40' : '#10B98140',
                color: isEffectivelyDisconnected ? '#F59E0B' : '#10B981'
              }}>
                {isEffectivelyDisconnected ? 'ESP32 OFFLINE' : 'ESP32 ONLINE'}
              </span>
            )}
          </div>

          <main style={styles.main}>
            {/* Left: Waveforms (Grayed-out when disconnected or scanning is stopped) */}
            <div
              style={{
                ...styles.chartsCol,
                opacity: isEffectivelyDisconnected || !isScanning ? 0.35 : 1,
                filter: isEffectivelyDisconnected || !isScanning ? 'grayscale(100%)' : 'none',
                pointerEvents: isEffectivelyDisconnected || !isScanning ? 'none' : 'auto',
              }}
            >
              <WaveformCanvas
                data={ncvHistory}
                channels={['ncv']}
                title="NCV ELECTRIC FIELD STRENGTH (10-FRAME MEDIAN FILTERED)"
                height={180}
              />
              <WaveformCanvas
                data={magHistory}
                channels={['s1', 's2', 's3']}
                title="MAGNETIC FLUX — HALL SENSORS (S1 / S2 / S3)"
                height={180}
              />
            </div>

            {/* Right: Telemetry HUD with Dark Gray / Amber pulsing card */}
            <TelemetryHUD
              data={telemetry}
              state={isEffectivelyDisconnected ? 'DISCONNECTED' : currentState}
              confidence={isEffectivelyDisconnected ? 0 : confidence}
              isScanning={isScanning}
              isTimedOut={isEffectivelyDisconnected}
              onStartScan={handleStartScan}
              onStopScan={handleStopScan}
            />
          </main>
        </>
      )}

      {/* ─── Footer ─── */}
      <footer style={styles.footer}>
        MAG-CIPHER SMART WIRE SCANNER SUITE &nbsp;│&nbsp; FastAPI + ML Engine &nbsp;│&nbsp; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
