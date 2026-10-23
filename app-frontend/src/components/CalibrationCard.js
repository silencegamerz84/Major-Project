/**
 * CalibrationCard Component
 * =========================
 * Individual calibration step card with progress bar,
 * status indicators, and retry/clear functionality.
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';

export default function CalibrationCard({
  step = 1,
  title = '',
  description = '',
  instruction = '',
  status = 'pending', // 'pending' | 'recording' | 'complete' | 'error'
  progress = 0,
  stats = null,
  onStart,
  onRetry,
  disabled = false,
  accentColor = '#3B82F6',
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    if (status === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [status]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const statusIcon = {
    pending: '○',
    recording: '◉',
    complete: '✓',
    error: '✗',
  };

  const statusColor = {
    pending: '#64748B',
    recording: accentColor,
    complete: '#10B981',
    error: '#EF4444',
  };

  return (
    <Animated.View style={[
      styles.card,
      { borderColor: statusColor[status], transform: [{ scale: pulseAnim }] }
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepNumber}>STEP {step}</Text>
        </View>
        <Text style={[styles.statusIcon, { color: statusColor[status] }]}>
          {statusIcon[status]}
        </Text>
      </View>

      {/* Title & Description */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {/* Instruction callout */}
      <View style={styles.instructionBox}>
        <Text style={styles.instructionText}>📋 {instruction}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressWidth, backgroundColor: accentColor },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{progress}/100 SAMPLES</Text>
      </View>

      {/* Stats display (after completion) */}
      {stats && status === 'complete' && (
        <View style={styles.statsContainer}>
          {Object.entries(stats).map(([key, val]) => (
            <View key={key} style={styles.statItem}>
              <Text style={styles.statLabel}>{key.toUpperCase()}</Text>
              <Text style={styles.statValue}>
                {typeof val === 'number' ? val.toFixed(5) : val}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        {status === 'pending' && (
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: accentColor }, disabled && styles.disabledBtn]}
            onPress={onStart}
            disabled={disabled}
          >
            <Text style={styles.startBtnText}>▶ BEGIN RECORDING</Text>
          </TouchableOpacity>
        )}
        {(status === 'complete' || status === 'error') && (
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={onRetry}
          >
            <Text style={styles.retryBtnText}>⟲ RETRY / CLEAR</Text>
          </TouchableOpacity>
        )}
        {status === 'recording' && (
          <View style={styles.recordingIndicator}>
            <View style={[styles.recordingDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.recordingText, { color: accentColor }]}>RECORDING...</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111317',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepBadge: {
    backgroundColor: '#1E2229',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stepNumber: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  statusIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  title: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  instructionBox: {
    backgroundColor: '#0D0F12',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  instructionText: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#1E2229',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'right',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    backgroundColor: '#0D0F12',
    borderRadius: 8,
    padding: 10,
  },
  statItem: {
    width: '30%',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 7,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  statValue: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  actions: {
    alignItems: 'center',
  },
  startBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  retryBtn: {
    backgroundColor: '#1E2229',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    width: '100%',
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});
