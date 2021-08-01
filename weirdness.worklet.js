let loopCount = 10;
const scaleFactor = 2 / Math.pow(2, 24);

class Weirdness extends AudioWorkletProcessor {
static get parameterDescriptors() {
return [{
name: "gain",
defaultValue: 0.5,
minValue: 0,
maxValue: 1,
automationRate: "k-rate"
}, {
name: "filter", // 0 = all values, 1 = only odd, 2 = only even
defaultValue: 0, // all
minValue: 0,
maxValue: 2,
automationRate: "k-rate"
}];
} // get parameterDescriptors

constructor () {
super ();
this._seed = [];
this.newSeed = false;
this.buffer = null;
this.blockCount = 0;

this.port.onmessage = e => {
const data = e.data;
const name = data[0];
const value = data[1];
this[name] = value;
}; // onMessage

console.log("weirdness.worklet initialized...");
} // constructor

set seed (value) {
this._seed = value.slice(0);
this.newSeed = true;
//console.debug("setting seed to ", this._seed);
} // set seed

process (inputs, outputs, parameters) {
//if (loopCount-- <= 0) return false;
const gain = parameters.gain[0];
const _filter = parameters.filter[0];
const seedLength = this._seed.length;

if (this.newSeed) {
this.newSeed = false;
this.buffer = this._seed.slice(0);
console.log("new seed set to ", this.buffer);
if (seedLength %2 !== 0) {
console.error("seed length must be power of 2; aborting...");
return false;
} // if
} // if

if (seedLength === 0) return true;
const outputBuffer = outputs[0];
const count = outputBuffer.length / seedLength;
this.blockCount += 1;

for (let i=0; i <= count; i++) {
this.buffer = calculate (this.buffer);
if (this.buffer.every(value => value === 0)) {
console.log(`Stopped at block ${this.blockCount}, itteration ${i}.`);
return false;
} // if

write(scale(this.buffer, scaleFactor), outputBuffer[0], i);
} // loop

return true;

function calculate (values) {
return values.map(value => {
let newValue = value;
do {
newValue = clamp(
newValue % 2 === 0? newValue/2 : 3*newValue+1,
0, 2**24
) // clamp
newValue = newValue === 1? Math.random() * (2**24-1) : newValue;
} while(!filter(newValue, _filter));

return newValue;
}); // map
} // calculate

function filter (value, _filter) {
if (_filter === 0) return true;
return value%2 === 0? _filter === 2 : _filter === 1;
} // filter

function write (values, buffer, index) {
//console.log("writing ", index, values);
values.forEach(value => buffer[index++] = value);
} // write

function scale (values, f) {return values.map(value => gain * ((f * value) - 1));}

} // process
} // class xtc

registerProcessor("weirdness", Weirdness);


/// helpers


function lerp (x, y, a) {return x * (1 - a) + y * a;}
function clamp (a, min = 0, max = 1) {return Math.min(max, Math.max(min, a));}
function invlerp (x, y, a) {return clamp((a - x) / (y - x));}
function range (x1, y1, x2, y2, a) {return lerp(x2, y2, invlerp(x1, y1, a));}

function cubic (x, p) {
		return p[1] + 0.5 * x*(p[2] - p[0] + x*(2.0*p[0] - 5.0*p[1] + 4.0*p[2] - p[3] + x*(3.0*(p[1] - p[2]) + p[3] - p[0])));
	} // cubic

