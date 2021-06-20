
// registry helps generate id strings
const registry = new Map();
function registerComponent (name) {
if (!name) return 0;
if (registery.has(name)) registry.set(name, 0);
registry.set(name, registry.get(name) + 1);
return registry.get(name);
} // registerComponent

let errorVerbosity = 0;

export class AudioComponent {
constructor (audio, name, parent = null) {
//console.debug("audioComponent: instantiating ", name);
this.audio = audio;
this.name = name;
this.parent = parent;
this._id = register(name);

this._silentBypass = false;
this.input = audio.createGain();
this.output = audio.createGain();
this.wet = audio.createGain();
this.dry = audio.createGain();
this._bypass = audio.createGain();

this.input.connect(this.dry).connect(this.output);
this.input.connect(this._bypass);

this.wet.connect(this.output);

this.mix(1.0);
this.bypass(false);
//console.debug(`component ${name} created`);
} // constructor

get id () {
return `${this.parent? this.parent.id + "." : ""}${name}-${this._id}`;
} // get id

silentBypass (value) {
//console.debug(`silentBypass: ${value}`);
if (value) {
this._silentBypass = true;
this._bypass.gain.value = 0;
} else {
this._silentBypass = false;
this._bypass.gain.value = 1.0;
} // if

return this;
} // silentBypass

mix (value) {
//console.debug(`mix: ${this.name} ${this.value} ${!this.output} ${!this.wet}`);
this._mix = this.wet.gain.value = clamp(value);
this.dry.gain.value = 1-Math.abs(this._mix);
return this;
} // mix

bypass (value) {
if (!this.output) return this;
//console.debug(`${this.name}.bypass ${value} ${this.wet.gain.value} ${this.dry.gain.value} ${this._bypass}`);
if (value) {
this.dry.disconnect();
this.wet.disconnect();
this._bypass.connect(this.output);
} else {
this.dry.connect(this.output);
this.wet.connect(this.output);
this._bypass.disconnect();
} // if
//console.debug(`- ${this.wet.gain.value} ${this.dry.gain.value} ${this._bypass}`);

return this;
} // bypass

connect (component) {
if (component instanceof AudioComponent) this.output.connect(component.input);
else if (component instanceof AudioNode) this.output.connect(component);
else alert(`${this}: cannot connect to ${component}`);

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

export class Split extends AudioComponent {
constructor (audio, components, swapInputs, swapOutputs) {
super (audio, "split");
if (components.length === 0 || components.length > 2) this._error("must have at least one, and no more than two child elements");

this.splitter = this.audio.createChannelSplitter(2);
this.merger = this.audio.createChannelMerger(2);
this.components = components;


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
constructor (audio, components, feedBack = false, feedForward = false) {
super (audio, "series");
//console.debug(`Series: connecting ${components.length} components in series:`);
if (components.length < 2) this._error("need two or more components");

const first = components[0];
const last = components[components.length-1];

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

if (feedForward && c !== last) {
c.output.connect(this.last.input);
console.log(`- feedForward: connected ${c.name} to ${this.name} wet`);
} // if

} else {
this._error(`${c.name} and ${next.name} must both be AudioComponents`);
} // if
} // if
}); // forEach
} // if

if (last.output) {
last.output.connect(this.wet);
console.log(`- connected ${last.name} to ${this.name} wet`);
} // if

if (feedBack) {
this._delay = audio.createDelay();
this._feedback= audio.createGain();
this._delay.delayTime.value = 0;
this._feedback.gain.value = 0.5;
last.connect(this._feedback).connect(this._delay).connect(first);
console.log(`- feedBack ${this.name}: connected ${last.name} to ${first.name}`);
} // if

this.first = first;
this.last = last;
this.components = components;
} // constructor

set feedback(value) {if (this._feedback) this._feedback.gain.value = clamp(value, -0.998, 0.998);}
set delay (value) {if (this._delay) this._delay.delayTime.value = value;}
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
this.components = components;
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


function wrapWebaudioNode (node) {
const component = new AudioComponent(node.context, node.constructor.name);
component.webaudioNode = node;
component.input.connect(node).connect(component.wet);
return component;
} // wrapWebaudioNode

function parameterNames (node, _exclude = []) {
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
} // parameterNames
