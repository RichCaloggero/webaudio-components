import {union, intersection, difference} from "./setops.js";
import {Control, update, setValue} from "./binder.js";
import {audioContext, AudioComponent, wrapWebaudioNode, createFields, Delay, Destination, Xtc, ReverseStereo, Player, Series, Parallel} from "./audioComponent.js";
import {eventToKey} from "./key.js";
import {parseFieldDescriptor} from "./parser.js";

/// root (top level UI)

export function app (options, component) {
if (arguments.length === 1) {
component = arguments[0];
options = "";
} else if (arguments.length !== 2) {
alert ("app: must have either 1 or 2 arguments");
return;
} // if

const app = {
children: [component],
enableAutomation: false,
automationRate: 0.1,
automationType: "ui"
}; // app
const ui = new Control(app, "App");
ui.container.insertAdjacentHTML("afterBegin", '<div role="status" aria-atomic="true" aria-label="status" class="status"></div>\n');
ui.container.classList.add("root");

createFields(
app, ui,
["enableAutomation", "automationRate", "automationType"]
); // createFields

app.ui = ui;
setDepth(ui.container, 1);
buildDom(component, ui.container);

ui.container.addEventListener ("keydown", numericFieldKeyboardHandler);
ui.container.querySelectorAll("input, button").forEach(x => update(x));
setTimeout(() => statusMessage("Ready."), 10); // give time for dom to settle

ui.component = app;
return ui.container;
} // app


/// wrapped webaudio nodes

export function player (options) {
const component = new Player(audioContext);

const ui = new Control(component, "player");
createFields(
component, ui,
["media", "play", "position"]
); // createFields

const position = ui.container.querySelector("[data-name=position]");
component._media.addEventListener("timeupdate", e => {
if (!component._media.seeking) position.value = Number(e.target.currentTime.toFixed(1))
});
position.step = 0.1;


component.ui = ui;
return applyFieldInitializer(options, component);
} // player

export function destination () {
const component = new Destination(audioContext);
const ui = new Control(component, "destination");
component.ui = ui;
return component;
} // destination

export function gain (options) {
return applyFieldInitializer(options, wrapWebaudioNode(audioContext.createGain()));
} // gain

export function reverseStereo (options) {
const component = new ReverseStereo (audioContext);
const ui = new Control(component, "reverseStereo");

createFields(
component, ui,
AudioComponent.sharedParameterNames
); // createFields

component.ui = ui;
return applyFieldInitializer(options, component);
} // reverseStereo

export function filter (options) {
return applyFieldInitializer(options, wrapWebaudioNode(audioContext.createBiquadFilter()));
} // filter

export function panner (options) {
const component = applyFieldInitializer(options, wrapWebaudioNode(audioContext.createPanner()));
Object.defineProperty(component, "channelCount", {
get() {return component.webaudioNode.channelCount;},
set(value) {component.webaudioNode.channelCount = value;}
});

createFields(component, component.ui, ["channelCount"]);
return component;
} // panner

export function delay(options) {
const component = new Delay(audioContext);
const ui = new Control(component, "delay");
createFields(
component, ui,
[...AudioComponent.sharedParameterNames, "delay", "feedBack"]
); // createFields

component.ui = ui;
return applyFieldInitializer(options, component);
} // delay

export function xtc (options = `
bypass; mix=.3; gain=-1.3; delay=0.00009; feedback=0.9; reverseStereo=1;
lowType=peaking; lowFrequency=500; lowGain=-30; lowQ=0.266;
midType=bandpass; midFrequency=950; midGain=-4; midQ=0.66;
highType=peaking; highFrequency=8000; highGain=-30; highQ=0.266;
`) {
const component = new Xtc(audioContext);
const ui = new Control(component, "xtc");

createFields(
component, ui,
[...AudioComponent.sharedParameterNames,
"delay", "feedback", "gain", "reverseStereo",
"lowType", "lowFrequency", "lowGain", "lowQ",
"midType", "midFrequency", "midGain", "midQ",
"highType", "highFrequency", "highGain", "highQ"
]); // createFields

component.ui = ui;
return applyFieldInitializer(options, component);
} // xtc

/// containers

export function series (...children) {
const options = children[0] instanceof AudioComponent?
"" : children.shift();
const component = new Series (audioContext, children);
component.type = "container";
const ui = new Control(component, "series");
createFields(
component, ui,
["bypass", "silentBypass", "mix", "feedBack", "delay", "delayBeforeOutput"]
); // createFields


component.ui = ui;
return applyFieldInitializer(options, component);
} // series

export function parallel (...children) {
const options = children[0] instanceof AudioComponent?
"" : children.shift();
const component = new Parallel(audioContext, children);
component.type = "container";
const ui = new Control(component, "parallel");
createFields(
component, ui,
["bypass", "silentBypass", "mix"]
); // createFields

component.ui = ui;
return applyFieldInitializer(options, component);
} // parallel

/// helpers

function applyFieldInitializer (fd, component) {
if (!fd) return component;

const container = component.ui.container;
const initialized = new Set();
const hide = new Set();
const show = new Set();

const descriptors = (typeof(fd) === "string" || (fd instanceof String)? parseFieldDescriptor(fd) : fd)
.filter(d => d.name)
.filter(add(hide, "hide"))
.filter(add(show, "show"))
.forEach(initialize);

console.error("hide: ", hide,
"show: ", show,
"initialized: ", initialized
);

[...difference(
union(union(initialized, show), AudioComponent.sharedParameterNames),
hide
)].map(name => getField(name, container))
.filter(field => field)
.forEach(field => field.hidden = false); // forEach

return component;

function initialize (d) {
console.debug("initializer: ", d);
const {name, defaultValue, automation} = d;
const element = getInteractiveElement(name, container);

if (element) {
initialized.add(name);

if (defaultValue.length > 0) setValue(element, defaultValue);
if (element instanceof HTMLInputElement && (element.type === "number" || element.type === "range")) element.dataset.automation = automation;
console.debug("descriptor: ", name, defaultValue, element);
} else {
throw new Error(`field ${name} not found in ${container.className}`);
} // if
} // initialize

function add (set, name) {
return d => {
if (d.name === name) {
addValues(set,
trimValues(
d.defaultValue.split(",")
) // trimValues
); // addValues
return false;
} else {
return true;
} // if
} // function
} // add

function addValues (s, values) {
values.forEach(x => s.add(x));
} // addValues


} // applyFieldInitializer


function buildDom(root, dom, depth = 1) {
const container = root.ui.container;
container.insertAdjacentHTML("afterBegin", '<hr role="presentation">');
container.insertAdjacentHTML("beforeEnd", `<hr hidden class="end-marker" aria-roledescription="end ${root.ui.label}">`);
dom.appendChild(container);
if (root.children) depth += 1;
setDepth(container, depth);
if (root.children) root.children.forEach(child => buildDom(child, container, depth));
} // buildDom

function setDepth (container, depth) {
//console.debug(`dom: ${container.className}, depth ${depth}`);
container.querySelector(".component-title").setAttribute("aria-level", depth);
} // setDepth

const savedValues = new Map();
function numericFieldKeyboardHandler (e) {
// all must be lowercase
const commands = {
"control home": max, "control end": min,
"control arrowup": increase10, "pageup": increase50,
"control arrowdown": decrease10, "pagedown": decrease50,
"control -": negate, "control 0": zero,
"control enter": save, "control space": swap,
};

const key = eventToKey(e).join(" ");
//console.debug(`key: ${key}, command: ${commands[key]}`);
const element = e.target;

if (key in commands && element.tagName.toLowerCase() === "input" && (element.type === "number" || element.type === "range")) {
e.preventDefault();
execute(commands[key], element, Number(element.value));
} // if

function execute (command, element, value) {
if (commands[key]) commands[key](element, Number(element.value));
if (element.validationMessage) {
statusMessage(element.validationMessage);
element.value = Number(value);
} else {
update(element);
} // if
} // execute

function save (element, value) {
savedValues.set(element, value);
statusMessage("saved.");
} // save

function swap (element, value) {
if (!savedValues.has(element)) {
statusMessage("no saved value.");
return;
} // if

const savedValue = savedValues.get(element);
savedValues.set(element, value);
element.value = Number(savedValue);
} // swap

function negate (input, value) {input.value = -1*value;}
function zero (input) {input.value = 0;}

function max (input) {input.value = Number(input.max);} // max
function min (input) {input.value = Number(input.min);}

function increase10 (input, value) {input.value = value + 10*Number(input.step);}
function increase50 (input, value) {input.value = value + 50*Number(input.step);}
function decrease10 (input, value) {input.value = value - 10*Number(input.step);}
function decrease50 (input, value) {input.value = value - 50*Number(input.step);}

 } // numericFieldKeyboardHandler


const messageQueue = [];
function statusMessage (text, append, ignoreQueue) {
const status = document.querySelector(".root .status, #status");
if (!status) {
messageQueue.push(text);
return;
} // if

messageQueue.forEach(message => statusMessage(message, "append"));
if (append) {
status.setAttribute("aria-atomic", "false");
status.insertAdjacentHTML("beforeEnd", `<p class="message">${text}</p>\n`);
} else {
status.setAttribute("aria-atomic", "true");
status.textContent = text;
} // if
} // statusMessage

function trimValues(a) {return a.map(x => x.trim());}

function getInteractiveElement (name, container = document) {return container.querySelector(`[data-name=${name}]`);}
function getField (name, container) {return getInteractiveElement(name, container)?.closest(".field");}

