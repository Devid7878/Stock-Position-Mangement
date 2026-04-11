require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { TOTP } = require('totp-generator');

const app = express();
app.use(express.json());

app.use(cors({
  origin: function (origin, callback) {
    // Dynamically allow ANY origin for all requests
    callback(null, true);
  },
  credentials: true,
}));


const ANGEL_BASE = 'https://apiconnect.angelone.in';
const {
  ANGEL_API_KEY,
  ANGEL_CLIENT_CODE,
  ANGEL_PASSWORD,
  ANGEL_TOTP_SECRET,
} = process.env;

// ── Token Cache ────────────────────────────────────────────────────────────
let cachedToken = null;
let cachedFeedToken = null;
let tokenExpiry = 0;

async function getAngelToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return { jwtToken: cachedToken, feedToken: cachedFeedToken };
  }

  // Generate TOTP
  const { otp } = await TOTP.generate(ANGEL_TOTP_SECRET);

  const res = await axios.post(
    `${ANGEL_BASE}/rest/auth/angelbroking/user/v1/loginByPassword`,
    {
      clientcode: ANGEL_CLIENT_CODE,
      password: ANGEL_PASSWORD,
      totp: otp,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': '103.151.184.226',
        'X-MACAddress': '02:00:00:00:00:00',
        'X-PrivateKey': ANGEL_API_KEY,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    }
  );

  const data = res.data?.data;
  if (!data?.jwtToken) throw new Error('Angel One login failed: ' + JSON.stringify(res.data));

  cachedToken = data.jwtToken;
  cachedFeedToken = data.feedToken;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;

  return { jwtToken: cachedToken, feedToken: cachedFeedToken };
}

function angelHeaders(jwtToken) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${jwtToken}`,
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': '103.151.184.226',
    'X-MACAddress': '02:00:00:00:00:00',
    'X-PrivateKey': ANGEL_API_KEY,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  };
}

// ── POST /api/angel/login ──────────────────────────────────────────────────
app.post('/api/angel/login', async (req, res) => {
  try {
    const tokens = await getAngelToken();
    res.json(tokens);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/angel/search ─────────────────────────────────────────────────
app.post('/api/angel/search', async (req, res) => {
  try {
    const { query, exchange } = req.body;
    const { jwtToken } = await getAngelToken();

    const response = await axios.post(
      `${ANGEL_BASE}/rest/secure/angelbroking/order/v1/searchScrip`,
      { exchange: exchange || 'NSE', searchscrip: query },
      { headers: angelHeaders(jwtToken) }
    );

    res.json(response.data);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/angel/ltp ────────────────────────────────────────────────────
app.post('/api/angel/ltp', async (req, res) => {
  try {
    const { exchange, symbolToken } = req.body;
    const { jwtToken } = await getAngelToken();

    const response = await axios.post(
      `${ANGEL_BASE}/rest/secure/angelbroking/market/v1/quote/`,
      {
        mode: 'LTP',
        exchangeTokens: {
          [exchange]: [symbolToken],
        },
      },
      { headers: angelHeaders(jwtToken) }
    );

    const ltp = response.data?.data?.fetched?.[0]?.ltp;
    res.json({ ltp: parseFloat(ltp) || 0 });
  } catch (err) {
    console.error('LTP error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/angel/batch-ltp ──────────────────────────────────────────────
app.post('/api/angel/batch-ltp', async (req, res) => {
  try {
    const { symbols } = req.body; // [{exchange, symbolToken}]
    const { jwtToken } = await getAngelToken();

    // Group symbols by exchange
    const exchangeGroups = {};
    symbols.forEach((s) => {
      if (!exchangeGroups[s.exchange]) exchangeGroups[s.exchange] = [];
      exchangeGroups[s.exchange].push(s.symbolToken);
    });

    const response = await axios.post(
      `${ANGEL_BASE}/rest/secure/angelbroking/market/v1/quote/`,
      {
        mode: 'LTP',
        exchangeTokens: exchangeGroups,
      },
      { headers: angelHeaders(jwtToken) }
    );

    const prices = {};
    const fetched = response.data?.data?.fetched || [];
    fetched.forEach((item) => {
      prices[item.symbolToken] = parseFloat(item.ltp) || 0;
    });

    res.json(prices);
  } catch (err) {
    console.error('Batch LTP error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/angel/candles ────────────────────────────────────────────────
app.post('/api/angel/candles', async (req, res) => {
  try {
    const { exchange, symbolToken, interval, fromDate, toDate } = req.body;
    const { jwtToken } = await getAngelToken();

    const response = await axios.post(
      `${ANGEL_BASE}/rest/secure/angelbroking/historical/v1/getCandleData`,
      {
        exchange: exchange || 'NSE',
        symboltoken: symbolToken,
        interval: interval || 'ONE_DAY',
        fromdate: fromDate,
        todate: toDate,
      },
      { headers: angelHeaders(jwtToken) }
    );

    res.json({ candles: response.data?.data || [] });
  } catch (err) {
    console.error('Candle error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/angel/batch-ltp ──────────────────────────────────────────────
app.post('/api/angel/batch-ltp', async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!symbols || !symbols.length) return res.json({});

    const { jwtToken } = await getAngelToken();

    // Group symbols by exchange for Angel's API
    const exchangeTokens = {};
    symbols.forEach((s) => {
      const exch = s.exchange || 'NSE';
      if (!exchangeTokens[exch]) exchangeTokens[exch] = [];
      exchangeTokens[exch].push(s.symbolToken);
    });

    const response = await axios.post(
      `${ANGEL_BASE}/rest/secure/angelbroking/market/v1/quote/`,
      { mode: 'FULL', exchangeTokens },
      { headers: angelHeaders(jwtToken) }
    );

    const fetched = response.data?.data?.fetched || [];
    const results = {};
    fetched.forEach((item) => {
      results[item.symbolToken] = parseFloat(item.ltp);
    });

    res.json(results);
  } catch (err) {
    console.error('Batch LTP error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/angel/quote ──────────────────────────────────────────────────
app.post('/api/angel/quote', async (req, res) => {
  try {
    const { exchange, symbolToken, tradingSymbol } = req.body;
    const { jwtToken } = await getAngelToken();

    const response = await axios.post(
      `${ANGEL_BASE}/rest/secure/angelbroking/market/v1/quote/`,
      {
        mode: 'FULL',
        exchangeTokens: {
          [exchange]: [symbolToken],
        },
      },
      { headers: angelHeaders(jwtToken) }
    );

    const quoteData = response.data?.data?.fetched?.[0] || {};
    res.json(quoteData);
  } catch (err) {
    console.error('Quote error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/angel/feed-token ──────────────────────────────────────────────
app.get('/api/angel/feed-token', async (req, res) => {
  try {
    const { feedToken } = await getAngelToken();
    res.json({ feedToken, apiKey: ANGEL_API_KEY, clientCode: ANGEL_CLIENT_CODE });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/angel/benchmarks ──────────────────────────────────────────────
app.get('/api/angel/benchmarks', async (req, res) => {
  try {
    const { jwtToken } = await getAngelToken();

    // Nifty 50 = 99926000, Nifty 500 = 99926032, Nifty Smallcap 100 = 99926074
    const indices = { 'NSE': ['99926000', '99926032', '99926074'] };
    const response = await axios.post(
      `${ANGEL_BASE}/rest/secure/angelbroking/market/v1/quote/`,
      { mode: 'FULL', exchangeTokens: indices },
      { headers: angelHeaders(jwtToken) }
    );

    const fetched = response.data?.data?.fetched || [];
    const nameMap = {
      '99926000': 'Nifty 50',
      '99926032': 'Nifty 500',
      '99926074': 'Smlcap 100',
    };
    const benchmarks = fetched.map((item) => {
      const prevClose = parseFloat(item.close) || 0;
      const ltp = parseFloat(item.ltp) || 0;
      const change = prevClose > 0 ? ((ltp - prevClose) / prevClose) * 100 : 0;
      return {
        name: nameMap[item.symbolToken] || item.tradingSymbol || item.symbolToken,
        ltp,
        change: parseFloat(change.toFixed(2)),
      };
    });

    res.json(benchmarks);
  } catch (err) {
    console.error('Benchmarks error:', err.message);
    res.json([]); // Return empty array on failure, not 500
  }
});

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Angel One proxy running on port ${PORT}`));
