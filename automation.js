import {setValue} from "./binder.js";
import {audioContext} from "./audioComponent.js";

await audioContext.audioWorklet.addModule("./automator.worklet.js");
console.log("audioWorklet.automator created.");
const automator = new AudioWorkletNode(audioContext, "automator");

window.automationData = Object.create(Math);
const automationQueue = new Map();
window.automationQueue = automationQueue;
let _automationEnabled = false;
let _automationInterval = 0.1; // seconds

automator.port.onmessage = e => {
if (_automationEnabled) {
const message = e.data;

if (message instanceof Array) {
// envelope following code here -- make quantities available as variables which can be used by automation functions
Object.assign(window.automationData, Object.fromEntries(message));
} else if (message === "tick") {
_tick();
} // if
} // if _automationEnabled
}; // onmessage

export function addAutomation (element, text, _function) {
if (_function) automationQueue.set(element, {
element, text,
automator: _function
});
} // addAutomation

export function removeAutomation (element) {automationQueue.delete(element);} 


function _tick () {
automationQueue.forEach(e => setValue(e.element, e.automator(audioContext.currentTime), "change"));
} // _tick


export function compileFunction (text, parameter = "t") {
let _function;
try {
_function = new Function (parameter,
`with (automationData) {
function  scale (x, in1,in2, out1,out2) {
in1 = Math.min(in1,in2);
in2 = Math.max(in1,in2);
out1 = Math.min(out1,out2);
out2 = Math.max(out1,out2);
const f = Math.abs(out1-out2) / Math.abs(in1-in2);

return f* Math.abs(x-in1) + out1;
} // scale

function s (x, l=-1.0, u=1.0) {return scale(Math.sin(x), -1,1, l,u);}
function c (x, l=-1.0, u=1.0) {return scale(Math.cos(x), -1,1, l,u);}
function r(a=0, b=1) {return scale(Math.random(), 0,1, a,b);}

return ${text};
} // with automationData
`); // new Function
_function(0); // test
return _function;

} catch (e) {
console.error(`invalid function : ${text};
${e})
`);
return null;
} // try
} // compileFunction

export function isAutomationEnabled (value) {return _automationEnabled;}

export function enableAutomation () {
automator.port.postMessage(["enable", true]);
_automationEnabled = true;
} // enableAutomation

export function disableAutomation () {
automator.port.postMessage(["enable", false]);
_automationEnabled = false;
} // disableAutomation

export function getAutomationInterval () {return _automationInterval;}

export function setAutomationInterval (value) {
value = Number(value);
if (value && value > 0) {
automator.port.postMessage(["automationInterval", value]);
_automationInterval = value;
} // if
} // setAutomationInterval

