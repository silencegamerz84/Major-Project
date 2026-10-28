/**
 * DigitalBubbleLevel Component (React Native / Mobile App)
 * ========================================================
 * Visualizes tiltX and tiltY as a 2D spirit level (dot inside a target circle).
 * Displays safe target threshold circle (15°), deadzone (5°), and degrees readout.
 * If tilt exceeds 15°, the dot turns red and an alert overlay is displayed:
 * "Wand Tilted: Hold flat against wall".
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const SAFE_ANGLE_THRESHOLD = 15; // degrees

export default function DigitalBubbleLevel({
  tiltX = 0,
  tiltY = 0,
  tiltZ = 0,
  size = 110,
  disabled = false,
}) {
  const { angleX, angleY, totalTilt, isTilted } = useMemo(() => {
    let ax = Number(tiltX) || 0;
    let ay = Number(tiltY) || 0;
    let az = Number(tiltZ) || 9.8;

    let degX = 0;
    let degY = 0;

    const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
    if (magnitude > 0.01) {
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

  const radius = size / 2;
  const maxDeflection = radius - 14;
  const maxAngle = 30;

  const clampedX = Math.max(-maxAngle, Math.min(maxAngle, angleX));
  const clampedY = Math.max(-maxAngle, Math.min(maxAngle, angleY));

  const bubbleLeft = radius + (clampedX / maxAngle) * maxDeflection - 9;
  const bubbleTop = radius - (clampedY / maxAngle) * maxDeflection - 9;

  const isLevel = totalTilt <= 5;
  const bubbleColor = disabled
    ? '#64748B'
    : isTilted
    ? '#EF4444'
    : isLevel
    ? '#10B981'
    : '#38BDF8';

  const safeRingDiameter = (SAFE_ANGLE_THRESHOLD / maxAngle) * (maxDeflection * 2);

  return (
    <View style={styles.container}>
      {/* 2D Spirit Level Disc */}
      <View style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: isTilted && !disabled ? '#EF4444' : '#1E2229',
        }
      ]}>
        {/* Crosshairs */}
        <View style={styles.crosshairH} />
        <View style={styles.crosshairV} />

        {/* 15° Safe Threshold Ring */}
        <View style={[
          styles.safeRing,
          {
            width: safeRingDiameter,
            height: safeRingDiameter,
            borderRadius: safeRingDiameter / 2,
            borderColor: isTilted && !disabled ? '#EF444460' : '#334155',
          }
        ]} />

        {/* 5° Perfect Level Deadzone */}
        <View style={[
          styles.levelRing,
          {
            borderColor: isLevel && !disabled ? '#10B98190' : '#1E2229',
          }
        ]} />

        {/* Floating Bubble Dot */}
        <View style={[
          styles.bubble,
          {
            left: bubbleLeft,
            top: bubbleTop,
            backgroundColor: bubbleColor,
            shadowColor: bubbleColor,
          }
        ]}>
          <View style={styles.bubbleHighlight} />
        </View>
      </View>

      {/* Degrees readout */}
      <View style={styles.readoutRow}>
        <Text style={[styles.readoutText, isTilted && !disabled && styles.alertText]}>
          X: {disabled ? '—' : `${angleX >= 0 ? '+' : ''}${angleX.toFixed(1)}°`}
        </Text>
        <Text style={[styles.readoutText, isTilted && !disabled && styles.alertText]}>
          Y: {disabled ? '—' : `${angleY >= 0 ? '+' : ''}${angleY.toFixed(1)}°`}
        </Text>
        <Text style={[
          styles.readoutStatus,
          { color: disabled ? '#64748B' : (isTilted ? '#EF4444' : isLevel ? '#10B981' : '#38BDF8') }
        ]}>
          {disabled ? 'OFFLINE' : (isLevel ? 'FLAT' : `${totalTilt.toFixed(1)}°`)}
        </Text>
      </View>

      {/* Warning Overlay Banner if > 15° */}
      {isTilted && !disabled && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>⚠️ Wand Tilted: Hold flat against wall</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  circle: {
    backgroundColor: '#0D0F12',
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  crosshairH: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#1E2229',
  },
  crosshairV: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#1E2229',
  },
  safeRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    borderWidth: 1,
    borderStyle: 'dashed',
    transform: [{ translateX: -35 }, { translateY: -35 }],
  },
  levelRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    transform: [{ translateX: -12 }, { translateY: -12 }],
  },
  bubble: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  bubbleHighlight: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  readoutText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  alertText: {
    color: '#EF4444',
  },
  readoutStatus: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  warningBox: {
    backgroundColor: '#EF444420',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  warningText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});
