require('dotenv').config();
const axios = require('axios');
const { TOTP } = require('totp-generator');

const ANGEL_BASE = 'https://apiconnect.angelone.in';
const {
  ANGEL_API_KEY,
  ANGEL_CLIENT_CODE,
  ANGEL_PASSWORD,
  ANGEL_TOTP_SECRET,
} = process.env;

const commonHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': '103.151.184.226',
    'X-MACAddress': '02:00:00:00:00:00',
    'X-PrivateKey': ANGEL_API_KEY,
};

async function testHistorical() {
  try {
    const { otp } = await TOTP.generate(ANGEL_TOTP_SECRET);
    
    // 1. Login
    const loginRes = await axios.post(
      `${ANGEL_BASE}/rest/auth/angelbroking/user/v1/loginByPassword`,
      { clientcode: ANGEL_CLIENT_CODE, password: ANGEL_PASSWORD, totp: otp },
      { headers: commonHeaders }
    );

    const jwtToken = loginRes.data.data.jwtToken;
    console.log('Login successful');

    // 2. Get Historical
    const res = await axios.post(
      `${ANGEL_BASE}/rest/secure/angelbroking/historical/v1/getCandleData`,
      {
        exchange: 'NSE',
        symboltoken: '3045',
        interval: 'ONE_DAY',
        fromdate: '2025-01-01 09:15',
        todate: '2025-01-10 15:30',
      },
      {
        headers: {
          ...commonHeaders,
          Authorization: `Bearer ${jwtToken}`,
        },
      }
    );

    console.log('Historical Result:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
        console.log('Response content:', err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}

testHistorical();
