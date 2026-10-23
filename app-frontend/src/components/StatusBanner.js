/**
 * StatusBanner Component
 * ======================
 * Dynamic pulsating banner reflecting wire states and
 * dark gray/amber pulsing banner for DISCONNECTED state.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';

const STATE_CONFIG = {
  IDLE: {
    color: '#64748B',
    bgColor: '#111317',
    label: 'SCANNER READY',
    sublabel: 'POSITION WAND NEAR CONDUIT',
    icon: '◎',
  },
  LIVE: {
    color: '#10B981',
    bgColor: '#111317',
    label: 'HEALTHY ENERGIZED WIRE',
    sublabel: 'CONTINUOUS ELECTRIC FIELD DETECTED',
    icon: '⚡',
  },
  DAMAGED: {
    color: '#EF4444',
    bgColor: '#161113',
    label: '⚠ WIRE BREAK DETECTED',
    sublabel: 'SIGNAL DROP — CHECK CONDUIT INTEGRITY',
    icon: '⊘',
  },
  DISCONNECTED: {
    color: '#F59E0B',
    bgColor: '#16191E',
    label: '⚠️ ESP32 DISCONNECTED - CHECK POWER & WIFI',
    sublabel: 'TELEMETRY LOST (>2s TIMEOUT) — CHECK BATTERY & WI-FI',
    icon: '⚠️',
  },
};

export default function StatusBanner({ state = 'IDLE', confidence = 0 }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const config = STATE_CONFIG[state] || STATE_CONFIG.IDLE;

  useEffect(() => {
    if (state === 'DAMAGED') {
      // Rapid crimson pulse for DAMAGED state
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.97,
            duration: 250,
            useNativeDriver: true,
          }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.9,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (state === 'DISCONNECTED') {
      // Amber pulse for DISCONNECTED state
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.98,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1.0,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (state === 'LIVE') {
      // Gentle emerald glow
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.7,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      pulseAnim.setValue(1);
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.3);
    }

    return () => {
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
    };
  }, [state]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          borderColor: config.color,
          backgroundColor: config.bgColor || '#111317',
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      {/* Status orb */}
      <Animated.View
        style={[
          styles.orb,
          {
            backgroundColor: config.color,
            opacity: glowAnim,
            shadowColor: config.color,
          },
        ]}
      />

      <View style={styles.textContainer}>
        <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
        <Text style={styles.sublabel}>{config.sublabel}</Text>
      </View>

      {/* Confidence indicator */}
      <View style={styles.confidenceContainer}>
        <Text style={[styles.confidenceValue, { color: config.color }]}>
          {state === 'DISCONNECTED' ? 'OFFLINE' : `${confidence.toFixed(1)}%`}
        </Text>
        <Text style={styles.confidenceLabel}>
          {state === 'DISCONNECTED' ? 'STATUS' : 'CONFIDENCE'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111317',
    borderWidth: 1.5,
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 14,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  orb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  textContainer: {
    flex: 1,
  },
  icon: {
    fontSize: 14,
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  sublabel: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  confidenceContainer: {
    alignItems: 'center',
    minWidth: 64,
  },
  confidenceValue: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  confidenceLabel: {
    fontSize: 8,
    color: '#64748B',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});
