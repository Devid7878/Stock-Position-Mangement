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

async function testLogin() {
  try {
    const { otp } = await TOTP.generate(ANGEL_TOTP_SECRET);
    console.log('Generated OTP:', otp);

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
          'X-ClientPublicIP': '106.193.147.100', // Changed slightly
          'X-MACAddress': 'fe80::216e:6507:4b90:3719',
          'X-PrivateKey': ANGEL_API_KEY,
        },
      }
    );

    console.log('Login Result:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('Login Failed with response:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Login error:', err.message);
    }
  }
}

testLogin();
