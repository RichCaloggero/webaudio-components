class Buffer {
constructor (length) {
this.length =length;
this.data = new Float32Array(this.length);
this.index = 0;
this.value = 0.0;
this._tapCount = 1;
} // constructor

write (sample) {
//console.debug("writing ", sample, this.index);
this.data[this.index] = sample;
this.index += 1;
if (this.index >= this.length) this.index = 0;
//console.debug("- index = ", this.index);
} // write

read (delay) {
if (delay >= 0 && delay < this.length) {
let i = this.index - delay;
if (i < 0) i += this.length;
this.value = this.data[Math.floor(i)];
} // if

return this.value;
} // read

readByTime (delay) {return this.read(delay * sampleRate);}
} // class Buffer


class Delay extends AudioWorkletProcessor {
static interpolationTypes = ["none", "linear", "cubic"];

static get parameterDescriptors() {
return [{
name: "delay",
defaultValue: 0.0,
minValue: 0.0,
maxValue: 1.0, // 1 second
automationRate: "k-rate"
}, {
name: "feedback",
defaultValue: 0.0,
minValue: -0.98,
maxValue: 0.98,
automationRate: "k-rate"
}, {
name: "taps",
defaultValue: 1,
minValue: 1,
maxValue: 20,
automationRate: "k-rate"
}, {
name: "enablePingPong",
defaultValue: 0,
minValue: 0,
maxValue: 1,
automationRate: "k-rate"
}, {
name: "gain",
defaultValue: 1.0,
minValue: 0.0,
maxValue: 2.0,
automationRate: "k-rate"
}, {
name: "interpolationType",
defaultValue: 0.0,
minValue: 0,
maxValue: 2,
automationRate: "k-rate"
}];
} // get parameterDescriptors

constructor (options) {
super (options);
this.allocate(sampleRate);
this.delay = -1;
this.blockCount = 0;
this.sampleCount = 0;
console.debug(`delay.worklet ready.`);
} // constructor

process (inputs, outputs, parameters) {
const delayTime = parameters.delay[0];
const delay = Math.floor(delayTime * sampleRate);
const tapCount = parameters.taps[0];

const gain = parameters.gain[0];
const feedback = parameters.feedback[0];
const enablePingPong = parameters.enablePingPong[0];

const inputBuffer = inputs[0];
const outputBuffer = outputs[0];
const channelCount = inputBuffer.length;
if (channelCount !== 2) return true;

this.blockCount += 1;
if (delay * tapCount > this.delayLeft.length) {
this.allocate(tapCount * delay + 1);
} // if

let swapChannels= true;
for (let i=0; i<inputBuffer[0].length; i++) {
const inLeft = inputBuffer[0][i];
const inRight = inputBuffer[1][i];
this.sampleCount += 1;
//console.debug("- input: ", inLeft, inRight, swapChannels);

let delayLeft = 0, delayRight = 0;
let _gain = 2/tapCount;
for (let j=0; j<tapCount; j++) {
const gain = 1 / Math.pow(2, j);
const dl = this.delayLeft.read(j+1 * delay);
const dr = this.delayRight.read(j+1 * delay);

if (j%2 === 0) {
delayLeft += -1 * gain *dr;
delayRight += -1 * gain * dl;
} else {
delayLeft += gain * dl ;
delayRight += gain * dr;
} // if
} // loop over tapCount
//console.debug("- delayed: ", delayLeft, delayRight);

this.delayLeft.write(inLeft + feedback*delayLeft);
this.delayRight.write(inRight + feedback*delayRight);

outputBuffer[0][i] = 0.5*gain*delayLeft;
outputBuffer[1][i] = 0.5*gain*delayRight;

/*if (sampleCount > 10) {
console.debug("- stop at ", sampleCount, "; buffers: ", this.delayLeft, this.delayRight);
throw new Error("stop.");
} // if
*/
} // loop over samples

return true;
} // process

allocate (length) {
this.delayLeft = new Buffer(length);
this.delayRight = new Buffer(length);
} // allocate

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

