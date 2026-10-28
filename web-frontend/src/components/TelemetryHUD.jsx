/**
 * TelemetryHUD Component
 * ======================
 * Bento-style telemetry dashboard with sensor cards,
 * tilt orientation display, separate scan termination controls,
 * and dark gray/amber pulsing Hero Card for DISCONNECTED state.
 */

import React from 'react';

const STATE_COLORS = {
  IDLE: '#64748B',
  LIVE: '#10B981',
  DAMAGED: '#EF4444',
  DISCONNECTED: '#F59E0B',
};

const SENSOR_CONFIG = [
  { key: 's1', label: 'S1', sublabel: 'HALL SENSOR A0', color: '#3B82F6' },
  { key: 's2', label: 'S2', sublabel: 'HALL SENSOR A1', color: '#8B5CF6' },
  { key: 's3', label: 'S3', sublabel: 'HALL SENSOR A2', color: '#F59E0B' },
  { key: 'ncv', label: 'NCV', sublabel: 'E-FIELD PROBE A3', color: '#10B981' },
];

const TILT_CONFIG = [
  { key: 'tiltX', label: 'X-AXIS', unit: 'm/s²' },
  { key: 'tiltY', label: 'Y-AXIS', unit: 'm/s²' },
  { key: 'tiltZ', label: 'Z-AXIS', unit: 'm/s²' },
];

import DigitalBubbleLevel from './DigitalBubbleLevel';

export default function TelemetryHUD({
  data = {},
  state = 'IDLE',
  confidence = 0,
  isScanning = true,
  isTimedOut = false,
  onStartScan,
  onStopScan,
}) {
  const isDisconnected = isTimedOut || !Boolean(data.esp32_connected) || state === 'DISCONNECTED';
  const stateColor = isDisconnected
    ? '#F59E0B'
    : (!isScanning ? '#64748B' : (STATE_COLORS[state] || STATE_COLORS.IDLE));

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const sectionTitleStyle = {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10px',
    fontWeight: 700,
    color: '#64748B',
    letterSpacing: '2px',
    marginBottom: '4px',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  };

  return (
    <div style={containerStyle}>
      {/* ─── Hero Status Card ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: isDisconnected ? '#16191E' : '#111317',
        border: `1px solid ${isDisconnected ? '#F59E0B' : stateColor + '40'}`,
        borderRadius: '10px',
        padding: '14px 18px',
        boxShadow: isDisconnected
          ? '0 0 25px rgba(245, 158, 11, 0.35)'
          : (!isScanning
            ? '0 0 20px rgba(100, 116, 139, 0.15)'
            : state === 'DAMAGED'
            ? '0 0 35px rgba(239, 68, 68, 0.3)'
            : state === 'LIVE'
            ? '0 0 20px rgba(16, 185, 129, 0.15)'
            : 'none'),
        animation: isDisconnected
          ? 'amber-pulse 1.8s ease-in-out infinite'
          : (!isScanning ? 'none' : (state === 'DAMAGED' ? 'damaged-pulse 1s ease-in-out infinite' : 'none')),
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Animated Orb */}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${stateColor}, ${stateColor}30)`,
            boxShadow: `0 0 22px ${stateColor}80`,
            animation: isDisconnected
              ? 'pulse-glow 1.2s ease-in-out infinite'
              : (!isScanning ? 'none' : (
                state === 'DAMAGED' ? 'pulse-glow 0.5s ease-in-out infinite' : 
                state === 'LIVE' ? 'pulse-glow 2s ease-in-out infinite' : 'none'
              )),
          }} />
          <div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
              fontWeight: 800,
              color: stateColor,
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {isDisconnected && '⚠️ ESP32 DISCONNECTED - CHECK POWER & WIFI'}
              {!isDisconnected && !isScanning && '⏸ SCAN TERMINATED / STOPPED'}
              {!isDisconnected && isScanning && state === 'IDLE' && 'SCANNER READY — IDLE'}
              {!isDisconnected && isScanning && state === 'LIVE' && '⚡ HEALTHY ENERGIZED WIRE'}
              {!isDisconnected && isScanning && state === 'DAMAGED' && '⚠ WIRE BREAK DETECTED'}
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              color: isDisconnected ? '#FCD34D' : '#94A3B8',
              marginTop: '3px',
            }}>
              {isDisconnected && 'Telemetry lost (>2s heartbeat timeout). Verify ESP32 power switch and Wi-Fi.'}
              {!isDisconnected && !isScanning && 'Live inference paused. Click START SCAN to begin telemetry acquisition.'}
              {!isDisconnected && isScanning && state === 'IDLE' && 'Position wand near wire conduit to begin scanning'}
              {!isDisconnected && isScanning && state === 'LIVE' && 'Continuous electric field detected — conductor intact'}
              {!isDisconnected && isScanning && state === 'DAMAGED' && 'Sharp voltage drop detected — broken wire segment located'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Separate Scan Control Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {isScanning ? (
              <button
                onClick={onStopScan}
                style={{
                  background: '#EF444425',
                  border: '1px solid #EF4444',
                  color: '#EF4444',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  letterSpacing: '1px',
                  transition: 'all 0.2s',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)'
                }}
                title="Completely stop and terminate live scanning"
              >
                ■ STOP SCAN
              </button>
            ) : (
              <button
                onClick={onStartScan}
                disabled={isDisconnected}
                style={{
                  background: isDisconnected ? '#1E2229' : '#10B98125',
                  border: `1px solid ${isDisconnected ? '#475569' : '#10B981'}`,
                  color: isDisconnected ? '#64748B' : '#10B981',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: isDisconnected ? 'not-allowed' : 'pointer',
                  letterSpacing: '1px',
                  transition: 'all 0.2s',
                  boxShadow: isDisconnected ? 'none' : '0 0 10px rgba(16, 185, 129, 0.2)'
                }}
                title="Start live telemetry scanning"
              >
                ▶ START SCAN
              </button>
            )}
          </div>

          <div style={{ textAlign: 'right', minWidth: '70px' }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '18px',
              fontWeight: 800,
              color: stateColor,
            }}>
              {isDisconnected ? '0.0%' : `${confidence.toFixed(1)}%`}
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '8px',
              color: '#64748B',
              letterSpacing: '1px',
            }}>
              {isDisconnected ? 'OFFLINE' : 'CONFIDENCE'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Sensor Telemetry Bento Grid ─── */}
      <div>
        <div style={sectionTitleStyle}>ELECTROMAGNETIC TELEMETRY</div>
        <div style={gridStyle}>
          {SENSOR_CONFIG.map(({ key, label, sublabel, color }) => {
            const rawVal = data[key] !== undefined ? Number(data[key]) : 0;
            return (
              <div
                key={key}
                style={{
                  background: '#111317',
                  border: '1px solid #1E2229',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  position: 'relative',
                  overflow: 'hidden',
                  opacity: isDisconnected ? 0.4 : 1,
                  filter: isDisconnected ? 'grayscale(80%)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Accent top border */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: isDisconnected ? '#64748B' : color,
                }} />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}>
                  <div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isDisconnected ? '#64748B' : color,
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '8px',
                      color: '#475569',
                      letterSpacing: '0.5px',
                    }}>
                      {sublabel}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: isDisconnected ? '#64748B' : '#E2E8F0',
                  }}>
                    {isDisconnected ? '—' : rawVal.toFixed(3)}
                    <span style={{ fontSize: '10px', color: '#64748B', marginLeft: '2px' }}>V</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Digital Bubble Level (Replacing raw MPU6050 numbers) ─── */}
      <div>
        <div style={sectionTitleStyle}>MPU-6050 SPATIAL ORIENTATION (DIGITAL BUBBLE LEVEL)</div>
        <div style={{
          background: '#111317',
          border: '1px solid #1E2229',
          borderRadius: '10px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisconnected ? 0.4 : 1,
          filter: isDisconnected ? 'grayscale(80%)' : 'none',
          transition: 'all 0.3s ease',
        }}>
          <DigitalBubbleLevel
            tiltX={data.tiltX}
            tiltY={data.tiltY}
            tiltZ={data.tiltZ}
            size={120}
            disabled={isDisconnected}
          />
        </div>
      </div>
    </div>
  );
}
