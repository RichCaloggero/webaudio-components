class Delay extends AudioWorkletProcessor {
static interpolationTypes = ["none", "linear", "cubic"];

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
name: "interpolationType",
defaultValue: 0.0,
minValue: 0,
maxValue: 2,
automationRate: "k-rate"
}, {
name: "feedback",
defaultValue: 0.0,
minValue: -0.98,
maxValue: 0.98,
automationRate: "k-rate"
}, {
name: "reverse",
defaultValue: 0.0,
minValue: 0,
maxValue: 1,
automationRate: "k-rate"
}];
} // get parameterDescriptors

constructor (options) {
super (options);
this.initializeDelayBuffer();
this.blockCount = 0;
console.debug(`delay.worklet ready.`);
} // constructor

process (inputs, outputs, parameters) {
const samples = parameters.delay[0] * sampleRate;
const delay = Math.floor(samples);
const dx = samples - delay;

const reverse = parameters.reverse[0] !== 0;
const gain = parameters.gain[0];
const feedback = parameters.feedback[0];
const interpolationType = toInteger(parameters.interpolationType[0]);
this.interpolationEnabled = interpolationType !== 0;

const inputBuffer = inputs[0];
const outputBuffer = outputs[0];
const channelCount = inputBuffer.length;

if (channelCount !== 2) return true;

this.blockCount += 1;
if (delay === 0 && this.delayBuffer[0] !== null) {
this.initializeDelayBuffer();
//console.debug("deallocated buffers");

} else if (delay > 0 && delay !== this.delay) {
//console.debug(`dx: ${dx}`);
this.delay = this.allocate(delay);
//console.debug(`allocated ${this.delay}, lengths are ${this.bufferLength(0)} and ${this.bufferLength(1)}`);
} // if

//console.debug(`frame ${this.blockCount++}, delay ${delay}, ${this.delay}, ${delayLength}`);

for (let channel = 0; channel < channelCount; channel++) {
const sampleCount = inputBuffer[channel].length;
let pingpong = 0;

for (let i=0; i<sampleCount; i++) {
const sample = inputBuffer[channel][i];
if (i % delay === 0) pingpong += 1;

if (delay === 0) {
writeOutputSample(channel, i, gain * sample);

} else {
const delayedSample = this.getDelayedSample(channel, dx, sample);
//console.debug(`read sample ${i}, length is ${this.bufferLength(channel)}`);
this.writeBuffer(
//reverse && isOdd(i)? oppositChannel(channel) : channel,
channel,
sample + feedback*delayedSample
);
//console.debug(`wrote sample ${i}, length ${this.bufferLength(channel)}`);

writeOutputSample(isOdd(pingpong) && reverse? oppositChannel(channel) : channel, i, 0.5*gain*delayedSample);
} // if

} // loop over samples
} // loop over channels
return true;

function writeOutputSample (channel, i, value) {
outputBuffer[channel][i] = value;
} // writeOutputSample

function chan (n) {return reverse? oppositChannel(n) : n;}
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
if (this.delay === 0 || this.isFull(channel)) return 0.0;

const sample = this.delayBuffer[channel][this.readIndex[channel]];
//console.debug(`- - got ${sample} at ${this.readIndex[channel]}`);
this.readIndex[channel] = (this.readIndex[channel] + 1) % this.delay;
this._bufferLength[channel] -= 1;
return sample;
} // readBuffer

writeBuffer (channel, sample) {
if (this.delay === 0) return;
if (this.isFull(channel)) throw new Error(`
buffer overrun in delay.worklet:
${channel}, ${this.bufferLength(channel)}, ${this.readIndex}, ${this.writeIndex}
`);

this.delayBuffer[channel][this.writeIndex[channel]] = sample;
//console.debug(`- wrote ${sample} at ${this.writeIndex[channel]}`);
this.writeIndex[channel] = (this.writeIndex[channel] + 1) % this.delay;
this._bufferLength[channel] += 1;
} // writeBuffer

copyBuffer (from, index, to, count) {
for (let i = 0; i < count; i++) {
to[i] = from[index];
index = (index+1) % this.delay;
} // for

return to;
} // copyBuffer



allocate (count) {
//console.debug(`allocating ${count}, bufferLengths are ${this.bufferLength(0)} and ${this.bufferLength(1)}`);
for (let channel=0; channel<2; channel++) {
const buffer = new Float32Array(count);

if (this.delayBuffer[channel] !== null) {
// copy from old buffer
const length = Math.min(count, this.bufferLength(channel));
//console.debug(`- copying ${length} for channel ${channel}, bufferLength is ${this.bufferLength(channel)}`);

for (let i=0; i<length; i++) buffer[channel][i] = this.readBuffer(channel);

this.readIndex[channel] = 0;
this.writeIndex[channel] = length;
this._bufferLength[channel] = length;
//console.debug(`- copy done, bufferLength is ${this.bufferLength(channel)}`);

} else {
this.readIndex[channel] = this.writeIndex[channel] = 0;
this._bufferLength[channel] = 0;
//console.debug("- no copy...");
} // if

this.delayBuffer[channel] = buffer;
} // loop over channels

//console.debug(`allocation complete; lengths are ${this.bufferLength(0)} and ${this.bufferLength(1)}`);
return count;
} // allocate

bufferLength (channel) {
return this._bufferLength[channel];
} // bufferLength

isFull (channel) {return this.bufferLength(channel) > 0 && this.readIndex[channel] === this.writeIndex[channel];}

getDelayedSample (channel, dx, sample) {
if (this.delay === 0) return 0;
if (this.interpolationEnabled) {
return this.bufferLength(channel) < 3? this.getDelayedSample_linear(channel, dx, sample) : this.getDelayedSample_cubic(channel, dx, sample);
} else {
return this.readBuffer(channel);
} // if
} // getDelayedSample

getDelayedSample_linear (channel, dx, sample) {
return lerp(this.readBuffer(channel), sample, dx);
} // getDelayedSample_linear

getDelayedSample_cubic (channel, dx, sample) {
const p = [sample, this.readBuffer(channel), ...this.copyDelayBuffer(channel, 2)];


//throw new Error(`done with index ${this.readIndex[channel]}`);
return cubic(dx, p);
} // getDelayedSample_cubic
} // class Delay

registerProcessor("delay", Delay);


/// helpers


function oppositChannel (n) {return n === 0? 1 : 0;} // oppositChannel

function lerp (x, y, a) {return x * (1 - a) + y * a;}
function clamp (a, min = 0, max = 1) {return Math.min(max, Math.max(min, a));}
function invlerp (x, y, a) {return clamp((a - x) / (y - x));}
function range (x1, y1, x2, y2, a) {return lerp(x2, y2, invlerp(x1, y1, a));}

function cubic (x, p) {
		return p[1] + 0.5 * x*(p[2] - p[0] + x*(2.0*p[0] - 5.0*p[1] + 4.0*p[2] - p[3] + x*(3.0*(p[1] - p[2]) + p[3] - p[0])));
	} // cubic

function toInteger (x) {return x>0? Math.floor(x) : Math.ceil(x);}

function isEven (n) {n%2 === 0;}
function isOdd (n) {return !isEven(n);}
