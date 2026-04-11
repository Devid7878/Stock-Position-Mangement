import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import { calcEMA, calcSMA } from '../utils/calculations';

export default function CandlestickChart({
  candles = [],
  entryPrice,
  stopLoss,
  originalSL,
  pyramidEntry,
  height = 420,
  showMAs = true,
  compact = false,
  onDragEnd, // Callback(type, newPrice)
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});
  
  // Drag state
  const isDragging = useRef(null); // { type, startPrice }

  useEffect(() => {
    if (!containerRef.current || !candles.length) return;

    // Create chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(148, 163, 184, 0.08)' }, horzLines: { color: 'rgba(148, 163, 184, 0.08)' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.15)', textColor: '#64748b' },
      timeScale: { borderColor: 'rgba(148, 163, 184, 0.15)', timeVisible: !compact },
      handleScroll: !compact,
      handleScale: !compact,
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444', borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    });
    candleSeries.setData(candles);
    seriesRef.current.candles = candleSeries;

    if (!compact) {
      const volSeries = chart.addSeries(HistogramSeries, {
        color: 'rgba(148,163,184,0.15)', priceFormat: { type: 'volume' },
        priceScaleId: 'volume', scaleMargins: { top: 0.8, bottom: 0 },
      });
      volSeries.setData(candles.map(c => ({
        time: c.time, value: c.volume, 
        color: c.close >= c.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
      })));
    }

    // Moving Averages
    if (showMAs && candles.length >= 20) {
      const ema5Data = calcEMA(candles, 5);
      const ema5 = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, priceLineVisible: false });
      ema5.setData(ema5Data);

      const ema10Data = calcEMA(candles, 10);
      const ema10 = chart.addSeries(LineSeries, { color: '#f97316', lineWidth: 1, priceLineVisible: false });
      ema10.setData(ema10Data);

      const sma20Data = calcSMA(candles, 20);
      const sma20 = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, priceLineVisible: false });
      sma20.setData(sma20Data);
    }

    // Static Risk Lines
    if (originalSL && Math.abs(originalSL - stopLoss) > 0.01) {
      candleSeries.createPriceLine({
        price: originalSL, color: '#f97316', lineWidth: 1, lineStyle: 2, 
        axisLabelVisible: true, title: 'INIT SL'
      });
    }

    // Draggable Markers
    const linesCfg = {
      entry: { price: entryPrice, color: '#6366f1', title: 'ENTRY', style: 2 },
      sl: { price: stopLoss, color: '#ef4444', title: 'SL', style: 0 },
      pyramid: { price: pyramidEntry, color: '#14b8a6', title: 'PYRAMID', style: 1 },
    };

    seriesRef.current.lines = {};
    Object.entries(linesCfg).forEach(([key, cfg]) => {
      if (cfg.price) {
        seriesRef.current.lines[key] = candleSeries.createPriceLine({
          price: cfg.price, color: cfg.color, lineWidth: 2, lineStyle: cfg.style,
          axisLabelVisible: true, title: cfg.title,
        });
      }
    });

    // Drag Interaction
    const handleMouseDown = (e) => {
      if (!onDragEnd || compact) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const price = seriesRef.current.candles.coordinateToPrice(y);
      if (price === null) return;
      
      let closest = null;
      let minDiff = Infinity;
      Object.entries(linesCfg).forEach(([type, cfg]) => {
        if (!cfg.price) return;
        const diff = Math.abs(price - cfg.price);
        if (diff < minDiff) { minDiff = diff; closest = type; }
      });

      if (closest && minDiff < (linesCfg[closest].price * 0.02)) {
        isDragging.current = { type: closest };
        containerRef.current.style.cursor = 'ns-resize';
      }
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const price = seriesRef.current.candles.coordinateToPrice(y);
      if (price === null) return;
      
      const { type } = isDragging.current;
      const line = seriesRef.current.lines[type];
      if (line) {
        line.applyOptions({ price: parseFloat(price.toFixed(2)) });
      }
    };

    const handleMouseUp = (e) => {
      if (!isDragging.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const price = seriesRef.current.candles.coordinateToPrice(y);
      
      const { type } = isDragging.current;
      if (onDragEnd && price !== null) onDragEnd(type, parseFloat(price.toFixed(2)));
      
      isDragging.current = null;
      if (containerRef.current) containerRef.current.style.cursor = 'default';
    };

    const container = containerRef.current;
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        try {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        } catch (e) { /* Chart might be disposed */ }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      resizeObserver.disconnect();
      
      // Safety check before removal
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, entryPrice, stopLoss, originalSL, pyramidEntry, height, showMAs, compact, onDragEnd]);

  return (
    <div className="chart-wrapper" style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height }} />
    </div>
  );
}
