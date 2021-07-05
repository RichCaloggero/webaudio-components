let loopCount = null;
//const debug = typeof(loopCount) === "number";
const debug = true;
let done = false;

class Xtc extends AudioWorkletProcessor {
static get parameterDescriptors() {
return [{
name: "delay",
defaultValue: 0.0,
minValue: 0.0,
maxValue: sampleRate, // 1 second
automationRate: "k-rate"
}, {
name: "gain",
defaultValue: 1.0,
minValue: -1.0,
maxValue: 1.0,
automationRate: "k-rate"
}, {
name: "reverseStereo",
defaultValue: 0,
minValue: 0,
maxValue: 1,
automationRate: "k-rate"
}, {
name: "feedback",
defaultValue: 0.0,
minValue: -0.98,
maxValue: 0.98,
automationRate: "k-rate"
}];
} // get parameterDescriptors

constructor (options) {
super (options);
this.initializeDelayBuffer();
this.blockCount = 0;
console.debug(`xtc.worklet ready.`);
} // constructor

process (inputs, outputs, parameters) {
this.blockCount += 1;
const samples = parameters.delay[0] * sampleRate;
const delay = Math.floor(samples);
const dx = samples - delay;

const gain = parameters.gain[0];
const reverseStereo = parameters.reverseStereo[0];
const feedback = parameters.feedback[0];
const inputBuffer = inputs[0];
const outputBuffer = outputs[0];
const channelCount = inputBuffer.length;
//console.debug("reverse: ", reverseStereo, chan(0));
//return false;

if (channelCount > 2) {
console.error("channel count must be <= 2");
return false;
} // if

if (delay > 0 && delay !== this.delay) {
console.debug(`dx: ${dx}`);
this.delay = this.allocate(delay);
console.debug(`allocated ${this.delay}, lengths are ${this.bufferLength(0)} and ${this.bufferLength(1)}`);
} else if (delay === 0 && this.delayBuffer[0] !== null) {
this.initializeDelayBuffer();
if (debug) console.debug("deallocated buffers");
} // if

if (channelCount > 0) {
//if (debug) console.debug(`frame ${this.blockCount++}, delay ${delay}, ${this.delay}, ${delayLength}`);

for (let channel = 0; channel < channelCount; channel++) {
const sampleCount = inputBuffer[channel].length;

for (let i=0; i<sampleCount; i++) {
/*if (debug && loopCount <= 0) {
console.debug("Done .");
done = true;
return false;
} // if
if (debug) loopCount -= 1;
*/

const sample = inputBuffer[channel][i];

if (delay === 0) {
writeOutputSample(channel, i, gain * sample);

} else {
const delayedSample = this.bufferLength(channel) === this.delay? lerp(this.readBuffer(channel), sample, dx) : 0;
//if (debug) console.debug(`read sample ${i}, length is ${this.bufferLength(channel)}`);
this.writeBuffer(channel, sample + feedback*delayedSample);
//if (debug) console.debug(`wrote sample ${i}, length ${this.bufferLength(channel)}`);

writeOutputSample(channel, i, 0.5 * gain * (sample + delayedSample));
} // if

} // loop over samples

//throw new Error("done for now");
} // loop over channels
} // if channelCount > 0

return true;

function writeOutputSample (channel, i, value) {
outputBuffer[chan(channel)][i] = value;
} // writeOutput

function chan (n) {
return reverseStereo === 0? n : oppositChannel(n);
} // chan


} // process

initializeDelayBuffer () {
this.delayBuffer = [null, null];
this.readIndex = [0, 0];
this.writeIndex = [0, 0];
this._bufferLength = [0,0];
this.delay = 0;
} // initializeDelayBuffer

readBuffer (channel) {
// returns 0 until delay line is full, or if delay time is set to 0
if (this.delay === 0 || this.bufferLength(channel) < this.delay) return 0.0;

const sample = this.delayBuffer[channel][this.readIndex[channel]];
//if (debug) console.debug(`- - got ${sample} at ${this.readIndex[channel]}`);
this.readIndex[channel] = (this.readIndex[channel] + 1) % this.delay;
this._bufferLength[channel] -= 1;
return sample;
} // readBuffer

writeBuffer (channel, sample) {
if (this.delay > 0 && this.bufferLength(channel) < this.delay) {
this.delayBuffer[channel][this.writeIndex[channel]] = sample;
//console.debug(`- wrote ${sample} at ${this.writeIndex[channel]}`);
this.writeIndex[channel] = (this.writeIndex[channel] + 1) % this.delay;
this._bufferLength[channel] += 1;
} else if (this.delay > 0 && this.bufferLength(channel) === this.delay) {
console.error("buffer overrun...");
} // if
} // writeBuffer

bufferLength (channel) {
return this._bufferLength[channel];
} // bufferLength

allocate (count) {
done = false;
if (debug) console.debug(`allocating ${count}, bufferLengths are ${this.bufferLength(0)} and ${this.bufferLength(1)}`);
for (let channel=0; channel<2; channel++) {
const buffer = new Float32Array(count);

if (this.delayBuffer[channel] !== null) {
// copy from old buffer
const length = Math.min(count, this.bufferLength(channel));
if (debug) console.debug(`- copying ${length} for channel ${channel}, bufferLength is ${this.bufferLength(channel)}`);

for (let i=0; i < length; i++) {
buffer[i] = this.delayBuffer[channel][this.readIndex[channel]++ % this._bufferLength[channel]];
} // for
if (debug) console.debug(`- copy done, bufferLength is ${this.bufferLength(channel)}`);

this.readIndex[channel] = 0;
this.writeIndex[channel] = length;
this._bufferLength[channel] = length;

} else {
this.readIndex[channel] = this.writeIndex[channel] = 0;
this._bufferLength[channel] = 0;
if (debug) console.debug("- no copy...");
} // if

this.delayBuffer[channel] = buffer;
} // loop over channels

if (debug) console.debug(`allocation complete; lengths are ${this.bufferLength(0)} and ${this.bufferLength(1)}`);
return count;
} // allocate


} // class xtc

registerProcessor("xtc", Xtc);


/// helpers



function oppositChannel (n) {
return n === 0? 1 : 0;
} // oppositChannel

function lerp (x, y, a) {return x * (1 - a) + y * a;}
function clamp (a, min = 0, max = 1) {return Math.min(max, Math.max(min, a));}
function invlerp (x, y, a) {return clamp((a - x) / (y - x));}
function range (x1, y1, x2, y2, a) {return lerp(x2, y2, invlerp(x1, y1, a));}
