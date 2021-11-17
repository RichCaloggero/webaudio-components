export let audioContext = new AudioContext();

await audioContext.resume();
await audioContext.audioWorklet.addModule("./xtc.worklet.js");
console.log("audioWorklet.xtc created.");
console.debug("audioContext: sample rate is ", audioContext.sampleRate);

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
channelCount: {min: 1, max: 2, step: 1},
rolloffFactor: {min: 0, step: 0.1},
gain: {step: 0.02},
delay: {step: 0.00001}
}; // constraints

constructor (audio, name, parent = null) {
//console.debug("audioComponent: instantiating ", name);
this._type = "component";
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

descriptor(name, node = this.audioNode) {
return {
enumerable: true,
get: function () {return node[name];},
set: function (value) {node[name] = value;}
};
} // descriptor

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
this.__bypass.disconnect();
this.dry.connect(this.output);
this.wet.connect(this.output);
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
this._pre = audio.createBiquadFilter();
this._post = audio.createBiquadFilter();
this.audioNode = new AudioWorkletNode(audio, "xtc", {outputChannelCount: [2]});
this._filterGainTypes = ["lowshelf", "highshelf", "peaking"];

this.input
.connect(this._pre)
.connect(this.audioNode)
.connect(this._post)
.connect(this.wet);

// we can avoid getters and setters by copying AudioParam objects directly to this object's instance
this.delay = this.audioNode.parameters.get("delay");
this.feedback = this.audioNode.parameters.get("feedback");

this.preFrequency = this._pre.frequency;
this.preQ = this._pre.Q;
this.preGain = this._pre.gain;

this.postFrequency = this._post.frequency;
this.postQ = this._post.Q;
this.postGain = this._post.gain;

// these must be getter/setter pairs
Object.defineProperties(this, {
preType: this.descriptor("type", this._pre),
postType: this.descriptor("type", this._post),
}); // defineProperties
} // constructor
} // class Xtc

export class Player extends AudioComponent {
constructor (audio) {
super (audio, "player");
Object.defineProperties(this, {
bypass: {},
silentBypass: {},
mix: {}
});

this.input = null;
this._audioElement = document.createElement("audio");
this._audioElement.setAttribute("crossorigin", "anonymous");

Object.defineProperties(this, {
_hasMediaElement : {enumerable: true,
get: function () {return this.source instanceof MediaElementAudioSourceNode;}
}, // _hasMediaElement


media: {enumerable: true,
get: function () {return this._hasMediaElement? this._audioElement.src : "";},
set: function (media) {
if (media) {
this.source?.disconnect();
this.source = null;

if (media instanceof AudioBuffer) {
this.source = audio.createBufferSource(media);

} else {
this.source = audio.createMediaElementSource(this._audioElement);
this._audioElement.src = media;
} // if

this.source.connect(this.output);
} // if
} // set
}, // media

play: {enumerable: true,
get: function () {return this._hasMediaElement && this.media && !this._audioElement.ended && !this._audioElement.paused;},
set: function (value) {if (this._hasMediaElement && !this._audioElement.ended) value? this._play() : this._pause();}
}, // play

position: {
enumerable: true,
get: function () {return this._hasMediaElement? this._audioElement.currentTime : 0;},
set: function (value) {if (this._hasMediaElement) this._audioElement.currentTime = clamp(value, 0, this._audioElement.duration);}
} // position
}); // defineProperties
} // constructor

_play () {if (this._hasMediaElement) this._audioElement.play();}
_pause () {if (this._hasMediaElement) this._audioElement.pause();}

} // class Player

export class Destination extends AudioComponent {
constructor (audio) {
super (audio, "destination");
this.output = null;
this.webaudioNode = audio.destination;
this.input.connect(this.webaudioNode);
}; // constructor
} // class Destination

export class DelayNode extends AudioComponent {
constructor (audio) {
super (audio, "delay");

this._in = audio.createGain();
this._out = audio.createGain();
this.audioNode = audio.createDelay();
this._feedBack = audio.createGain();

this.input.connect(this._in).connect(this.audioNode).connect(this._out).connect(this.wet);
this._out.connect(this._feedBack).connect(this._in);
} // constructor

get delay () {return this.audioNode.delayTime.value;}
get feedBack() {return this._feedBack.gain.value;}

set delay (value) {
this.bypass = (Math.abs(value) < 0.00001);
this.audioNode.delayTime.value = value;
} // set delayTime

set feedBack(value) {this._feedBack.gain.value = value;}
} // class Delay

export class Split extends AudioComponent {
constructor (audio, components, swapInputs, swapOutputs) {
super (audio, "split");
this._type = "container";
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
this._type = "container";
if (components.length < 2) this._error("need two or more components");

const first = components[0];
const last = components[components.length-1];
if (first === last) this.error("identical components found in sequence; aborting");
this.first = first;
this.last = last;
this.children = this.components = components;


if(first.input) {
this.input.connect(first.input);
console.log(`- connected ${this.name} input to ${first.name}`);
} // if

for (let i=0; i<components.length-1; i++) {
const c = components[i];
const next = components[i+1];

if (c.output && next.input) {
c.output.disconnect();
c.output.connect(next.input);
console.log(`- connected ${c.name} to ${next.name}`);

} else {
this._error(`cannot connect ${c.name} to ${next.name}`);
} // if
} // loop over components

if (last.output) {
last.output.disconnect();
last.output.connect(this.wet);
console.log(`- connected ${last.name} to ${this.name} wet`);
} // if
} // constructor
} // class Series

export class Parallel extends AudioComponent {
constructor (audio, components) {
super (audio, "parallel");
this._type = "container";
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
super (audio, "reverse");
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

