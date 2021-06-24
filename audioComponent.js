import {intersection, difference} from "./setops.js";
export let audioContext = new AudioContext();

// registry helps generate id strings
const registry = new Map();
function registerComponent (name) {
if (!name) return 0;
if (registry.has(name)) registry.set(name, 0);
registry.set(name, registry.get(name) + 1);
return registry.get(name);
} // registerComponent

let errorVerbosity = 0;

export class AudioComponent {
static sharedParameterNames = ["bypass", "silentBypass", "mix"];
static constraints = {
Q: {min: -20, max: 20, step: 0.02},
frequency: {min: 20, max: 20000, step: 10},
coneInnerAngle: {min: 0, max: 360, step: 1},
coneOuterAngle: {min: 0, max: 360, step: 1},
mix: {defaultValue: 1, min: -1, max: 1, step: 0.1},
gain: {defaultValue: 1, min: -10, max: 10, step: 0.1}
}; // constraints

constructor (audio, name, parent = null) {
//console.debug("audioComponent: instantiating ", name);
this.audio = audio;
this.name = name;
this.parent = parent;
this._id = registerComponent(name);

this._bypass = false;
this._silentBypass = false;
this.input = audio.createGain();
this.output = audio.createGain();
this.wet = audio.createGain();
this.dry = audio.createGain();
this.__bypass = audio.createGain();

this.input.connect(this.dry).connect(this.output);
this.input.connect(this.__bypass);

this.wet.connect(this.output);

this.mix = 1.0;
this.bypass = false;
//console.debug(`component ${name} created`);
} // constructor

get id () {
return `${this.parent? this.parent.id + "." : ""}${name}-${this._id}`;
} // get id

get silentBypass () {return this.__bypass.gain.value === 0;}
set silentBypass (value) {value? this.__bypass.gain.value = 0.0 : this.__bypass.gain.value = 1.0;}

get mix () {return this._mix;}
set mix (value) {
//console.debug(`mix: ${this.name} ${this.value} ${!this.output} ${!this.wet}`);
this._mix = this.wet.gain.value = clamp(value);
this.dry.gain.value = 1-Math.abs(this._mix);
return this;
} // set mix

get bypass () {return this._bypass;}
set bypass (value) {
if (!this.output) return;
//console.debug(`${this.name}.bypass ${value} ${this.wet.gain.value} ${this.dry.gain.value} ${this._bypass}`);
if (value) {
this.dry.disconnect();
this.wet.disconnect();
this.__bypass.connect(this.output);
this._bypass = true;
} else {
this.dry.connect(this.output);
this.wet.connect(this.output);
this.__bypass.disconnect();
this._bypass = false;
} // if
//console.debug(`- ${this.wet.gain.value} ${this.dry.gain.value} ${this._bypass}`);

return this;
} // bypass

connect (component) {
if (component instanceof AudioComponent && this.output && component.input) this.output.connect(component.input);
else if (component instanceof AudioNode && this.output) this.output.connect(component);
else this._error(`${this}: cannot connect to ${component}`);

return component;
} // connect

disconnect (component) {
if (component instanceof AudioComponent) this.output.disconnect(component.input);
else if (component instanceof AudioNode) this.output.disconnect(component);
else alert(`${this}: cannot connect to ${component}`);

return component;
} // disconnect

_error (message) {
message = errorVerbosity > 0? `${this.id}: ${message}`
: `${this.name}: ${message}`;
console.error(message);
} // _error

} // class AudioComponent

export class Destination extends AudioComponent {
constructor (audio) {
super (audio, "destination");
this.output = null;
this.webaudioNode = audio.destination;
this.input.connect(this.webaudioNode);
}; // constructor
} // class Destination

export class Split extends AudioComponent {
constructor (audio, components, swapInputs, swapOutputs) {
super (audio, "split");
if (components.length === 0 || components.length > 2) this._error("must have at least one, and no more than two child elements");

this.splitter = this.audio.createChannelSplitter(2);
this.merger = this.audio.createChannelMerger(2);
this.children = this.components = components;


this.input.connect(this.splitter);
this.merger.connect(this.wet);
this._connect (swapInputs, swapOutputs);
} // constructor

_connect (swapInputs, swapOutputs) {
const channel1 = this.components[0];
const channel2 = this.components.length === 1? null : this.components[1];

//console.debug(`split: swap: ${swapInputs}, ${swapOutputs}`);
if (channel1) {
this.splitter.connect (channel1.input, swapInputs? 1 : 0, 0);
channel1.output.connect (this.merger, 0, swapOutputs? 1 : 0);
console.log(`- channel 1: ${channel1.name} connected`);
} // if

if (channel2) {
this.splitter.connect (channel2.input, swapInputs? 0 : 1, 0);
channel2.output.connect (this.merger, 0, swapOutputs? 0 : 1);
console.log(`- channel 2: ${channel2.name} connected`);
} // if
} // _connect
} // class Split

export class Series extends AudioComponent {
constructor (audio, components) {
super (audio, "series");
if (components.length < 2) this._error("need two or more components");

const first = components[0];
const last = components[components.length-1];
this._feedForward = audio.createGain();
this._delay = audio.createDelay();
this._feedBack= audio.createGain();
this._delay.delayTime.value = 0;
this._feedForward.gain.value = this._feedBack.gain.value = 0;

if(first.input) {
this.input.connect(first.input);
console.log(`- connected ${this.name} input to ${first.name}`);
} // if

if (first !== last) {
components.forEach((c, i, all) => {
if (i < all.length-1) {
const next = all[i+1];

if (c.output && next.input) {
//c.output.disconnect();
c.output.connect(next.input);
console.log(`- connected ${c.name} to ${next.name}`);

if (c !== last) {
//c.output.connect(this._feedForward).connect(last.input);
//console.log(`- feedForward: connected ${c.name} to ${this.name} last`);
} // if

} else {
//this._error(`${c.name} and ${next.name} must both be AudioComponents`);
} // if
} // if
}); // forEach
} // if

if (last.output) {
last.connect(this.wet);
console.log(`- connected ${last.name} to ${this.name} wet`);

last.connect(this._feedBack).connect(this._delay).connect(first);
console.log(`- feedBack ${this.name}: connected ${last.name} to ${first.name}`);
} // if


this.first = first;
this.last = last;
this.children = this.components = components;
} // constructor

get feedForward () {return this._feedForward.gain.value;}
get feedBack () {return this._feedBack.gain.value;}
get delay () {return this._delay.delayTime.value;}

set feedForward (value) {this._feedForward.gain.value = clamp(value, -1, 1);}
set feedBack(value) {this._feedBack.gain.value = clamp(value, -0.998, 0.998);}
set delay (value) {this._delay.delayTime.value = value;}
} // class Series

export class Parallel extends AudioComponent {
constructor (audio, components) {
super (audio, "parallel");
if (components.length < 2) this._error("need two or more components");

//console.debug(`parallel: connecting ${components.length} components in parallel:`);
this._gain = this.audio.createGain();
components.forEach((c, i) => {
if (c.input) {
this.input.connect(c.input);
console.log(`- connecting ${this.name}.input to ${c.name}`);
} // if

if (c.output) {
c.output.connect(this._gain);
console.log(`- connecting ${c.name} to ${this.name}.wet`);
} // if
}); // forEach

this._gain.gain.value = 1 / components.length;
this._gain.connect(this.wet);
this.children = this.components = components;
} // constructor

get outputGain () {return this._gain.gain.value;}
} // class Parallel

export class ReverseStereo extends AudioComponent {
constructor (audio) {
super (audio);
const s = audio.createChannelSplitter(2);
const m = audio.createChannelMerger(2);
this.input.connect(s);
s.connect(m, 0,1);
s.connect(m, 1,0);
m.connect(this.wet);
} // constructor
} // class ReverseStereo


function random (min, max) {return Math.random() * Math.abs(max-min) + min;}


export function clamp (value, min = -1, max = 1) {
if (value > max) value = max;
else if (value < min) value = min;
return value;
} // clamp


export function wrapWebaudioNode (node) {
const component = new AudioComponent(node.context, node.constructor.name);
component.type = "webaudioNode";
component.webaudioNode = node;

if (node.numberOfInputs > 0) component.input.connect(node);
else component.input = null;

if (node.numberOfOutputs > 0) node.connect(component.wet);
else component.output = null;

if (!component.input && !component.output) component._error("no connections possible; both input and output are null");

// create getters and setters on component which talk to the webaudio node inside
webaudioParameterNames(node).forEach(name => {
const descriptor = {enumerable: true,
get () {return _get(node, name);},
set (value) {_set(node, name, value);}
}; // descriptor
Object.defineProperty(component, name, descriptor);
}); // forEach

// create UI
const ui = new Control(component, component.name);
createFields(component, node, ui, reorder([...AudioComponent.sharedParameterNames, ...webaudioParameterNames(node)]));

component.ui = ui;
return component;
} // wrapWebaudioNode

function _get (object, name) {
return isAudioParam(object, name)?
object[name].value : object[name];
} // _get

function _set (object, name, value) {
isAudioParam(object, name)?
object[name].value  = value : object[name] = value;
return object;
} // _set


function webaudioParameterNames (node, _exclude = []) {
const excludedParameterNames = [
"context",
"numberOfInputs", "numberOfOutputs",
"channelCount", "channelCountMode", "channelInterpretation",
"addEventListener", "removeEventListener"
];
const names = [];
const exclude = new Set(_exclude.concat(excludedParameterNames));

for (name in node) {
if (node[name] instanceof Function || exclude.has(name)) continue;
names.push(name);
} // for

return names;
} // webaudioParameterNames

function reorder (_names) {
const ordering = new Set([
...AudioComponent.sharedParameterNames,
"type", "frequency", "Q",
"positionX", "positionY", "positionZ",
"orientationX", "orientationY", "orientationZ",
"gain",
"delayTime"
]); // ordering

const names = new Set(_names);
return [...intersection(names, ordering), ...difference(names, ordering)];
} // reorder

function isAudioParam (node, property) {return node[property] instanceof AudioParam;}

export function createFields (component, node, ui, propertyNames) {
propertyNames.forEach(property => {
if (typeof(component[property]) === "number") {

ui.container.appendChild(ui.number(
Object.assign({
name: property,
min: -Infinity, max: Infinity,
defaultValue: isAudioParam(node, property)? node[property].defaultValue : 0
}, AudioComponent.constraints[property]
) // assign
));

} else if (typeof(component[property]) === "boolean") {
ui.container.appendChild(ui.boolean({name: property}));

} else if (typeof(component[property]) === "string") {
ui.container.appendChild(ui.string({name: property}));
} // if
}); // forEach
} // createFields
