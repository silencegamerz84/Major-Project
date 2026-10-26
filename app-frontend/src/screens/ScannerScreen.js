/**
 * ScannerScreen
 * =============
 * Live scanner view with real-time WebSocket telemetry streaming,
 * 2-second heartbeat monitor, robust disconnect handling,
 * grayed-out charts on disconnect/stop, and separate Stop Scan controls.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity
} from 'react-native';
import * as Haptics from 'expo-haptics';

// Safe fallback for Audio on Expo Go where native ExponentAV module is removed or unavailable
let Audio = null;
try {
  Audio = require('expo-av').Audio;
} catch (e) {
  console.log('[Audio] expo-av native module not available in this client, audio disabled');
}

import StatusBanner from '../components/StatusBanner';
import WaveformChart from '../components/WaveformChart';
import TelemetryGrid from '../components/TelemetryGrid';

const MAX_WAVEFORM_POINTS = 80;

export default function ScannerScreen({ wsUrl, backendUrl, colors }) {
  const [currentState, setCurrentState] = useState('IDLE');
  const [confidence, setConfidence] = useState(0);
  const [telemetry, setTelemetry] = useState({});
  const [ncvHistory, setNcvHistory] = useState([]);
  const [magHistory, setMagHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [packetCount, setPacketCount] = useState(0);
  const [isScanning, setIsScanning] = useState(true);

  const isScanningRef = useRef(true);
  const wsRef = useRef(null);
  const soundRef = useRef(null);
  const hapticIntervalRef = useRef(null);
  const previousStateRef = useRef('IDLE');
  const lastPacketTimeRef = useRef(Date.now());

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  // ─── 2-Second Heartbeat / Disconnect Monitor ───
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

  // ─── WebSocket Connection ───
  useEffect(() => {
    let reconnectTimeout;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setConnected(true);
          setIsTimedOut(false);
          lastPacketTimeRef.current = Date.now();
          console.log('[WS] Connected to backend stream');
        };

        ws.onmessage = (event) => {
          lastPacketTimeRef.current = Date.now();
          if (isTimedOut) {
            setIsTimedOut(false);
          }

          try {
            const data = JSON.parse(event.data);
            setPacketCount(prev => prev + 1);
            setTelemetry(data);

            const espConnected = Boolean(data.esp32_connected) && !Boolean(data.disconnected);

            if (!espConnected) {
              setCurrentState('DISCONNECTED');
              setNcvHistory([]);
              setMagHistory([]);
              return;
            }

            if (!isScanningRef.current) return;

            setCurrentState(data.state || 'IDLE');
            setConfidence(data.confidence || 0);

            // Update waveform histories
            setNcvHistory(prev => {
              const next = [...prev, { ncv: data.ncv }];
              return next.length > MAX_WAVEFORM_POINTS ? next.slice(-MAX_WAVEFORM_POINTS) : next;
            });

            setMagHistory(prev => {
              const next = [...prev, { s1: data.s1, s2: data.s2, s3: data.s3 }];
              return next.length > MAX_WAVEFORM_POINTS ? next.slice(-MAX_WAVEFORM_POINTS) : next;
            });
          } catch (e) {
            console.warn('[WS] Parse error:', e);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          setIsTimedOut(true);
          setCurrentState('DISCONNECTED');
          setNcvHistory([]);
          setMagHistory([]);
          console.log('[WS] Disconnected, reconnecting in 2s...');
          reconnectTimeout = setTimeout(connect, 2000);
        };

        ws.onerror = (error) => {
          console.warn('[WS] Error:', error.message);
          setIsTimedOut(true);
          setCurrentState('DISCONNECTED');
          setNcvHistory([]);
          setMagHistory([]);
          ws.close();
        };

        wsRef.current = ws;
      } catch (e) {
        console.warn('[WS] Connection failed:', e);
        setIsTimedOut(true);
        setCurrentState('DISCONNECTED');
        setNcvHistory([]);
        setMagHistory([]);
        reconnectTimeout = setTimeout(connect, 2000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [wsUrl]);

  // ─── Separate Scan Control Handlers ───
  const handleStartScan = useCallback(() => {
    setIsScanning(true);
  }, []);

  const handleStopScan = useCallback(() => {
    setIsScanning(false);
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
  }, []);

  const isEffectivelyDisconnected = isTimedOut || !connected || !Boolean(telemetry.esp32_connected);

  // ─── DAMAGED State: Haptic + Audio Feedback ───
  useEffect(() => {
    if (!isScanning || isEffectivelyDisconnected) {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      previousStateRef.current = 'IDLE';
      return;
    }

    const triggerDamagedFeedback = async () => {
      if (currentState === 'DAMAGED' && previousStateRef.current !== 'DAMAGED') {
        // Start haptic vibration pattern
        hapticIntervalRef.current = setInterval(async () => {
          try {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Error
            );
          } catch (e) {
            // Haptics not available on all devices
          }
        }, 400);

        // Start audible alert
        if (Audio && Audio.Sound) {
          try {
            const { sound } = await Audio.Sound.createAsync(
              { uri: 'https://www.soundjay.com/buttons/beep-01a.mp3' },
              { isLooping: true, volume: 1.0 }
            );
            soundRef.current = sound;
            await sound.playAsync();
          } catch (e) {
            console.warn('[Audio] Alert sound failed:', e.message);
          }
        }
      } else if (currentState !== 'DAMAGED' && previousStateRef.current === 'DAMAGED') {
        if (hapticIntervalRef.current) {
          clearInterval(hapticIntervalRef.current);
          hapticIntervalRef.current = null;
        }

        if (soundRef.current) {
          try {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
          } catch (e) { /* clean */ }
          soundRef.current = null;
        }
      }

      previousStateRef.current = currentState;
    };

    triggerDamagedFeedback();

    return () => {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
      }
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [currentState, isScanning, isEffectivelyDisconnected]);

  // ─── Connection Status Bar ───
  const ConnectionBar = () => (
    <View style={[
      styles.connectionBar,
      { borderColor: isEffectivelyDisconnected ? '#F59E0B' : (!isScanning ? '#64748B' : '#10B981') }
    ]}>
      <View style={[
        styles.connectionDot,
        { backgroundColor: isEffectivelyDisconnected ? '#F59E0B' : (!isScanning ? '#64748B' : '#10B981') }
      ]} />
      <Text style={styles.connectionText}>
        {isEffectivelyDisconnected
          ? 'ESP32 DISCONNECTED (>2s)'
          : (!isScanning ? 'SCAN STOPPED' : 'STREAM ACTIVE')}
      </Text>
      <Text style={styles.packetText}>{packetCount} PKT</Text>
      {telemetry.synthetic && (
        <View style={styles.syntheticBadge}>
          <Text style={styles.syntheticText}>SYN</Text>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Connection status */}
      <ConnectionBar />

      {/* Dedicated Scan Control Buttons */}
      <View style={styles.scanControlsRow}>
        {isScanning ? (
          <TouchableOpacity
            style={styles.stopScanBtn}
            onPress={handleStopScan}
          >
            <Text style={styles.stopScanText}>■ STOP SCAN</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.startScanBtn,
              isEffectivelyDisconnected && styles.disabledScanBtn
            ]}
            onPress={handleStartScan}
            disabled={isEffectivelyDisconnected}
          >
            <Text style={[
              styles.startScanText,
              isEffectivelyDisconnected && styles.disabledScanText
            ]}>
              ▶ START SCAN
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dynamic Status Banner with Amber Pulsing for DISCONNECTED */}
      <StatusBanner
        state={isEffectivelyDisconnected ? 'DISCONNECTED' : currentState}
        confidence={isEffectivelyDisconnected ? 0 : confidence}
      />

      {/* NCV Waveform (Grayed-out when disconnected or stopped) */}
      <View style={{ opacity: isEffectivelyDisconnected || !isScanning ? 0.35 : 1 }}>
        <WaveformChart
          data={ncvHistory}
          channels={['ncv']}
          title="NCV ELECTRIC FIELD (10-FRAME MEDIAN)"
        />
      </View>

      {/* Magnetic Sensor Waveform (Grayed-out when disconnected or stopped) */}
      <View style={{ opacity: isEffectivelyDisconnected || !isScanning ? 0.35 : 1 }}>
        <WaveformChart
          data={magHistory}
          channels={['s1', 's2', 's3']}
          title="MAGNETIC FLUX — HALL SENSORS"
        />
      </View>

      {/* Telemetry Grid */}
      <View style={{ opacity: isEffectivelyDisconnected ? 0.4 : 1 }}>
        <TelemetryGrid data={telemetry} state={isEffectivelyDisconnected ? 'DISCONNECTED' : currentState} />
      </View>

      {/* Timestamp */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {telemetry.timestamp
            ? `Last update: ${new Date(telemetry.timestamp * 1000).toLocaleTimeString()}`
            : 'Awaiting data...'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08090A',
  },
  content: {
    paddingBottom: 32,
  },
  connectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111317',
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  connectionText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  packetText: {
    fontSize: 9,
    color: '#64748B',
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  syntheticBadge: {
    backgroundColor: '#F59E0B20',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  syntheticText: {
    fontSize: 8,
    color: '#F59E0B',
    fontWeight: '700',
  },
  scanControlsRow: {
    marginHorizontal: 12,
    marginVertical: 6,
  },
  stopScanBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  stopScanText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  startScanBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  startScanText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  disabledScanBtn: {
    backgroundColor: '#16191E',
    borderColor: '#475569',
  },
  disabledScanText: {
    color: '#64748B',
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E2229',
    marginHorizontal: 12,
  },
  footerText: {
    fontSize: 9,
    color: '#475569',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});
