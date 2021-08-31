import {Control, update, setValue, createFields, statusMessage} from "./ui.js";
import {audioContext, AudioComponent, Delay, Destination, Xtc, ReverseStereo, Player, Series, Parallel, componentId} from "./audioComponent.js";
import {wrapWebaudioNode, webaudioParameters, reorder} from "./parameters.js";
import {parseFieldDescriptor} from "./parser.js";
import {getAutomation,  enableAutomation, disableAutomation, isAutomationEnabled, getAutomationInterval, setAutomationInterval} from "./automation.js";
import {keyboardHandler} from "./keyboardHandler.js";
import * as dom from "./dom.js";
import {union} from "./setops.js";
import {publish, subscribe} from "./observer.js";
await audioContext.audioWorklet.addModule("./dattorroReverb.worklet.js");


/// app (top level UI)

export function app (options, child) {
if (arguments.length === 1) {
child = arguments[0];
options = "";
} else if (arguments.length !== 2) {
alert ("app: must have either 1 or 2 arguments");
return;
} // if

options = `show=saveOnExit, storeAll, restoreAll; ${options}`;
const component = {
name: "app",
_initialized: false,
type: "app", 
_id: `app-${componentId.next().value}`,
children: [child],
automationType: "ui",

_saveOnExit: false,
get saveOnExit () {return this._saveOnExit;},
set saveOnExit (value) {this._saveOnExit = value;},

get storeAll () {return null;},
set storeAll (value) {
if (!this._initialized) return;
dom.storeAllFields();
statusMessage("Done.");
}, // set storeAll

get restoreAll () {return null;},
set restoreAll (value) {
if (!this._initialized) return;
dom.restoreAllFields();
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
applyFieldInitializer(options, component);
dom.buildDom(component);
ui.container.addEventListener ("keydown", keyboardHandler);

document.addEventListener("visibilitychange", e => {
if (component.saveOnExit && e.target.visibilityState === "hidden") {
storeAll();
statusMessage("State saved.");
} // if
}); // visibilitychanged

//console.debug("app: updating all ...");
dom.getAllInteractiveElements(ui.container).forEach(element => update(element));

setTimeout(() => {
walkComponentTree(component, dom.showFields);
component._initialized = true;
document.dispatchEvent(new CustomEvent("ready", {detail: component, bubbles: true}));
statusMessage("Ready.");
}, 5); // give time for dom to settle


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
component.ui = ui;

const position = ui.nameToElement("position");
component._media.addEventListener("timeupdate", e => {
if (!component._media.seeking) position.value = Number(e.target.currentTime.toFixed(1))
});
position.step = 0.1;

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

export function reverb (options) {
return applyFieldInitializer(options, wrapWebaudioNode(
new AudioWorkletNode(audioContext, "dattorroReverb")
));
} // reverb

export function panner (options) {
let component = wrapWebaudioNode(audioContext.createPanner(), {publish: true});

component._polarInput = false,
Object.defineProperty(component, "polarInput", {
get () {return this._polarInput;},
set (value) {this._polarInput = Boolean(value);}
}); // define polarInput

component._radius = 0,
Object.defineProperty(component, "radius", {
enumerable: true,
get () {return this._radius;},
set (value) {
this._radius = Number(value);
} // set
}); // defineProperty

component._angle = 0;
Object.defineProperty(component, "angle", {
enumerable: true,
get () {return this._angle;},
set (value) {
this._angle = Number(value);
} // set
}); // defineProperty

createFields(component, component.ui, ["polarInput", "radius", "angle"], null, "positionZ");

/*-delete
component = publish(component);
const ui = new Control(component, component.name);
createFields(
component, ui, reorder([
...AudioComponent.sharedParameterNames,
"polarInput", "radius", "angle",
...webaudioParameters(component.webaudioNode).map(p => p.name)
]), // reorder
component.webaudioNode
); // createFields
component.ui = ui;
*/


subscribe(component, "radius", toCartesian);
subscribe(component, "angle", toCartesian);
subscribe(component, "positionX", toPolar);
subscribe(component, "positionZ", toPolar);

return applyFieldInitializer(options, component);

function toCartesian (object) {
const r = object.radius, a = object.angle;
object.positionX = r * Math.cos(a);
object.positionZ = r * Math.sin(a);
setCartesianCoordinates(object.positionX, object.positionY, object.positionZ);
} // toCartesian

function toPolar (object) {
const x = object.positionX, z = object.positionZ;
//console.debug("toPolar: ", x, z);
object.radius = Math.sqrt(Math.pow(x, 2) + Math.pow(z, 2));
object.angle = x === 0? 0 : Math.atan(z/x);
if (z < 0) object.angle += Math.PI;
setPolarCoordinates(object.radius, object.angle);
} // toPolar

function setCartesianCoordinates (x, y, z) {
//console.debug("setting cartesian: ", x, y, z);
setValue(component.ui.nameToElement("positionX"), x);
setValue(component.ui.nameToElement("positionY"), y);
setValue(component.ui.nameToElement("positionZ"), z);
//alert(`${x}, ${y}, ${z}`);
} // setCartesianCoordinates

function setPolarCoordinates (radius, angle) {
//console.debug("setting polar: ", radius, angle);
setValue(component.ui.nameToElement("radius"), radius);
setValue(component.ui.nameToElement("angle"), angle);
//alert(`${radius}, ${angle}`);
} // setPolarCoordinates

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
bypass; mix=0.25; delay=0.00007; feedback=0.85;
preType=bandpass;
preFrequency=803.838 | s(t/2, 800, 1000);
preQ=0.205 | c(t/3, .2, 0.9);
preFilterGain=0;
postType=peaking;
postFrequency=851.71 | c(t/3, 850, 1050);
postQ=0.21 | s(t/2, 0.2, 0.9);
postFilterGain=7
`) {
const component = new Xtc(audioContext);
const ui = new Control(component, "xtc");

createFields(
component, ui,
[...AudioComponent.sharedParameterNames,
"delay", "feedback",
"preType", "preFrequency", "preQ", "preFilterGain",
"postType", "postFrequency", "postQ", "postFilterGain"
]); // createFields
component.ui = ui;

//subscribe(component, "preType", updatePreGain);
//subscribe(component, "postType", updatePostGain);


return applyFieldInitializer(options, component);


/*function updatePreGain (component, name, type) {
if (component._filterGainTypes.includes(type)) {
component.ui.nameToField("preFilterGain").hidden = false;
 component.ui.nameToField("preGain").hidden = true;
} else {
component.ui.nameToField("preFilterGain").hidden = true;
 component.ui.nameToField("preGain").hidden = false;
} // if
} // updatePreGain 

function updatePostGain (component, name, type) {
if (component._filterGainTypes.includes(type)) {
component.ui.nameToField("postFilterGain").hidden = false;
 component.ui.nameToField("postGain").hidden = true;
} else {
component.ui.nameToField("postFilterGain").hidden = true;
 component.ui.nameToField("postGain").hidden = false;
} // if
} // updatePostGain 
*/

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
const ui = component.ui;

const initializers = new Set();
const hide = new Set();
const show = new Set();
const alwaysShow = new Set(["bypass", "silentBypass"]);


// following this operation, initializers will contain the set of descriptors to be initialized, while show and hide will contain field names
const descriptors = (typeof(fd) === "string" || (fd instanceof String)? parseFieldDescriptor(fd) : fd)
.filter(d => d.name)
.filter(d => (
d.name === "hide")? (add(hide, d.defaultValue), false) : true
).filter(d => (d.name === "show")?
(add(show, d.defaultValue), false) : true
).filter(d => d.name === "title"?
(container.parentElement.querySelector(".component-title").textContent = d.defaultValue, false) : true
 ).forEach(d => initializers.add(d));

// show all fields if show contains exactly one "*"
if (show.size === 1 && show.has("*")) {
show.delete("*");
container.querySelectorAll(".field").forEach(f => show.add(f.dataset.name));
} // if

ui._show = union(show, alwaysShow);
ui._hide = hide;
ui._initializers = initializers;
return component;

function add (set, values) {
addValues(set, trimValues(values.split(",")));
} // add


function addValues (s, values) {
values.forEach(x => s.add(x));
} // addValues

function trimValues(a) {return a.map(x => x.trim());}

} // applyFieldInitializer




function getApp (component) {
while (component.parent) component = component.parent;
return component ;
} getApp

function walkComponentTree (component, _function) {
_function (component);
if (component.children) component.children.forEach(c => walkComponentTree(c, _function));
} // walkComponentTree

