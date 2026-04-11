const { TOTP } = require('totp-generator');
const secret = 'JHUW4ZNZPMF34XXRBXI6PGQ5WQ';
async function test() {
    try {
        const result = await TOTP.generate(secret);
        console.log('Result type:', typeof result);
        console.log('Result:', result);
    } catch (e) {
        console.log('Error:', e.message);
    }
}
test();
