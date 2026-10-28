/**
 * TelemetryGrid Component
 * =======================
 * Bento-style grid displaying real-time sensor values (S1, S2, S3),
 * NCV field strength, and 3-axis tilt orientation data.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const STATE_COLORS = {
  IDLE: '#64748B',
  LIVE: '#10B981',
  DAMAGED: '#EF4444',
};

import DigitalBubbleLevel from './DigitalBubbleLevel';

export default function TelemetryGrid({ data = {}, state = 'IDLE' }) {
  const accentColor = STATE_COLORS[state] || '#64748B';

  const sensors = [
    { label: 'S1', sublabel: 'HALL-A0', value: data.s1, unit: 'V', color: '#3B82F6' },
    { label: 'S2', sublabel: 'HALL-A1', value: data.s2, unit: 'V', color: '#8B5CF6' },
    { label: 'S3', sublabel: 'HALL-A2', value: data.s3, unit: 'V', color: '#F59E0B' },
    { label: 'NCV', sublabel: 'E-FIELD', value: data.ncv, unit: 'V', color: '#10B981' },
  ];

  return (
    <View style={styles.container}>
      {/* Sensor Readings */}
      <Text style={styles.sectionTitle}>MAGNETIC TELEMETRY</Text>
      <View style={styles.grid}>
        {sensors.map((sensor) => (
          <View key={sensor.label} style={[styles.card, { borderColor: sensor.color + '40' }]}>
            <Text style={[styles.cardLabel, { color: sensor.color }]}>{sensor.label}</Text>
            <Text style={styles.cardSublabel}>{sensor.sublabel}</Text>
            <Text style={styles.cardValue}>
              {sensor.value !== undefined ? sensor.value.toFixed(4) : '-.----'}
            </Text>
            <Text style={styles.cardUnit}>{sensor.unit}</Text>
          </View>
        ))}
      </View>

      {/* Digital Bubble Level replacing raw numbers */}
      <Text style={styles.sectionTitle}>MPU-6050 SPATIAL ORIENTATION (DIGITAL LEVEL)</Text>
      <View style={styles.levelCard}>
        <DigitalBubbleLevel
          tiltX={data.tiltX}
          tiltY={data.tiltY}
          tiltZ={data.tiltZ}
          size={110}
          disabled={state === 'DISCONNECTED'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    width: '47%',
    backgroundColor: '#111317',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  cardSublabel: {
    fontSize: 8,
    color: '#475569',
    letterSpacing: 1,
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  cardUnit: {
    fontSize: 9,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  levelCard: {
    backgroundColor: '#111317',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2229',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
