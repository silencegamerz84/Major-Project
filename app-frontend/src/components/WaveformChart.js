/**
 * WaveformChart Component
 * =======================
 * Real-time SVG rolling waveform graph for NCV field strength
 * and magnetic sensor voltages (S1, S2, S3).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Polyline, Line, Rect, Text as SvgText } from 'react-native-svg';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 120;
const PADDING = { top: 10, right: 10, bottom: 20, left: 40 };

const CHANNEL_COLORS = {
  ncv: '#10B981',
  s1: '#3B82F6',
  s2: '#8B5CF6',
  s3: '#F59E0B',
};

export default function WaveformChart({ data = [], channels = ['ncv'], title = 'NCV FIELD STRENGTH' }) {
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // Generate SVG polyline points for each channel
  const channelPaths = useMemo(() => {
    if (!data.length) return {};

    const paths = {};
    channels.forEach(channel => {
      const values = data.map(d => d[channel] || 0);
      const maxVal = Math.max(...values, 0.001);
      const minVal = Math.min(...values, 0);
      const range = maxVal - minVal || 1;

      const points = values.map((val, i) => {
        const x = PADDING.left + (i / Math.max(data.length - 1, 1)) * plotWidth;
        const y = PADDING.top + plotHeight - ((val - minVal) / range) * plotHeight;
        return `${x},${y}`;
      }).join(' ');

      paths[channel] = { points, maxVal, minVal };
    });

    return paths;
  }, [data, channels]);

  // Grid lines
  const gridLines = useMemo(() => {
    const lines = [];
    for (let i = 0; i <= 4; i++) {
      const y = PADDING.top + (i / 4) * plotHeight;
      lines.push(y);
    }
    return lines;
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {/* Background */}
        <Rect x={0} y={0} width={CHART_WIDTH} height={CHART_HEIGHT} fill="#0D0F12" rx={8} />

        {/* Grid lines */}
        {gridLines.map((y, i) => (
          <Line
            key={`grid-${i}`}
            x1={PADDING.left}
            y1={y}
            x2={CHART_WIDTH - PADDING.right}
            y2={y}
            stroke="#1E2229"
            strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels */}
        {channels.length > 0 && channelPaths[channels[0]] && (
          <>
            <SvgText
              x={PADDING.left - 4}
              y={PADDING.top + 4}
              fill="#64748B"
              fontSize={8}
              textAnchor="end"
              fontFamily={Platform.OS === 'ios' ? 'Courier New' : 'monospace'}
            >
              {channelPaths[channels[0]].maxVal.toFixed(3)}
            </SvgText>
            <SvgText
              x={PADDING.left - 4}
              y={PADDING.top + plotHeight}
              fill="#64748B"
              fontSize={8}
              textAnchor="end"
              fontFamily={Platform.OS === 'ios' ? 'Courier New' : 'monospace'}
            >
              {channelPaths[channels[0]].minVal.toFixed(3)}
            </SvgText>
          </>
        )}

        {/* Waveform polylines */}
        {channels.map(channel => (
          channelPaths[channel] && (
            <Polyline
              key={channel}
              points={channelPaths[channel].points}
              fill="none"
              stroke={CHANNEL_COLORS[channel] || '#64748B'}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )
        ))}
      </Svg>

      {/* Channel legend */}
      <View style={styles.legend}>
        {channels.map(ch => (
          <View key={ch} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: CHANNEL_COLORS[ch] || '#64748B' }]} />
            <Text style={styles.legendText}>{ch.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111317',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2229',
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 6,
  },
  title: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  legendText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});
