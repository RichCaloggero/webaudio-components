import {union, intersection, symmetricDifference, difference} from "./setops.js";
import {Control, update, setValue, createFields} from "./ui.js";
import {audioContext, AudioComponent, wrapWebaudioNode, Delay, Destination, Xtc, ReverseStereo, Player, Series, Parallel, componentId} from "./audioComponent.js";
import {eventToKey} from "./key.js";
import {parseFieldDescriptor} from "./parser.js";
import {addAutomation, getAutomation, removeAutomation, enableAutomation, disableAutomation, isAutomationEnabled, getAutomationInterval, setAutomationInterval, compileFunction} from "./automation.js";
import {keyboardHandler} from "./keyboardHandler.js";
import * as dom from "./dom.js";


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

options = `show=saveOnExit, storeAll, restoreAll; ${options}`;
const component = _app = {
_initialized: false,
_id: `app-${componentId.next().value}`,
children: [child],
automationType: "ui",

_saveOnExit: false,
get saveOnExit () {return this._saveOnExit;},
set saveOnExit (value) {this._saveOnExit = value;},

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
["saveOnExit", "storeAll", "restoreAll", "enableAutomation", "automationInterval", "automationType"]
); // createFields

component.ui = ui;

dom.buildDom(component);

ui.container.addEventListener ("keydown", keyboardHandler);

applyFieldInitializer(options, component);

document.addEventListener("visibilitychange", e => {
if (component.saveOnExit && e.target.visibilityState === "hidden") {
storeAll();
statusMessage("State saved.");
} // if
}); // visibilitychanged

[...ui.container.querySelectorAll("input, button")].forEach(x => update(x));
setTimeout(() => {
component._initialized = true;
statusMessage("Ready.");
}, 0); // give time for dom to settle
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
// update x and y in UI
setCartesianUI(p.positionX.value, p.positionY.value, p.positionZ.value);
} // set
}); // defineProperty

Object.defineProperty(component, "angle", {
get () {return this._angle;},
set (value) {
const p = this.webaudioNode;
this._angle = Number(value);
p.positionX.value = this._radius*Math.cos(this._angle);
p.positionZ.value = this._radius*Math.sin(this._angle);
setCartesianUI(p.positionX.value, p.positionY.value, p.positionZ.value);
} // set
}); // defineProperty

createFields(component, component.ui, ["radius", "angle"]);

return applyFieldInitializer(options, component);

function setCartesianUI (x, y, z) {
setValue(component.ui.getElementByName("positionX"), x);
setValue(component.ui.getElementByName("positionY"), y);
setValue(component.ui.getElementByName("positionZ"), z);
} // setCartesianUI


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

const container = component.ui.container.fields;
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
)].map(name => dom.getField(name, container))
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
const element = dom.getInteractiveElement(name, container);

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


function addValues (s, values) {
values.forEach(x => s.add(x));
} // addValues

function trimValues(a) {return a.map(x => x.trim());}

} // applyFieldInitializer



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

function compile (text) {
const _function = compileFunction(text);
if (_function && _function instanceof Function) return _function;
statusMessage(`Invalid automation function: ${text}`);
return false;
} // compile

function removeBlanks (s) {return s.replace(/\s+/g, "");}

function getAllFields(container) {return [...(container.fields ?? container).querySelectorAll(".field")];}

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


