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

const ui = new Control({}, "App");
ui.container.insertAdjacentHTML("afterBegin", '<div role="status" aria-atomic="true" aria-label="status" class="status"></div>\n');
ui.container.classList.add("root");

setDepth(ui.container, 1);
buildDom(component, ui.container);

ui.container.addEventListener ("keydown", numericFieldKeyboardHandler);
ui.container.querySelectorAll("input, button").forEach(x => update(x));


setTimeout(() => statusMessage("Ready."), 10); // give time for dom to settle

return ui.container;
} // app


/// wrapped webaudio nodes

export function player (media, options) {
const component = new Player(audioContext, media);

const ui = new Control(component, "player");
createFields(
component, ui,
["media", "play", "pause", "position"]
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
return applyFieldInitializer(options, wrapWebaudioNode(audioContext.createPanner()));
} // filter

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
const descriptors = typeof(fd) === "string" || (fd instanceof String)?
parseFieldDescriptor(fd) : fd;

const initialized = [];
descriptors.forEach(d => {
// if multiple semicolons occur in the original string, or if a semi appears at the end, d will be empty so skip 
if (d.name) {
console.debug("initializer: ", d);
const {name, defaultValue, automation} = d;
const element = container.querySelector(`[data-name=${name}`);

if (element) {
if (defaultValue.length > 0) setValue(element, defaultValue);
if (element instanceof HTMLInputElement && (element.type === "number" || element.type === "range")) element.dataset.automation = automation;
initialized.push(element.closest(".field"));
console.debug("descriptor: ", name, defaultValue, element);
} else {
throw new Error(`field ${name} not found in ${container.className}`);
} // if
} // if
}); // forEach

/*container.querySelectorAll(".field").forEach(f => f.hidden = true);
initialized.forEach(f => f.hidden = false);
console.log(`${container.className}: ${initialized.length} fields initialized.`);
*/

return component;
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

function numericFieldKeyboardHandler (e) {
// all must be lowercase
const commands = {
"control home": max, "control end": min,
"control arrowup": increase10, "pageup": increase50,
"control arrowdown": decrease10, "pagedown": decrease50,
"control -": negate, "control 0": zero,
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
