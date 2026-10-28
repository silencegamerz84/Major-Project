/**
 * DigitalBubbleLevel Component (Web)
 * ==================================
 * Interactive 2D spirit level visualizing wand tilt orientation (tiltX, tiltY).
 * Automatically converts raw accelerometer values (or degrees) into a 2D bubble offset.
 * Displays target rings, crosshairs, safe/level indicators, and a red warning banner:
 * "Wand Tilted: Hold flat against wall" if tilt exceeds the safe threshold (> 15°).
 */

import React, { useMemo } from 'react';

const SAFE_ANGLE_THRESHOLD = 15; // degrees

export default function DigitalBubbleLevel({
  tiltX = 0,
  tiltY = 0,
  tiltZ = 0,
  size = 130,
  disabled = false,
}) {
  // Convert acceleration/tilt to angles in degrees
  // If the values are acceleration in m/s^2 (normal gravity is ~9.8 m/s^2):
  const { angleX, angleY, totalTilt, isTilted } = useMemo(() => {
    let ax = Number(tiltX) || 0;
    let ay = Number(tiltY) || 0;
    let az = Number(tiltZ) || 9.8;

    let degX = 0;
    let degY = 0;

    // Check if input is already in degrees (e.g. |val| > 15 but reasonable) or m/s^2
    const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
    if (magnitude > 0.01) {
      // Standard pitch & roll calculation from accelerometer
      degX = Math.atan2(ax, Math.sqrt(ay * ay + az * az)) * (180 / Math.PI);
      degY = Math.atan2(ay, Math.sqrt(ax * ax + az * az)) * (180 / Math.PI);
    } else {
      degX = ax;
      degY = ay;
    }

    const total = Math.sqrt(degX * degX + degY * degY);
    const tilted = total > SAFE_ANGLE_THRESHOLD;

    return {
      angleX: degX,
      angleY: degY,
      totalTilt: total,
      isTilted: tilted,
    };
  }, [tiltX, tiltY, tiltZ]);

  // Radius of the circle viewport
  const radius = size / 2;
  const maxDeflection = radius - 16; // bubble size offset

  // Normalize deflection to pixel displacement
  // 30 degrees = max deflection to edge
  const maxAngle = 30;
  const clampedX = Math.max(-maxAngle, Math.min(maxAngle, angleX));
  const clampedY = Math.max(-maxAngle, Math.min(maxAngle, angleY));

  const bubbleX = radius + (clampedX / maxAngle) * maxDeflection;
  const bubbleY = radius - (clampedY / maxAngle) * maxDeflection; // invert Y so tilting up moves bubble up

  // Colors
  const isLevel = totalTilt <= 5;
  const bubbleColor = disabled
    ? '#64748B'
    : isTilted
    ? '#EF4444'
    : isLevel
    ? '#10B981'
    : '#38BDF8';

  const ringColor = disabled
    ? '#1E2229'
    : isTilted
    ? '#EF444450'
    : '#334155';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      position: 'relative',
    }}>
      {/* 2D Spirit Level Viewport */}
      <div style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: '#0D0F12',
        border: `2px solid ${isTilted && !disabled ? '#EF4444' : '#1E2229'}`,
        boxShadow: isTilted && !disabled
          ? '0 0 20px rgba(239, 68, 68, 0.4), inset 0 0 15px rgba(239, 68, 68, 0.2)'
          : 'inset 0 0 20px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}>
        {/* Crosshairs */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: '1px',
          background: '#1E2229',
          transform: 'translateY(-50%)',
        }} />
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: '1px',
          background: '#1E2229',
          transform: 'translateX(-50%)',
        }} />

        {/* Outer Safe Target Ring (15° boundary) */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: `${(SAFE_ANGLE_THRESHOLD / maxAngle) * (maxDeflection * 2)}px`,
          height: `${(SAFE_ANGLE_THRESHOLD / maxAngle) * (maxDeflection * 2)}px`,
          borderRadius: '50%',
          border: `1px dashed ${ringColor}`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />

        {/* Inner Deadzone Ring (5° perfect level) */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          border: `1px solid ${isLevel && !disabled ? '#10B98180' : '#1E2229'}`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />

        {/* Floating Digital Bubble Indicator */}
        <div style={{
          position: 'absolute',
          left: `${bubbleX}px`,
          top: `${bubbleY}px`,
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, #FFFFFF, ${bubbleColor})`,
          boxShadow: `0 0 14px ${bubbleColor}`,
          transform: 'translate(-50%, -50%)',
          transition: 'left 0.1s linear, top 0.1s linear, background 0.2s ease',
        }}>
          {/* Bubble reflection highlight */}
          <div style={{
            position: 'absolute',
            top: '3px',
            left: '4px',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.8)',
          }} />
        </div>
      </div>

      {/* Degrees readout */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        color: isTilted && !disabled ? '#EF4444' : '#94A3B8',
        fontWeight: 700,
      }}>
        <span>X: {disabled ? '—' : `${angleX >= 0 ? '+' : ''}${angleX.toFixed(1)}°`}</span>
        <span>Y: {disabled ? '—' : `${angleY >= 0 ? '+' : ''}${angleY.toFixed(1)}°`}</span>
        <span style={{
          color: isTilted && !disabled ? '#EF4444' : isLevel && !disabled ? '#10B981' : '#64748B',
          fontWeight: 800,
        }}>
          {disabled ? 'OFFLINE' : isLevel ? 'FLAT' : `${totalTilt.toFixed(1)}°`}
        </span>
      </div>

      {/* Tilt Exceeded Warning Banner */}
      {isTilted && !disabled && (
        <div style={{
          background: '#EF444420',
          border: '1px solid #EF4444',
          borderRadius: '6px',
          padding: '4px 10px',
          color: '#EF4444',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.5px',
          textAlign: 'center',
          animation: 'damaged-pulse 1s ease-in-out infinite',
          boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)',
          whiteSpace: 'nowrap',
        }}>
          ⚠️ Wand Tilted: Hold flat against wall
        </div>
      )}
    </div>
  );
}
