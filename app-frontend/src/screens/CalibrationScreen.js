/**
 * CalibrationScreen
 * =================
 * Two-step calibration wizard that guides the user through:
 * Step 1: IDLE Baseline (Ambient Air)
 * Step 2: LIVE Wire Reference (Healthy 230V Wire)
 * Then trains the RandomForestClassifier ML model.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform
} from 'react-native';
import CalibrationCard from '../components/CalibrationCard';

export default function CalibrationScreen({ backendUrl, onComplete, colors }) {
  const [idleStatus, setIdleStatus] = useState('pending');
  const [liveStatus, setLiveStatus] = useState('pending');
  const [idleProgress, setIdleProgress] = useState(0);
  const [liveProgress, setLiveProgress] = useState(0);
  const [idleStats, setIdleStats] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState(null);

  // ─── Start IDLE calibration ───
  const startIdleCalibration = useCallback(async () => {
    setIdleStatus('recording');
    setIdleProgress(0);

    // Poll real progress from backend status
    const progressPoll = setInterval(async () => {
      try {
        const sRes = await fetch(`${backendUrl}/api/status`);
        const sData = await sRes.json();
        const lr = sData.latest_reading || {};
        if (lr.calibrating && lr.calibration_target === 'idle') {
          setIdleProgress(lr.calibration_progress || 0);
        }
      } catch (e) { /* ignore */ }
    }, 150);

    try {
      const response = await fetch(`${backendUrl}/api/calibrate/idle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      clearInterval(progressPoll);
      setIdleProgress(100);
      setIdleStats(data.stats);
      setIdleStatus('complete');
    } catch (error) {
      clearInterval(progressPoll);
      setIdleStatus('error');
      Alert.alert('Calibration Error', `IDLE calibration failed: ${error.message}`);
    }
  }, [backendUrl]);

  // ─── Start LIVE calibration ───
  const startLiveCalibration = useCallback(async () => {
    setLiveStatus('recording');
    setLiveProgress(0);

    const progressPoll = setInterval(async () => {
      try {
        const sRes = await fetch(`${backendUrl}/api/status`);
        const sData = await sRes.json();
        const lr = sData.latest_reading || {};
        if (lr.calibrating && lr.calibration_target === 'live') {
          setLiveProgress(lr.calibration_progress || 0);
        }
      } catch (e) { /* ignore */ }
    }, 150);

    try {
      const response = await fetch(`${backendUrl}/api/calibrate/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      clearInterval(progressPoll);
      setLiveProgress(100);
      setLiveStats(data.stats);
      setLiveStatus('complete');
    } catch (error) {
      clearInterval(progressPoll);
      setLiveStatus('error');
      Alert.alert('Calibration Error', `LIVE calibration failed: ${error.message}`);
    }
  }, [backendUrl]);

  // ─── Retry / Clear handlers ───
  const retryIdle = useCallback(async () => {
    try {
      await fetch(`${backendUrl}/api/calibrate/reset/idle`, { method: 'POST' });
    } catch (e) { /* Continue anyway */ }
    setIdleStatus('pending');
    setIdleProgress(0);
    setIdleStats(null);
    setTrainResult(null);
  }, [backendUrl]);

  const retryLive = useCallback(async () => {
    try {
      await fetch(`${backendUrl}/api/calibrate/reset/live`, { method: 'POST' });
    } catch (e) { /* Continue anyway */ }
    setLiveStatus('pending');
    setLiveProgress(0);
    setLiveStats(null);
    setTrainResult(null);
  }, [backendUrl]);

  // ─── Train ML Model ───
  const trainModel = useCallback(async () => {
    setTraining(true);
    setTrainResult(null);

    try {
      const response = await fetch(`${backendUrl}/api/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (data.status === 'trained') {
        setTrainResult(data);
        setTimeout(() => {
          Alert.alert(
            'Model Trained Successfully',
            `Accuracy: ${(data.cv_accuracy * 100).toFixed(1)}%\n` +
            `Dataset: ${data.samples_total} samples\n\n` +
            'Tap OK to enter Scanner Mode.',
            [{ text: 'OK', onPress: onComplete }]
          );
        }, 500);
      } else {
        Alert.alert('Training Error', data.detail || 'Unknown error');
      }
    } catch (error) {
      Alert.alert('Training Error', error.message);
    } finally {
      setTraining(false);
    }
  }, [backendUrl, onComplete]);

  const canTrain = idleStatus === 'complete' && liveStatus === 'complete';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Wizard Header */}
      <View style={styles.wizardHeader}>
        <Text style={styles.wizardTitle}>CALIBRATION WIZARD</Text>
        <Text style={styles.wizardSubtitle}>
          Two-step adaptive calibration to learn your environment's electromagnetic boundaries.
        </Text>

        {/* Progress indicators */}
        <View style={styles.progressRow}>
          <View style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              { backgroundColor: idleStatus === 'complete' ? '#10B981' : idleStatus === 'recording' ? '#3B82F6' : '#1E2229' }
            ]} />
            <Text style={styles.progressLabel}>IDLE</Text>
          </View>
          <View style={[styles.progressLine, { backgroundColor: idleStatus === 'complete' ? '#10B981' : '#1E2229' }]} />
          <View style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              { backgroundColor: liveStatus === 'complete' ? '#10B981' : liveStatus === 'recording' ? '#3B82F6' : '#1E2229' }
            ]} />
            <Text style={styles.progressLabel}>LIVE</Text>
          </View>
          <View style={[styles.progressLine, { backgroundColor: liveStatus === 'complete' ? '#10B981' : '#1E2229' }]} />
          <View style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              { backgroundColor: trainResult ? '#10B981' : '#1E2229' }
            ]} />
            <Text style={styles.progressLabel}>TRAIN</Text>
          </View>
        </View>
      </View>

      {/* Step 1: IDLE Baseline */}
      <CalibrationCard
        step={1}
        title="IDLE Baseline — Ambient Air"
        description="Establishes the electromagnetic noise floor of your environment. The wand must be in open air, away from any wires or conduits."
        instruction="Hold the wand still in free air, at least 1 meter away from any electrical wiring or appliances."
        status={idleStatus}
        progress={Math.min(Math.round(idleProgress), 100)}
        stats={idleStats}
        onStart={startIdleCalibration}
        onRetry={retryIdle}
        accentColor="#3B82F6"
      />

      {/* Step 2: LIVE Wire Reference */}
      <CalibrationCard
        step={2}
        title="LIVE Wire Reference — 230V Standard"
        description="Establishes the healthy operational envelope. The wand must be pressed against a known powered 230V wire to capture the full signal strength."
        instruction="Place the wand flat against a known powered 230V wire or conduit. Hold steady during the entire recording."
        status={liveStatus}
        progress={Math.min(Math.round(liveProgress), 100)}
        stats={liveStats}
        onStart={startLiveCalibration}
        onRetry={retryLive}
        disabled={idleStatus !== 'complete'}
        accentColor="#10B981"
      />

      {/* Train Model Button */}
      <View style={styles.trainSection}>
        {trainResult && (
          <View style={styles.trainResults}>
            <Text style={styles.trainResultTitle}>MODEL METRICS</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>
                  {(trainResult.cv_accuracy * 100).toFixed(1)}%
                </Text>
                <Text style={styles.metricLabel}>ACCURACY</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{trainResult.samples_total}</Text>
                <Text style={styles.metricLabel}>SAMPLES</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{trainResult.classes?.length || 3}</Text>
                <Text style={styles.metricLabel}>CLASSES</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.trainBtn,
            !canTrain && styles.trainBtnDisabled,
          ]}
          onPress={trainModel}
          disabled={!canTrain || training}
        >
          {training ? (
            <View style={styles.trainingRow}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.trainBtnText}>  TRAINING MODEL...</Text>
            </View>
          ) : (
            <Text style={styles.trainBtnText}>
              {trainResult ? '✓ ENTER SCANNER MODE' : '⚡ TRAIN ML MODEL'}
            </Text>
          )}
        </TouchableOpacity>

        {!canTrain && (
          <Text style={styles.trainHint}>
            Complete both calibration steps to enable model training
          </Text>
        )}
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
    paddingBottom: 40,
  },
  wizardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2229',
  },
  wizardTitle: {
    color: '#E2E8F0',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  wizardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 4,
  },
  progressStep: {
    alignItems: 'center',
    gap: 4,
  },
  progressDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#1E2229',
  },
  progressLine: {
    height: 2,
    width: 40,
  },
  progressLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  trainSection: {
    padding: 16,
    marginTop: 8,
  },
  trainResults: {
    backgroundColor: '#111317',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    padding: 14,
    marginBottom: 16,
  },
  trainResultTitle: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#0D0F12',
    borderRadius: 8,
    padding: 10,
  },
  metricValue: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  trainBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  trainBtnDisabled: {
    backgroundColor: '#1E2229',
    opacity: 0.5,
  },
  trainBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  trainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trainHint: {
    color: '#475569',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
