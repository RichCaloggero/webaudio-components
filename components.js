import {union, intersection, symmetricDifference, difference} from "./setops.js";
import {Control, update, setValue, createFields} from "./binder.js";
import {audioContext, AudioComponent, wrapWebaudioNode, Delay, Destination, Xtc, ReverseStereo, Player, Series, Parallel, componentId} from "./audioComponent.js";
import {eventToKey} from "./key.js";
import {parseFieldDescriptor} from "./parser.js";
import {addAutomation, getAutomation, removeAutomation, enableAutomation, disableAutomation, isAutomationEnabled, getAutomationInterval, setAutomationInterval, compileFunction} from "./automation.js";
//import {allComponents, storeAll, restoreAll} from "./save-restore.js";

/// root (top level UI)

let _app = null;

export function app (options, child) {
if (arguments.length === 1) {
child = arguments[0];
options = "";
} else if (arguments.length !== 2) {
alert ("app: must have either 1 or 2 arguments");
return;
} // if

options = `show=storeAll, restoreAll; ${options}`;
const component = _app = {
_initialized: false,
_id: `app-${componentId.next().value}`,
children: [child],
automationType: "ui",

get storeAll () {return null;},
set storeAll (value) {
if (!this._initialized) return;
storeAllFields();
statusMessage("Done.");
}, // set storeAll

get restoreAll () {return null;},
set restoreAll (value) {
if (!this._initialized) return;
restoreAllFields();
statusMessage("Done.");
}, // set restoreAll

get automationInterval () {return getAutomationInterval();},
set automationInterval (value) {setAutomationInterval(value);},
 
get enableAutomation () {return isAutomationEnabled();},
set enableAutomation(value) {value? enableAutomation() : disableAutomation();},
}; // component

const ui = new Control(component, "App");
ui.container.insertAdjacentHTML("afterBegin", '<div role="status" aria-atomic="true" aria-label="status" class="status"></div>\n');
ui.container.classList.add("root");

createFields(
component, ui,
["storeAll", "restoreAll", "enableAutomation", "automationInterval", "automationType"]
); // createFields

component.ui = ui;

buildDom(component);

ui.container.addEventListener ("keydown", numericFieldKeyboardHandler);

applyFieldInitializer(options, component);
[...ui.container.querySelectorAll("input, button")].forEach(x => update(x));
component._initialized = true;

setTimeout(() => statusMessage("Ready."), 10); // give time for dom to settle

return component;
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

createFields(component, ui, AudioComponent.sharedParameterNames);

component.ui = ui;
return applyFieldInitializer(options, component);
} // reverseStereo

export function filter (options) {
return applyFieldInitializer(options, wrapWebaudioNode(audioContext.createBiquadFilter()));
} // filter

export function panner (options) {
const component = wrapWebaudioNode(audioContext.createPanner());


component._radius = component._angle = 0;
Object.defineProperty(component, "radius", {
get () {return this._radius;},
set (value) {
const p = this.webaudioNode;
this._radius = Number(value);
p.positionX.value = this._radius*Math.cos(this._angle);
p.positionZ.value = this._radius*Math.sin(this._angle);
//statusMessage(`${(this._radius).toFixed(2)}, ${(this._angle).toFixed(2)} yields ${(p.positionX.value).toFixed(2)}, ${(p.positionZ.value).toFixed(2)}`);
} // set
}); // defineProperty

Object.defineProperty(component, "angle", {
get () {return this._angle;},
set (value) {
const p = this.webaudioNode;
this._angle = Number(value);
p.positionX.value = this._radius*Math.cos(this._angle);
p.positionZ.value = this._radius*Math.sin(this._angle);
} // set
}); // defineProperty

createFields(component, component.ui, ["radius", "angle"]);

return applyFieldInitializer(options, component);
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
createFields(component, ui, AudioComponent.sharedParameterNames);

component.ui = ui;
return applyFieldInitializer(options, component);
} // series

export function parallel (...children) {
const options = children[0] instanceof AudioComponent?
"" : children.shift();
const component = new Parallel(audioContext, children);
component.type = "container";
const ui = new Control(component, "parallel");
createFields(component, ui, AudioComponent.sharedParameterNames);

component.ui = ui;
return applyFieldInitializer(options, component);
} // parallel

/// helpers

function applyFieldInitializer (fd, component) {
fd = fd.trim();
if (!fd) return component;

const container = component.ui.container.querySelector(".fields");
if (!container) return component;

const initialized = new Set();
const hide = new Set();
const show = new Set();

const descriptors = (typeof(fd) === "string" || (fd instanceof String)? parseFieldDescriptor(fd) : fd)
.filter(d => d.name)
.filter(d => (
d.name === "hide")? (add(hide, d.defaultValue), false) : true
).filter(d => (d.name === "show")?
(add(show, d.defaultValue), false) : true
).filter(d => d.name === "title"?
(container.parentElement.querySelector(".component-title").textContent = d.defaultValue, false) : true
 ).forEach(initialize);

/*if (component.name === "series")
console.debug("component: ", component,
	"hide: ", hide,
"show: ", show,
"initialized: ", initialized
);
*/

const fieldsToShow = [...symmetricDifference(
union(union(initialized, show), AudioComponent.sharedParameterNames),
hide
)].map(name => getField(name, container))
.filter(field => field);
//console.debug("fieldsToShow: ", component.name, container.label, fieldsToShow);

if (fieldsToShow.length === 0) {
if (component.type === "container") {
container.parentElement.querySelector(".component-title").hidden = true;
container.parentElement.setAttribute("role", "presentation");
} // if

} else {
fieldsToShow.forEach(field => field.hidden = false); // forEach
} // if

return component;

function initialize (d) {
//console.debug("initializer: ", d);
const {name, defaultValue, automator} = d;
const element = getInteractiveElement(name, container);

if (element) {
initialized.add(name);
if (element.dataset.datatype === "action") return;

if (defaultValue && defaultValue.length > 0) setValue(element, defaultValue);
if (automator) addAutomation(element, automator, compile(automator));

//console.debug("descriptor: ", name, defaultValue, element);
} else {
throw new Error(`field ${name} not found in ${container.className}`);
} // if
} // initialize

function add (set, values) {
addValues(set, trimValues(values.split(",")));
} // add

/*-delete
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
*/

function addValues (s, values) {
values.forEach(x => s.add(x));
} // addValues


} // applyFieldInitializer


function buildDom(component, depth = 1) {
const dom = component.ui.container;
const domChildren = dom.querySelector(".children");
setDepth(dom, depth);
//console.debug("build: ", depth, dom);
if (component.children) component.children.forEach(child => {
//console.debug("- appending ", child.ui.container);
domChildren.appendChild(child.ui.container);
buildDom(
child,
dom.getAttribute("role") !== "presentation" && child.type === "container"? depth+1 : depth
); // buildDom
}); // forEach child
} // buildDom

function setDepth (container, depth) {
//console.debug(`dom: ${container.className}, depth ${depth}`);
container.querySelector(".component-title").setAttribute("aria-level", depth);
} // setDepth

const savedValues = new Map();
function numericFieldKeyboardHandler (e) {
// all must be lowercase
const commands = {
"control alt shift enter": help,
"control home": max, "control end": min,
"control arrowup": increase10, "pageup": increase50,
"control arrowdown": decrease10, "pagedown": decrease50,
"control -": negate, "control 0": zero,
"control space": save, "control shift space": swap,
"control enter": defineAutomation,
};

const key = eventToKey(e).join(" ");
//console.debug(`key: ${key}, command: ${commands[key]}`);
const element = e.target;

if (key in commands && element.tagName.toLowerCase() === "input" && (element.type === "number" || element.type === "range")) {
e.preventDefault();
e.stopPropagation();
execute(commands[key], element, Number(element.value));
} // if

function execute (command, element, value) {
command(element, value, commands);

//if (element.validationMessage) {
//statusMessage(element.validationMessage);
//element.value = value;
//} else {
update(element);
//} // if

return true;
} // execute

/// commands

function help (element, value, commands) {
console.log("command keys: ", Object.keys(commands));
let message = Object.keys(commands)
.map(key => `<tr><th>${key}</th> <td> ${commands[key].name || "[no name]"}</td></tr>`)
.join("\n");

displayModal(createModal({
title: "Keyboard help",
body: `<table><tr><th>key</th><th>command</th></tr>${message}</table>`
}));
} // help

function defineAutomation (element) {
const text = prompt("automator: ", (getAutomation(element) || {}).text).trim();
if (!text) {
removeAutomation(element);
statusMessage("Automation removed.");
return;
} // if

const _function = compile(text);
if (_function) addAutomation(element, text, _function);
} // defineAutomation

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


window.statusMessage = statusMessage;
export function statusMessage (text, append, ignoreQueue) {
const status = document.querySelector(".root .status, #status");
if (!status) {
alert(text);
return;
} // if

if (append) {
status.setAttribute("aria-atomic", "false");
status.insertAdjacentHTML("beforeEnd", `<p class="message">${text}</p>\n`);
} else {
status.setAttribute("aria-atomic", "true");
status.innerHTML = `<p>${text}</p>`;
} // if
} // statusMessage

function trimValues(a) {return a.map(x => x.trim());}

function getInteractiveElement (name, container = document) {return container.querySelector(`[data-name=${name}]`);}
function getField (name, container) {return getInteractiveElement(name, container)?.closest(".field");}
function getAllFields(container) {return [...container.querySelector(".fields").querySelectorAll(".field")];}

function compile (text) {
const _function = compileFunction(text);
if (_function && _function instanceof Function) return _function;
statusMessage(`Invalid automation function: ${text}`);
return false;
} // compile

function createModal (options) {
const title = options.title || "modal";
const id = {
title: `${removeBlanks(title)}-title`,
description: `${removeBlanks(title)}-description`,
}; // id

const modal = document.createElement("div");
modal.setAttribute("style", "position: relative");

modal.innerHTML =`
<div role="dialog" aria-labelledby="${id.title}" style="position:absolute; left: 25%; right: 25%; top: 25%; bottom: 25%;">
<header>
<h2 class="title" id="${id.title}">${options.title || ""}</h2>
<button class="close" aria-label="close">X</button>
</header>
<div class="body">
<div class="description" id="${id.description}">${options.description || ""}</div>
 ${options.body || ""}
</div><!-- body -->
</div><!-- modal -->
`; // html

return modal;
} // createModal

function displayModal (modal) {
document.body.appendChild(modal);

modal.addEventListener("click", e => e.target.classList.contains("close") && close(modal));
modal.addEventListener("focusout", maintainFocus);
modal.addEventListener("keydown", e => e.key === "Escape"? close(modal) : true);

modal.__restoreFocus__ = document.activeElement;
modal.querySelector(".close").focus();
return modal;

function close (modal) {
if (modal.__restoreFocus__) modal.__restoreFocus__.focus();
document.body.removeChild(modal);
} // close

function maintainFocus (e) {
const focusTo = e.relatedTarget, focusFrom = e.target;
//console.debug("maintainFocus: ", modal, focusFrom, focusTo, focusableElements);
if (focusTo && modal.contains(focusTo)) return;
e.preventDefault();
console.debug("shifting focus...");
setTimeout(() => focusFrom.focus(), 0);
} // maintainFocus
} // displayModal

function removeBlanks (s) {return s.replace(/\s+/g, "");}

function storeAllFields () {
document.querySelectorAll(".field").forEach(f => {
if (f.dataset.dataType === "Action") return;
localStorage.setItem(f.dataset.storageKey, f.dataset.value);
});
} // storeAllFields

function restoreAllFields () {
document.querySelectorAll(".field").forEach(field => {
if (field.dataset.dataType === "Action") return;
const value = field.dataset.dataType === "Boolean"? localStorage.getItem(field.dataset.storageKey) === "true" : localStorage.getItem(field.dataset.storageKey);
const element = field.querySelector("[data-name]");

setValue(element, value, "fireChangeEvent");
});
} // restoreAllFields

