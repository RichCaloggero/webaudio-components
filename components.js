import {audioContext, AudioComponent, wrapWebaudioNode, Destination, Series, Parallel} from "./audioComponent.js";
import {eventToKey} from "./key.js";
import {parseFieldDescriptor} from "./parser.js";

/// root (top level UI)

export function app (options, component) {
const ui = new Control({}, "App");
ui.container.insertAdjacentHTML("afterBegin", '<div role="status" aria-atomic="true" aria-label="status" class="status"></div>\n');
ui.container.classList.add("root");

setDepth(ui.container, 1);
buildDom(component, ui.container);

ui.container.addEventListener ("keydown", numericFieldKeyboardHandler);
setTimeout(() => statusMessage("Ready."), 1);
return ui.container;
} // app


/// wrapped webaudio nodes

export function player (source, options) {
const sourceNode = source instanceof HTMLMediaElement?
audioContext.createMediaElementSource(source)
: createBufferSource(source);
return applyFieldDescriptor(options, wrapWebaudioNode(sourceNode));
} // player

export function destination () {
const component = new Destination(audioContext);
const ui = new Control(component, "destination");
component.ui = ui;
return component;
} // destination

export function gain (options) {
return applyFieldDescriptor(options, wrapWebaudioNode(audioContext.createGain()));
} // gain

export function filter (options) {
return applyFieldDescriptor(options, wrapWebaudioNode(audioContext.createBiquadFilter()));
} // filter

export function delay(options) {
return applyFieldDescriptor(options, wrapWebaudioNode(audioContext.createDelay()));
} // delay


/// containers

export function series (...children) {
const options = children[0] instanceof AudioComponent?
"" : shift(children);
const component = new Series (audioContext, children);
component.type = "container";
const ui = new Control(component, "series");

ui.container.appendChild(ui.boolean({name: "bypass"}));
ui.container.appendChild(ui.boolean({name: "silentBypass"}));

ui.container.appendChild(ui.number({name: "mix", min: -1, max: 1, step: 0.1}));
ui.container.appendChild(ui.number({name: "feedBack", min: -1, max: 1, step: 0.1}));
ui.container.appendChild(ui.number({name: "delay", min: 0, max: 1, step: 0.00001}));

component.ui = ui;
return applyFieldDescriptor(options, component);
} // series

export function parallel (...children) {
const options = children[0] instanceof AudioComponent?
"" : shift(children);
const component = new Parallel(audioContext, children);
component.type = "container";
const ui = new Control(component, "parallel");

ui.container.appendChild(ui.boolean({name: "bypass"}));
ui.container.appendChild(ui.boolean({name: "silentBypass"}));
ui.container.appendChild(ui.number({name: "mix", min: -1, max: 1, step: 0.1}));

component.ui = ui;
return applyFieldDescriptor(options, component);
} // parallel

/// helpers

function applyFieldDescriptor (fd, component) {
if (!fd) fd = "";
const container = component.ui.container;
const descriptors = typeof(fd) === "string" || (fd instanceof String)?
parseFieldDescriptor(fd) : fd;
console.debug("applying descriptors: ", descriptors, " to ", container);

descriptors.forEach(d => {
const {name, defaultValue, automation} = d;
const element = container.querySelector(`input[data-name=${name}`);

if (element) {
if (defaultValue.length > 0) element.value = defaultValue;
element.dataset.automation = automation;
element.closest(".field").hidden = false;
} else {
statusMessage(`field ${name} not found in ${container.className}`, "append");
} // if
}); // forEach


return component;
} // applyFieldDescriptor

function createBufferSource (buffer) {
const source = audioContext.createBufferSource();
source.buffer = buffer;
return source;
} // createBufferSource

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


function statusMessage (text, append) {
const status = document.querySelector(".root .status, #status");
if (append) {
status.setAttribute("aria-atomic", "false");
status.insertAdjacentHTML("beforeEnd", `<p class="message">${text}</p>\n`);
} else {
status.setAttribute("aria-atomic", "true");
status.textContent = text;
} // if
} // statusMessage
