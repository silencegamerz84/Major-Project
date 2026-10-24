/**
 * WaveformCanvas Component
 * ========================
 * Real-time animated Canvas waveform graph with smooth line rendering,
 * gradient fills, grid overlays, and auto-scaling Y-axis.
 */

import React, { useRef, useEffect, useCallback } from 'react';

const COLORS = {
  ncv: '#10B981',
  s1: '#3B82F6',
  s2: '#8B5CF6',
  s3: '#F59E0B',
};

export default function WaveformCanvas({
  data = [],
  channels = ['ncv'],
  title = 'WAVEFORM',
  height = 160,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 16, bottom: 28, left: 52 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = '#0D0F12';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 10);
    ctx.fill();

    // Grid lines
    ctx.strokeStyle = '#1E222940';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * plotH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '1.5px';
    ctx.fillText(title, padding.left, 14);

    // Channel legend (bottom)
    let legendX = padding.left;
    channels.forEach((ch) => {
      const color = COLORS[ch] || '#64748B';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(legendX + 4, h - 10, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 8px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(ch.toUpperCase(), legendX + 12, h - 7);
      legendX += 50;
    });

    if (!data.length) return;

    // Draw each channel
    channels.forEach((channel) => {
      const values = data.map((d) => d[channel] || 0);
      const maxVal = Math.max(...values, 0.001);
      const minVal = Math.min(...values, 0);
      const range = maxVal - minVal || 1;
      const color = COLORS[channel] || '#64748B';

      // Line path
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      const points = [];
      values.forEach((val, i) => {
        const x = padding.left + (i / Math.max(values.length - 1, 1)) * plotW;
        const y = padding.top + plotH - ((val - minVal) / range) * plotH;
        points.push({ x, y });
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Gradient fill
      if (channels.length === 1) {
        const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
        grad.addColorStop(0, color + '30');
        grad.addColorStop(1, color + '05');
        ctx.lineTo(points[points.length - 1].x, padding.top + plotH);
        ctx.lineTo(points[0].x, padding.top + plotH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Latest value indicator dot
      if (points.length > 0) {
        const last = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = color + '40';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Y-axis labels (first channel only)
      if (channel === channels[0]) {
        ctx.fillStyle = '#64748B';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(maxVal.toFixed(3), padding.left - 6, padding.top + 10);
        ctx.fillText(minVal.toFixed(3), padding.left - 6, padding.top + plotH);
        ctx.fillText(((maxVal + minVal) / 2).toFixed(3), padding.left - 6, padding.top + plotH / 2 + 3);
      }
    });
  }, [data, channels, title]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div style={{
      background: '#0D0F12',
      borderRadius: '10px',
      border: '1px solid #1E2229',
      overflow: 'hidden',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: `${height}px`,
          display: 'block',
        }}
      />
    </div>
  );
}
