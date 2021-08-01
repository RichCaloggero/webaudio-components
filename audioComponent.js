import {createFields} from "./ui.js";
import {intersection, difference} from "./setops.js";
import {Control} from "./ui.js";

export let audioContext = new AudioContext();

await audioContext.resume();
await audioContext.audioWorklet.addModule("./xtc.worklet.js");
console.log("audioWorklet.xtc created.");

function* idGen () {let count = 1; while(true) yield count++;}
export const componentId = idGen();
let errorVerbosity = 0;

export class AudioComponent {
static sharedParameterNames = ["bypass", "silentBypass", "mix"];
static constraints = {
Q: {min: -20, max: 20, step: 0.01},
frequency: {min: 20, max: 20000, step: 10},
angle: {step: .02},
coneInnerAngle: {min: 0, max: 360, step: 1},
coneOuterAngle: {min: 0, max: 360, step: 1},
mix: {defaultValue: 1, min: -1, max: 1, step: 0.01},
channelCount: {min: 1, max: 2},
rolloffFactor: {min: 0, step: 0.1},
gain: {step: 0.02},
feedBack: {defaultValue: 0, min: -0.95, max: 0.95, step: 0.01},
delay: {defaultValue: 0, min: 0, max: 1, step: 0.00001}
}; // constraints

constructor (audio, name, parent = null) {
//console.debug("audioComponent: instantiating ", name);
this.audio = audio;
this.name = name || "component";
this.parent = parent;
this._id = `${this.name}-${componentId.next().value}`;

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

export class Xtc extends AudioComponent {
constructor (audio) {
super (audio, "xtc");
this.low = audio.createBiquadFilter();
this.mid = audio.createBiquadFilter();
this.high = audio.createBiquadFilter();
this.xtc = new AudioWorkletNode(audio, "xtc");

this.input
//.connect(this.low).connect(this.mid).connect(this.high)
.connect(this.xtc).connect(this.wet);
} // constructor

get reverseStereo () {return this.xtc.parameters.get("reverseStereo").value !== 0;}
get gain () {return this.xtc.parameters.get("gain").value;}
get delay () {return this.xtc.parameters.get("delay").value;}
get feedback () {return this.xtc.parameters.get("feedback").value;}

set reverseStereo (value) {this.xtc.parameters.get("reverseStereo").value = Number(value? 1 : 0);}
set gain (value) {this.xtc.parameters.get("gain").value = value;}
set delay (value) {this.xtc.parameters.get("delay").value = value;}
set feedback (value) {this.xtc.parameters.get("feedback").value = value;}

// exposed filter parameters
/*get lowFrequency () {return this.low.frequency.value;}
get lowQ () {return this.low.Q.value;}
get lowGain() {return this.low.frequency.value;}
get lowType() {return this.low.type;}

get midFrequency () {return this.mid.frequency.value;}
get midQ () {return this.mid.Q.value;}
get midGain() {return this.mid.frequency.value;}
get midType() {return this.mid.type;}

get highFrequency () {return this.high.frequency.value;}
get highQ () {return this.high.Q.value;}
get highGain() {return this.high.gain.value;}
get highType() {return this.high.type;}

set lowFrequency (value) {this.low.frequency.value = value;}
set lowQ (value) {this.low.Q.value = value;}
set lowGain(value) {this.low.gain.value = value;}
set lowType (value) {this.low.type = value;}

set midFrequency (value) {this.mid.frequency.value = value;}
set midQ (value) {this.mid.Q.value = value;}
set midGain(value) {this.mid.gain.value = value;}
set midType (value) {this.mid.type = value;}

set highFrequency (value) {this.high.frequency.value = value;}
set highQ (value) {this.high.Q.value = value;}
set highGain(value) {this.high.gain.value = value;}
set highType (value) {this.high.type = value;}
*/
} // class Xtc

export class Player extends AudioComponent {
constructor (audio, media) {
super (audio, "player");
this.input = null;
this._media = null;

if (media instanceof AudioBuffer) {
this.source = createBufferSource(media);

} else {
this._media = document.createElement("audio");
audio.src = media instanceof String || typeof(media) === "string"? media : "";
this._media.setAttribute("crossorigin", "anonymous");
this.source = audio.createMediaElementSource(this._media);
this.play = false;
} // if

this.source.connect(this.output);
} // constructor

get hasMediaElement () {return this._media instanceof HTMLMediaElement;}

get media () {return this.hasMediaElement? this._media.src : null;}
set media (value) {
if (this.hasMediaElement) {
this._media.src = value;
this.play = false;
} // if
} // set media


get play () {return this.hasMediaElement? !this._media.paused : false;}
set play (value) {if (this.hasMediaElement) value? this._play() : this._pause();}

get position () {return this.hasMediaElement? this._media.currentTime : 0;}
set position (value) {if (this.hasMediaElement) this._media.currentTime = clamp(value, 0, this._media.duration);}

_play () {if (this.hasMediaElement) this._media.play();}
_pause () {if (this.hasMediaElement) this._media.pause();}

} // class Player

export class Destination extends AudioComponent {
constructor (audio) {
super (audio, "destination");
this.output = null;
this.webaudioNode = audio.destination;
this.input.connect(this.webaudioNode);
}; // constructor
} // class Destination

export class Delay extends AudioComponent {
constructor (audio) {
super (audio, "delay");

this._in = audio.createGain();
this._out = audio.createGain();
this.webaudioNode = audio.createDelay();
this._feedBack = audio.createGain();

this.input.connect(this._in).connect(this.webaudioNode).connect(this._out).connect(this.wet);
this._out.connect(this._feedBack).connect(this._in);
} // constructor

get delay () {return this.webaudioNode.delayTime.value;}
get feedBack() {return this._feedBack.gain.value;}

set delay (value) {this.webaudioNode.delayTime.value = value;}
set feedBack(value) {this._feedBack.gain.value = value;}
} // class Delay

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
this.first = first;
this.last = last;
this.children = this.components = components;


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

} else {
//this._error(`${c.name} and ${next.name} must both be AudioComponents`);
} // if
} // if
}); // forEach
} // if

if (last.output) {
last.output.connect(this.wet);
console.log(`- connected ${last.name} to ${this.name} wet`);
} // if
} // constructor
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
set outputGain (value) {this._gain.gain.value = value;}
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
this.mix = 1;
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
const descriptor = {
enumerable: true,
get () {return _get(node, name);},
set (value) {
_set(node, name, value);
//if (name === "positionX" || name === "positionZ")
//console.debug(`${node.Name}: setter.${name} to ${value}`);

} // set
}; // descriptor
Object.defineProperty(component, name, descriptor);
}); // forEach

// create UI
const ui = new Control(component, component.name);
createFields(
component, ui,
reorder([...AudioComponent.sharedParameterNames, ...webaudioParameterNames(node)]),
node
); // createFields

component.ui = ui;
return component;
} // wrapWebaudioNode

function _get (object, name) {
return isAudioParam(object, name)?
object[name].value : object[name];
} // _get

function _set (object, name, value) {
//console.debug(`_set: ${object}, ${name}, ${value}`);
if (object && name) {
isAudioParam(object, name)?
object[name].value  = value : object[name] = value;
} // if
return object;
} // _set


function webaudioParameterNames (node, _exclude = []) {
const excludedParameterNames = [
"context",
"numberOfInputs", "numberOfOutputs",
"channelCountMode", "channelInterpretation",
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
"radius", "angle",
"gain",
"delayTime"
]); // ordering

const names = new Set(_names);
return [...intersection(names, ordering), ...difference(names, ordering)];
} // reorder

export function isAudioParam (node, property) {return node && node[property] instanceof AudioParam;}


export function createBufferSource (buffer) {
if (buffer instanceof AudioBuffer) {
const source = audioContext.createBufferSource();
source.buffer = buffer;
return source;
} else {
console.error("createBufferSource: first argument must be a audio buffer", buffer);
return null;
} // if
} // createBufferSource

