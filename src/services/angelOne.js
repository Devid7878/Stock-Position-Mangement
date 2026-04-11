// Angel One SmartAPI Service
// All calls go through your backend proxy to keep credentials secure

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

class AngelOneService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
    this.wsConnection = null;
    this.wsSubscriptions = new Map(); // symbol -> callback[]
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Get auth token from backend proxy
  async getAuthToken() {
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.token;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/angel/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Angel One login failed');
      const data = await res.json();
      this.token = data.jwtToken;
      // Token valid for 24h, refresh after 23h
      this.tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
      return this.token;
    } catch (err) {
      console.error('Angel One auth error:', err);
      throw err;
    }
  }

  // Search for stock symbol token (needed for websocket)
  async searchSymbol(query, exchange = 'NSE') {
    try {
      const token = await this.getAuthToken();
      const res = await fetch(`${BACKEND_URL}/api/angel/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, exchange }),
      });
      if (!res.ok) throw new Error('Symbol search failed');
      return await res.json();
    } catch (err) {
      console.error('Symbol search error:', err);
      throw err;
    }
  }

  // Get LTP (Last Traded Price) for a symbol
  async getLTP(exchange, symbolToken, tradingSymbol) {
    try {
      const token = await this.getAuthToken();
      const res = await fetch(`${BACKEND_URL}/api/angel/ltp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ exchange, symbolToken, tradingSymbol }),
      });
      if (!res.ok) throw new Error('LTP fetch failed');
      const data = await res.json();
      return data.ltp;
    } catch (err) {
      console.error('LTP fetch error:', err);
      throw err;
    }
  }

  // Get OHLC historical candle data
  async getCandleData({ exchange, symbolToken, interval, fromDate, toDate }) {
    try {
      const token = await this.getAuthToken();
      const res = await fetch(`${BACKEND_URL}/api/angel/candles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ exchange, symbolToken, interval, fromDate, toDate }),
      });
      if (!res.ok) throw new Error('Candle data fetch failed');
      const data = await res.json();
      // Returns array of [timestamp, open, high, low, close, volume]
      return data.candles || [];
    } catch (err) {
      console.error('Candle data error:', err);
      throw err;
    }
  }

  // Get full quote with 52w high/low, etc.
  async getFullQuote(exchange, symbolToken, tradingSymbol) {
    try {
      const token = await this.getAuthToken();
      const res = await fetch(`${BACKEND_URL}/api/angel/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ exchange, symbolToken, tradingSymbol }),
      });
      if (!res.ok) throw new Error('Quote fetch failed');
      return await res.json();
    } catch (err) {
      console.error('Quote fetch error:', err);
      throw err;
    }
  }

  // Connect to WebSocket for live price streaming
  connectWebSocket(feedToken, subscriptions, onTick) {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this._subscribeWS(subscriptions, onTick);
      return;
    }

    const wsUrl = `wss://smartapisocket.angelone.in/smart-stream`;

    try {
      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        console.log('Angel One WebSocket connected');
        this.reconnectAttempts = 0;

        // Send auth message
        const authMsg = {
          correlationID: 'position_manager',
          action: 1,
          params: {
            loginType: 2,
            jwtToken: this.token,
            apiKey: process.env.REACT_APP_ANGEL_API_KEY,
            clientCode: process.env.REACT_APP_ANGEL_CLIENT_CODE,
            feedToken: feedToken,
          },
        };
        this.wsConnection.send(JSON.stringify(authMsg));
        this._subscribeWS(subscriptions, onTick);
      };

      this.wsConnection.onmessage = (event) => {
        try {
          if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
            // Binary data - parse tick
            this._parseBinaryTick(event.data, onTick);
          } else {
            const msg = JSON.parse(event.data);
            if (msg.type === 'error') {
              console.error('WS Error:', msg);
            }
          }
        } catch (err) {
          console.error('WS message parse error:', err);
        }
      };

      this.wsConnection.onerror = (err) => {
        console.error('Angel One WebSocket error:', err);
      };

      this.wsConnection.onclose = () => {
        console.log('Angel One WebSocket closed');
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => {
            this.connectWebSocket(feedToken, subscriptions, onTick);
          }, 2000 * this.reconnectAttempts);
        }
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  }

  _subscribeWS(subscriptions, onTick) {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) return;

    const subMsg = {
      correlationID: 'position_manager_sub',
      action: 1,
      params: {
        mode: 2, // QUOTE mode - LTP + volume
        tokenList: subscriptions.map((s) => ({
          exchangeType: s.exchange === 'NSE' ? 1 : 3,
          tokens: [s.symbolToken],
        })),
      },
    };
    this.wsConnection.send(JSON.stringify(subMsg));
  }

  _parseBinaryTick(data, onTick) {
    // Angel One binary format parsing
    // See: https://smartapi.angelone.in/docs#tag/WebSocket
    try {
      const buffer = data instanceof Blob ? data.arrayBuffer() : Promise.resolve(data);
      buffer.then((ab) => {
        const view = new DataView(ab);
        view.getUint8(0); // subscriptionMode
        view.getUint8(1); // exchangeType
        const tokenBytes = new Uint8Array(ab, 2, 25);
        const token = String.fromCharCode(...tokenBytes).replace(/\0/g, '').trim();
        view.getBigUint64(27, false); // seqNo
        const exchangeTimestamp = view.getBigUint64(35, false);
        const ltp = view.getInt32(43, false) / 100;

        onTick({ token, ltp, exchangeTimestamp: Number(exchangeTimestamp) });
      });
    } catch (err) {
      console.error('Binary tick parse error:', err);
    }
  }

  disconnectWebSocket() {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  // Batch LTP for multiple symbols (REST polling fallback)
  async batchLTP(symbols) {
    try {
      const token = await this.getAuthToken();
      const res = await fetch(`${BACKEND_URL}/api/angel/batch-ltp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ symbols }),
      });
      if (!res.ok) throw new Error('Batch LTP failed');
      return await res.json();
    } catch (err) {
      console.error('Batch LTP error:', err);
      throw err;
    }
  }
}

export const angelOneService = new AngelOneService();
export default angelOneService;
