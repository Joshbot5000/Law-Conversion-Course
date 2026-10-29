// Card and source counts of the made-up sample library, for the tests' expectations.
const fs = require('fs'), path = require('path'), vm = require('vm');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'sample_seed.js'), 'utf8'), sandbox);
module.exports = { N: sandbox.window.__SEED_COUNT, SRC: sandbox.window.__SEED_SOURCES };
