import S from "./S.module.js";
import {Control, update, setValue, createFields, statusMessage} from "./ui.js";
import {audioContext, AudioComponent, Delay, Destination, Xtc, ReverseStereo, Player, Series, Parallel, componentId} from "./audioComponent.js";
import {createUi, reorder} from "./parameters.js";
import {parseFieldDescriptor} from "./parser.js";
import {getAutomation,  enableAutomation, disableAutomation, isAutomationEnabled, getAutomationInterval, setAutomationInterval} from "./automation.js";
import {keyboardHandler} from "./keyboardHandler.js";
import * as dom from "./dom.js";
import {union} from "./setops.js";
import {publish, subscribe} from "./observer.js";
await audioContext.audioWorklet.addModule("./dattorroReverb.worklet.js");
await audioContext.audioWorklet.addModule("./midSide.worklet.js");
await audioContext.audioWorklet.addModule("./stereoProcessor.worklet.js");


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

const ui = createUi (component, "root").ui;

/*const ui = new Control(component, "App");
createFields(
component, ui,
["saveOnExit", "storeAll", "restoreAll", "enableAutomation", "automationInterval", "automationType"]
); // createFields
component.ui = ui;
*/

ui.container.insertAdjacentHTML("afterBegin", '<div role="status" aria-atomic="true" aria-label="status" class="status"></div>\n');
ui.container.classList.add("root");


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

export function passThrough () {
const component = new AudioComponent(audioContext);
component.input.connect(component.output);
component.ui = new Control(component, "pass through");
return component;
} // passThrough

/// wrapped webaudio nodes

export function player (options) {
const component = createUi(new Player(audioContext));

component._audioElement.addEventListener("error", e => statusMessage(`cannot load media from ${e.target.src}`));

component._audioElement.addEventListener("timeupdate", e => {
if (!e.target.seeking) component.ui.nameToElement("position").value = Number(e.target.currentTime.toFixed(1))
});

return applyFieldInitializer(options, component);
} // player

export function destination () {
const component = new Destination(audioContext);
const ui = new Control(component, "destination");
component.ui = ui;
return component;
} // destination

export function gain (options) {
return applyFieldInitializer(options, createUi(audioContext.createGain()));
} // gain

export function reverseStereo (options) {
const component = new ReverseStereo (audioContext);
const ui = new Control(component, "reverseStereo");

createFields(component, ui, AudioComponent.sharedParameterNames);

component.ui = ui;
return applyFieldInitializer(options, component);
} // reverseStereo

export function filter (options) {
return applyFieldInitializer(options, createUi(audioContext.createBiquadFilter()));
} // filter

export function reverb (options) {
return applyFieldInitializer(options, createUi(
new AudioWorkletNode(audioContext, "dattorroReverb")
));
} // reverb

export function stereoPanner (options) {
return applyFieldInitializer(options, createUi(audioContext.createStereoPanner()));
} // stereoPanner

export function panner (options) {
let component = createUi(audioContext.createPanner());
component.radius = component.angle = 0.0;
const ui = component.ui;

createFields(component, ui, ["radius", "angle"], "positionZ");

S.root(() => {
const polar = S(() => toPolar(ui.valueOf("positionX"), ui.valueOf("positionZ")));
const cartesian = S(() => toCartesian(ui.valueOf("radius"), ui.valueOf("angle")));

S(() => [component.positionX, component.positionZ] = cartesian());

S(() => {
const [_r, _a] = polar();
ui.setValue("radius", _r.toFixed(3));
ui.setValue("angle", _a.toFixed(3));
});

S(() => {
const [_x, _z] = cartesian()
ui.setValue("positionX", _x.toFixed(3));
ui.setValue("positionZ", _z.toFixed(3));
});
}); // S.root

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


export function xtc (options /*= `
bypass; mix=0.25; delay=0.00007; feedback=0.85;
preType=bandpass;
preFrequency=803.838 | s(t/2, 800, 1000);
preQ=0.205 | c(t/3, .2, 0.9);
preGain=0;
preGain=1;
postType=peaking;
postFrequency=851.71 | c(t/3, 850, 1050);
postQ=0.21 | s(t/2, 0.2, 0.9);
postGain=7
`*/) {
return applyFieldInitializer(options, createUi(new Xtc(audioContext)));
} // xtc

export function midSide (options = "midGain=1; sideGain=1") {
return applyFieldInitializer(options,
createUi(new AudioWorkletNode(audioContext, "midSide", {outputChannelCount: [2]}))
);
} // midSide

export function stereoProcessor (options = "") {
options = `title = Stereo Processor; ${options}`;
return applyFieldInitializer(options,
createUi(new AudioWorkletNode(audioContext, "stereoProcessor", {outputChannelCount: [2]}))
);
} // midSide

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

function applyFieldInitializer (fd = null, component) {
if (!fd) return component;

const container = component.ui.fields;
if (!container) return component;
const ui = component.ui;

const initializers = new Set();
const hide = new Set();
const show = new Set();
const alwaysShow = new Set(["bypass", "silentBypass"]);


// following this operation, initializers will contain the set of descriptors to be initialized, while show and hide will contain field names
const descriptors = (typeof(fd) === "string" || (fd instanceof String)? parseFieldDescriptor(fd.trim()) : fd)
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
//console.debug("walking: ", component.name, _function);
_function (component);
if (component.children) component.children.forEach(c => walkComponentTree(c, _function));
} // walkComponentTree

export function toPolar (_x, _y) {
return [
Math.sqrt(_x*_x + _y*_y),
Math.atan2(_y, _x)
];
} // toPolar

export function toCartesian (_r, _a) {
return [
_r * Math.cos(_a),
_r * Math.sin(_a)
];
} // toCartesian
