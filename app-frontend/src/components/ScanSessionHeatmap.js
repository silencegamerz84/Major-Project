/**
 * ScanSessionHeatmap Component (React Native / Mobile App)
 * ========================================================
 * Horizontal timeline ribbon recording ML inference states every 100ms.
 * Color codes:
 *   - Green: LIVE (Healthy energized wire)
 *   - Red:   DAMAGED (Wire break detected)
 *   - Gray:  IDLE (Ambient open air)
 *
 * Includes second-markers (-20s, -15s, -10s, -5s, 0s NOW) along the timeline axis
 * allowing the user to correlate a red 'DAMAGED' segment to their physical scan position.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const STATE_COLORS = {
  LIVE: '#10B981',       // Green
  DAMAGED: '#EF4444',    // Red
  IDLE: '#475569',       // Gray
  DISCONNECTED: '#1E2229',
};

export default function ScanSessionHeatmap({
  history = [],
  maxPoints = 80, // visible segment slots on mobile
  isScanning = true,
  disabled = false,
}) {
  const visibleHistory = history.slice(-maxPoints);
  const padCount = Math.max(0, maxPoints - visibleHistory.length);

  // Time markers (assuming 100ms per point, 80 points = 8 seconds total)
  const markers = [
    { label: '-8s', pos: '0%' },
    { label: '-6s', pos: '25%' },
    { label: '-4s', pos: '50%' },
    { label: '-2s', pos: '75%' },
    { label: 'NOW', pos: '96%' },
  ];

  return (
    <View style={styles.card}>
      {/* Header & Legend */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.titleText}>⏱ SCAN SESSION HEATMAP</Text>
          {isScanning && !disabled && <View style={styles.liveDot} />}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: STATE_COLORS.LIVE }]} />
            <Text style={styles.legendLabel}>LIVE</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: STATE_COLORS.DAMAGED }]} />
            <Text style={styles.legendLabel}>BREAK</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: STATE_COLORS.IDLE }]} />
            <Text style={styles.legendLabel}>IDLE</Text>
          </View>
        </View>
      </View>

      {/* Ribbon Bar */}
      <View style={styles.ribbonContainer}>
        {disabled || history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {disabled ? 'OFFLINE' : 'AWAITING SCAN TELEMETRY...'}
            </Text>
          </View>
        ) : (
          <View style={styles.segmentTrack}>
            {/* Empty slots for early scan */}
            {Array.from({ length: padCount }).map((_, i) => (
              <View key={`pad-${i}`} style={[styles.segment, { backgroundColor: '#16191E' }]} />
            ))}
            {/* Active history segments */}
            {visibleHistory.map((item, i) => {
              const itemState = item.state || 'IDLE';
              const color = STATE_COLORS[itemState] || STATE_COLORS.IDLE;
              const isBreak = itemState === 'DAMAGED';
              return (
                <View
                  key={`seg-${i}`}
                  style={[
                    styles.segment,
                    {
                      backgroundColor: color,
                      borderTopColor: isBreak ? '#FF8787' : 'transparent',
                      borderTopWidth: isBreak ? 2 : 0,
                      borderBottomColor: isBreak ? '#FF8787' : 'transparent',
                      borderBottomWidth: isBreak ? 2 : 0,
                    }
                  ]}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* Timeline Axis Ticks */}
      <View style={styles.ticksContainer}>
        {markers.map((m) => (
          <View key={m.label} style={[styles.tickItem, { left: m.pos }]}>
            <View style={styles.tickLine} />
            <Text style={styles.tickLabel}>{m.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111317',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2229',
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    color: '#E2E8F0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendBox: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  legendLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  ribbonContainer: {
    height: 28,
    backgroundColor: '#0D0F12',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E2229',
    overflow: 'hidden',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#475569',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  segmentTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    height: '100%',
  },
  ticksContainer: {
    height: 16,
    position: 'relative',
    marginTop: 3,
  },
  tickItem: {
    position: 'absolute',
    alignItems: 'center',
    width: 32,
    marginLeft: -16,
  },
  tickLine: {
    width: 1,
    height: 3,
    backgroundColor: '#334155',
  },
  tickLabel: {
    color: '#64748B',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginTop: 1,
  },
});
