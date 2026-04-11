import { useState, useEffect, useCallback } from 'react';
import angelOneService from '../services/angelOne';
import { getDateRange } from '../utils/calculations';

const INTERVAL_MAP = {
  '1D': { angelInterval: 'ONE_DAY', days: 365 },
  '1W': { angelInterval: 'ONE_WEEK', days: 730 },
  '1M': { angelInterval: 'ONE_MONTH', days: 1825 },
};

export function useCandleData(position, chartInterval = '1D') {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCandles = useCallback(async () => {
    if (!position?.symbol_token || !position?.exchange) return;

    setLoading(true);
    setError(null);

    try {
      const { angelInterval, days } = INTERVAL_MAP[chartInterval] || INTERVAL_MAP['1D'];
      const { fromDate, toDate } = getDateRange(days);

      const rawCandles = await angelOneService.getCandleData({
        exchange: position.exchange,
        symbolToken: position.symbol_token,
        interval: angelInterval,
        fromDate,
        toDate,
      });

      // Transform [timestamp, open, high, low, close, volume] → chart format
      const formatted = rawCandles.map((c) => ({
        time: Math.floor(new Date(c[0]).getTime() / 1000),
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5],
      }));

      // Sort ascending by time
      formatted.sort((a, b) => a.time - b.time);
      setCandles(formatted);
    } catch (err) {
      setError(err.message);
      console.error('Candle fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [position?.symbol_token, position?.exchange, chartInterval]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  return { candles, loading, error, refetch: fetchCandles };
}

export function useLiveCandle(position, candles, livePrice) {
  const [liveCandles, setLiveCandles] = useState([]);

  useEffect(() => {
    if (!candles.length || !livePrice) {
      setLiveCandles(candles);
      return;
    }

    // Update or append today's candle with live price
    const updated = [...candles];
    const lastCandle = updated[updated.length - 1];

    if (lastCandle) {
      const today = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);

      if (lastCandle.time >= today) {
        // Update existing today's candle
        updated[updated.length - 1] = {
          ...lastCandle,
          close: livePrice,
          high: Math.max(lastCandle.high, livePrice),
          low: Math.min(lastCandle.low, livePrice),
        };
      } else {
        // Append a new candle for today
        updated.push({
          time: today,
          open: livePrice,
          high: livePrice,
          low: livePrice,
          close: livePrice,
          volume: 0,
        });
      }
    }

    setLiveCandles(updated);
  }, [candles, livePrice]);

  return liveCandles;
}
