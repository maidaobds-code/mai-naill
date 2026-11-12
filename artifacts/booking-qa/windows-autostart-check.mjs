import assert from "node:assert/strict";
import fs from "node:fs";

const main = fs.readFileSync("electron/main.cjs", "utf8");
const setup = fs.readFileSync("electron/setup.js", "utf8");
const html = fs.readFileSync("electron/setup.html", "utf8");

assert.match(main, /autoStartBot:\s*true/);
assert.match(main, /setLoginItemSettings\(\{ openAtLogin: Boolean\(config\.autoStartBot\)/);
assert.match(main, /applyStartupSettings\(config\);[\s\S]*if \(config\.autoStartBot\)/);
assert.match(main, /startWorker\("salonboard"\)/);
assert.match(main, /startWorker\("nailie"\)/);
assert.match(main, /Object\.hasOwn\(stored, "autoStartBot"\) \? Boolean\(stored\.autoStartBot\) : true/);
assert.match(setup, /"autoStartBot"/);
assert.doesNotMatch(setup, /"startWorkersOnLaunch"|"startWithWindows"/);
assert.match(html, /id="autoStartBot"/);
assert.match(html, /khởi động lại Windows/);

console.log("PASS new and upgraded installations enable Windows auto-start by default");
console.log("PASS Windows startup launches both browser workers");
console.log("PASS one Bot Manager option controls app and worker startup together");
