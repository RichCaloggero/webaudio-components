import {setValue} from "./binder.js";
import {audioContext} from "./audioComponent.js";

await audioContext.audioWorklet.addModule("./automator.worklet.js");
console.log("audioWorklet.automator created.");
const automator = new AudioWorkletNode(audioContext, "automator");

window.automationData = Object.create(Math);
const automationQueue = new Map();
window.automationQueue = automationQueue;
let _automationEnabled = false;
let _automationInterval = 0.1;

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
if (_function) {
automationQueue.set(element, ({
element: element,
text: text,
automator: _function
}));
} // if
} // addAutomation


export function getAutomation (element) {return automationQueue.get(element);}


export function removeAutomation (element) {automationQueue.delete(element);}


function _tick () {
automationQueue.forEach(e => setValue(e.element, e.automator(audioContext.currentTime), "change"));
} // _tick


export function compileFunction (text, parameter = "t") {
let _function = null;

try {
_function = new Function (parameter,
`with (automationData) {
function  scale (x, _in1,_in2, _out1,_out2) {
const in1 = Math.min(_in1, _in2);
const in2 = Math.max(_in1, _in2);
const out1 = Math.min(_out1, _out2);
const out2 = Math.max(_out1, _out2);
const f = Math.abs(out1-out2) / Math.abs(in1-in2);

return f * Math.abs(x-in1) + out1;
} // scale

function s (x, l=-1.0, u=1.0) {return scale(Math.sin(x), -1,1, l,u);}
function c (x, l=-1.0, u=1.0) {return scale(Math.cos(x), -1,1, l,u);}
function r(a=0, b=1) {return scale(Math.random(), 0,1, a,b);}

return (${text});
} // with automationData
`); // new Function
_function(0); // test
return _function;

} catch (e) {
console.error(`invalid function : ${text};
${e}
`);
return null;
} // try

return _function;
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

