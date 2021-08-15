import {union, intersection, symmetricDifference, difference} from "./setops.js";
import {Control, update, setValue, createFields, compile, statusMessage} from "./ui.js";
import {audioContext, AudioComponent, Delay, Destination, Xtc, ReverseStereo, Player, Series, Parallel, componentId} from "./audioComponent.js";
import {wrapWebaudioNode, webaudioParameters, reorder} from "./parameters.js";
import {parseFieldDescriptor} from "./parser.js";
import {addAutomation, getAutomation, removeAutomation, enableAutomation, disableAutomation, isAutomationEnabled, getAutomationInterval, setAutomationInterval, compileFunction} from "./automation.js";
import {keyboardHandler} from "./keyboardHandler.js";
import * as dom from "./dom.js";
import {publish, subscribe} from "./observer.js";


/// root (top level UI)


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
dom.buildDom(component);
ui.container.addEventListener ("keydown", keyboardHandler);
applyFieldInitializer(options, component);

document.addEventListener("visibilitychange", e => {
if (component.saveOnExit && e.target.visibilityState === "hidden") {
storeAll();
statusMessage("State saved.");
} // if
}); // visibilitychanged

dom.getAllInteractiveElements(ui.container).forEach(element => update(element));
setTimeout(() => {
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

export function panner (options) {
let component = wrapWebaudioNode(audioContext.createPanner(), "do not create UI");

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
component = publish(component);

const ui = new Control(component, component.name);
console.debug("panner: ui = ", ui);
createFields(
component, ui, reorder([
...AudioComponent.sharedParameterNames,
"polarInput", "radius", "angle",
...webaudioParameters(component.webaudioNode).map(p => p.name)
]), // reorder
component.webaudioNode
); // createFields
console.debug("- after createFields: ", ui);

component.ui = ui;


document.addEventListener("ready", e => {
if (e.detail === getApp(component)) {
subscribe(component, "radius", toCartesian);
subscribe(component, "angle", toCartesian);
subscribe(component, "positionX", toPolar);
subscribe(component, "positionZ", toPolar);
} // if
}); // ready

return applyFieldInitializer(options, component);

function toCartesian (object) {
object.positionX = object.radius * Math.cos(object.angle);
object.positionZ = object.radius * Math.sin(object.angle);
setCartesianCoordinates(object.positionX, object.positionY, object.positionZ);
} // toCartesian

function toPolar (object) {
object.radius = Math.sqrt(Math.pow(object.positionX, 2) + Math.pow(object.positionZ, 2));
object.angle = object.positionZ === 0? 0 : Math.tan(object.positionZ / object.positionX);
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
)].map(name => component.ui.nameToField(name))
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
const element = component.ui.nameToElement(name);

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



function getApp (component) {
while (component.parent) component = component.parent;
return component ;
} getApp


