/**
 * Mag-Cipher Smart Wire Scanner — Mobile App Entry Point
 * ========================================================
 * Root component managing navigation between Calibration Wizard
 * and Live Scanner screens with the obsidian dark HUD theme.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, StatusBar, TouchableOpacity,
  Alert, Platform, Modal, TextInput
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import CalibrationScreen from './src/screens/CalibrationScreen';
import ScannerScreen from './src/screens/ScannerScreen';

// ─── Design System Tokens ────────────────────────────────
const COLORS = {
  base: '#08090A',
  surface: '#111317',
  border: '#1E2229',
  idle: '#64748B',
  live: '#10B981',
  damaged: '#EF4444',
  text: '#E2E8F0',
  textDim: '#94A3B8',
  accent: '#3B82F6',
};

export default function App() {
  const [screen, setScreen] = useState('calibration'); // 'calibration' | 'scanner'
  const [serverHost, setServerHost] = useState('192.168.0.199');
  const [serverPort, setServerPort] = useState('8000');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [inputHost, setInputHost] = useState('192.168.0.199');
  const [inputPort, setInputPort] = useState('8000');
  const [backendUrl, setBackendUrl] = useState('http://192.168.0.199:8000');
  const [wsUrl, setWsUrl] = useState('ws://192.168.0.199:8000/ws/stream');
  const [modelTrained, setModelTrained] = useState(false);

  const saveHostConfig = useCallback(() => {
    const trimmedHost = inputHost.trim();
    const trimmedPort = inputPort.trim() || '8000';
    if (!trimmedHost) {
      Alert.alert('Invalid IP', 'Please enter a valid IP address or hostname.');
      return;
    }
    setServerHost(trimmedHost);
    setServerPort(trimmedPort);
    setBackendUrl(`http://${trimmedHost}:${trimmedPort}`);
    setWsUrl(`ws://${trimmedHost}:${trimmedPort}/ws/stream`);
    setIsConfigOpen(false);
    Alert.alert('Configuration Saved', `Target backend set to ${trimmedHost}:${trimmedPort}`);
  }, [inputHost, inputPort]);

  const [calibrationKey, setCalibrationKey] = useState(0);

  const handleCalibrationComplete = useCallback(() => {
    setModelTrained(true);
    setScreen('scanner');
  }, []);

  const handleRecalibrate = useCallback(async () => {
    try {
      await fetch(`${backendUrl}/api/calibrate/reset/idle`, { method: 'POST' });
      await fetch(`${backendUrl}/api/calibrate/reset/live`, { method: 'POST' });
    } catch (e) {
      console.warn('Backend calibration reset error:', e);
    }
    setModelTrained(false);
    setCalibrationKey((k) => k + 1);
    setScreen('calibration');
  }, [backendUrl]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.base} />

        {/* ─── Header Bar ─── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoOrb} />
            <Text style={styles.headerTitle}>MAG-CIPHER</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.configBtn}
              onPress={() => {
                setInputHost(serverHost);
                setInputPort(serverPort);
                setIsConfigOpen(true);
              }}
            >
              <Text style={styles.configBtnText}>⚙ {serverHost}</Text>
            </TouchableOpacity>
            {screen === 'scanner' && (
              <TouchableOpacity
                style={styles.recalibrateBtn}
                onPress={handleRecalibrate}
              >
                <Text style={styles.recalibrateBtnText}>⟲ RECAL</Text>
              </TouchableOpacity>
            )}
            <View style={[styles.statusDot, { backgroundColor: modelTrained ? COLORS.live : COLORS.idle }]} />
          </View>
        </View>

        {/* ─── IP Configuration Modal ─── */}
        <Modal
          visible={isConfigOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsConfigOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>BACKEND SERVER IP</Text>
              <Text style={styles.modalSubtitle}>Enter your PC's Wi-Fi IP address running FastAPI</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>HOST / IP ADDRESS</Text>
                <TextInput
                  style={styles.textInput}
                  value={inputHost}
                  onChangeText={setInputHost}
                  placeholder="192.168.1.xxx"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PORT</Text>
                <TextInput
                  style={styles.textInput}
                  value={inputPort}
                  onChangeText={setInputPort}
                  placeholder="8000"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsConfigOpen(false)}
                >
                  <Text style={styles.modalCancelText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={saveHostConfig}
                >
                  <Text style={styles.modalSaveText}>APPLY</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── Screen Router ─── */}
        {screen === 'calibration' ? (
          <CalibrationScreen
            key={calibrationKey}
            backendUrl={backendUrl}
            onComplete={handleCalibrationComplete}
            colors={COLORS}
          />
        ) : (
          <ScannerScreen
            wsUrl={wsUrl}
            backendUrl={backendUrl}
            colors={COLORS}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08090A',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111317',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2229',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoOrb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
    marginRight: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  headerTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recalibrateBtn: {
    backgroundColor: '#1E2229',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  recalibrateBtnText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  configBtn: {
    backgroundColor: '#16191F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2A303C',
  },
  configBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '500',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#111317',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2229',
    padding: 20,
  },
  modalTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#08090A',
    borderWidth: 1,
    borderColor: '#1E2229',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#E2E8F0',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E2229',
  },
  modalCancelText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
