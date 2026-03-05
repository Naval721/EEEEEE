const fs = require('fs');
let code = fs.readFileSync('script0.js', 'utf8');

const mockEnv = `
var DOMAIN_CONFIG = { allowedDomains: ['localhost'] };
var TELEGRAM_CONFIG = { popupChannel: 'x' };
var encodedChannelData = { SF2: 'HER7VlgbBVIUBmE1O0UNGhpCFRdGDEhIVA9BUxpBRUsTBxhWWxMZWAlcUgYBE1tBX1MFAFAYBAhVSV5XUxxdDxMUWRhTHAAYEBRQDUELUFQUUU4IQEJIEQlJVQRTUwtfVl9UAFBGV1ICQQxfQFFTXENQAFdWDlNRXFUYVVJfUEgKFlIVGlAnZSo5UR4BRQ1DUAdRUVYHBAMABAABBFcHUl9QBQQDEQcOXxQAA0EFD1xKFFtFBABQXwpeBg4OAAJfAQAEUlITVA9SF1ZTEVdUDxQFVAQXSxo=' };
class URLSearchParams { constructor() {} get() { return 'SF2'; } }
var window = { location: { search: '' }, parent: { location: {} } };
window.parent.location = window.location;
global.window = window;
global.confirm = () => false;
global.alert = () => {};
`;

fs.writeFileSync('test_run.js', mockEnv + code + '\nconsole.log("DECRYPTED:", selectedData);');
