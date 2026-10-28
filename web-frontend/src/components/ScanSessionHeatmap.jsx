/**
 * ScanSessionHeatmap Component (Web)
 * ==================================
 * Horizontal timeline ribbon recording ML inference states every 100ms.
 * Color codes:
 *   - Green: LIVE (Healthy energized wire)
 *   - Red:   DAMAGED (Wire break detected)
 *   - Gray:  IDLE (Ambient open air)
 *
 * Displays second-markers (0s, 5s, 10s...) along the timeline axis so users can
 * correlate a 'DAMAGED' spike directly to their physical scan position on the wall.
 */

import React, { useRef, useEffect } from 'react';

const STATE_COLORS = {
  LIVE: '#10B981',       // Green
  DAMAGED: '#EF4444',    // Red
  IDLE: '#475569',       // Gray
  DISCONNECTED: '#1E2229',
};

export default function ScanSessionHeatmap({
  history = [], // Array of { state, timestamp, ncv }
  maxPoints = 300, // 300 points @ 100ms = 30-second rolling window
  intervalMs = 100,
  isScanning = true,
  disabled = false,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#0D0F12';
    ctx.fillRect(0, 0, width, height);

    const ribbonHeight = 36;
    const axisY = ribbonHeight;

    if (disabled || history.length === 0) {
      // Empty ribbon placeholder
      ctx.fillStyle = '#16191E';
      ctx.fillRect(0, 4, width, ribbonHeight - 8);
      ctx.strokeStyle = '#1E2229';
      ctx.strokeRect(0, 4, width, ribbonHeight - 8);

      ctx.fillStyle = '#475569';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(disabled ? 'SCANNER OFFLINE / DISCONNECTED' : 'AWAITING SCAN SAMPLES...', width / 2, ribbonHeight / 2 + 3);
      return;
    }

    const totalSlots = maxPoints;
    const segmentWidth = width / totalSlots;

    // Draw timeline segments from left to right (oldest to newest)
    // Pad left if history is shorter than totalSlots
    const startIndex = Math.max(0, history.length - totalSlots);
    const visibleData = history.slice(startIndex);
    const offset = totalSlots - visibleData.length;

    visibleData.forEach((sample, i) => {
      const x = (offset + i) * segmentWidth;
      const sampleState = sample.state || 'IDLE';
      const color = STATE_COLORS[sampleState] || STATE_COLORS.IDLE;

      ctx.fillStyle = color;
      // Slight vertical rounding / fill
      ctx.fillRect(x, 4, Math.max(segmentWidth + 0.5, 1.5), ribbonHeight - 8);

      // Highlight damaged sections with top/bottom glow line
      if (sampleState === 'DAMAGED') {
        ctx.fillStyle = '#FF6B6B';
        ctx.fillRect(x, 2, segmentWidth, 2);
        ctx.fillRect(x, ribbonHeight - 4, segmentWidth, 2);
      }
    });

    // Outer border for ribbon
    ctx.strokeStyle = '#1E2229';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 4, width, ribbonHeight - 8);

    // ─── Draw Time Markers & Ticks Along Axis ───
    // Total window in seconds:
    const totalSeconds = (totalSlots * intervalMs) / 1000; // e.g. 30 seconds
    const stepSeconds = totalSeconds >= 30 ? 5 : 2; // tick every 5s

    ctx.fillStyle = '#64748B';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let sec = 0; sec <= totalSeconds; sec += stepSeconds) {
      // Relative time: T - 30s ... T - 0s
      const x = ((totalSeconds - sec) / totalSeconds) * width;
      // Inverted so right is 0s (NOW), left is -30s:
      const markerX = width - (sec / totalSeconds) * width;

      // Tick line
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(markerX, axisY - 2);
      ctx.lineTo(markerX, axisY + 4);
      ctx.stroke();

      // Label text
      const label = sec === 0 ? 'NOW (0s)' : `-${sec}s`;
      ctx.fillText(label, markerX, axisY + 6);
    }

    // "LIVE SCAN POSITION" playhead needle on the right
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width - 1, 1);
    ctx.lineTo(width - 1, ribbonHeight - 1);
    ctx.stroke();

  }, [history, maxPoints, intervalMs, disabled]);

  return (
    <div style={{
      background: '#111317',
      border: '1px solid #1E2229',
      borderRadius: '10px',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {/* Ribbon Header with Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          fontWeight: 700,
          color: '#E2E8F0',
          letterSpacing: '1px',
        }}>
          <span>⏱ SCAN SESSION HEATMAP (30s ROLLING TIMELINE)</span>
          {isScanning && !disabled && (
            <span style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 8px #10B981',
              animation: 'pulse-glow 1.5s infinite',
            }} />
          )}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          color: '#94A3B8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: STATE_COLORS.LIVE }} />
            <span>LIVE (OK)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: STATE_COLORS.DAMAGED }} />
            <span>DAMAGED (BREAK)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: STATE_COLORS.IDLE }} />
            <span>IDLE</span>
          </div>
        </div>
      </div>

      {/* Canvas Heatmap Ribbon */}
      <div style={{ width: '100%', height: '54px', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={54}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            borderRadius: '6px',
          }}
        />
      </div>
    </div>
  );
}
