// node scan/tojson.js seed.js > seed.json — turn a seed.js (a JS object literal) into the JSON the page can load.
// It runs the file, so only point it at a seed you wrote. The page itself never runs a file you load: it reads JSON.
const fs = require('fs'), vm = require('vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), sandbox, { timeout: 2000 });
process.stdout.write(JSON.stringify(sandbox.window.TRACKER_SEED));
