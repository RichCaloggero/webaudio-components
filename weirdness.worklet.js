let loopCount = 10;
const scaleFactor = 2 / Math.pow(2, 24);

class Weirdness extends AudioWorkletProcessor {
static get parameterDescriptors() {
return [{
name: "gain",
defaultValue: 0.25,
minValue: 0,
maxValue: 1,
automationRate: "k-rate"
}, {
name: "lerp", // 0 = all values, 1 = only odd, 2 = only even
defaultValue: 0,
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
this.value = null;
this.blockCount = 0;

this.port.onmessage = e => {
const data = e.data;
const name = data[0];
const value = data[1];
this[name] = value;
}; // onMessage

console.log("weirdness.worklet initialized...");
} // constructor

get seed () {return this._seed;}
set seed (value) {
this._seed = value.slice(0);
this.newSeed = true;
this.process = value.length === 1? this.sequential : this.parallel;

//console.debug("setting seed to ", this._seed);
} // set seed

/*process (inputs, outputs, parameters) {
return this.seed.length === 1?
this.sequential(inputs, outputs, parameters)
: this.parallel(inputs, outputs, parameters);
} // process
*/

sequential (inputs, outputs, parameters) {
const gain = parameters.gain[0];
let seed = 0;
const outputBuffer = outputs[0];

if (this.newSeed) {
this.newSeed = false;
seed = this.seed[0];
} // if
if (seed === 0) return true;

this.value = seed;
for (let i=0; i<128; i++) {
outputBuffer[i] = scale(this.value, scaleFactor);
this.value = nextValue(this.value);
//console.debug(i, this.value);
//if (loopCount-- <= 0) return false;
} // for

return true;

function nextValue (n) {
let value = calculate(n);
if (value === 1) value = seed; //value = randomInteger(5, 2**24);
return value;
} // nextValue


function scale (value, f) {return gain * ((f * value) - 1);}
} // sequential


parallel (inputs, outputs, parameters) {
const gain = parameters.gain[0];
const interpolate = parameters.lerp[0] !== 0;
const filter = parameters.filter[0];
const testValue = filter === 0? identity 
: (filter === 1? isOdd : isEven);

const seedLength = this._seed.length;

if (this.newSeed) {
this.newSeed = false;

if (seedLength %2 !== 0) {
console.error("seed length must be power of 2; aborting...");
return false;
} // if

if (interpolate && seedLength > 64) {
console.error ("64 max length when interpolate is true");
return false;
} // if

console.debug("seed length: ", seedLength, " interpolate: ", interpolate, " filter: ", testValue);
this.buffer = calculateValues(this._seed, this._seed);
} // if

if (seedLength === 0) return true;
const outputBuffer = outputs[0];
const count = interpolate? 128 / seedLength * 2 : 128 / seedLength;
this.blockCount += 1;

let index = 0;
for (let i=0; i <= count; i += 1) {
const lastValues = this.buffer.slice(0);
write(scale(this.buffer, scaleFactor), outputBuffer[0], index);
this.buffer = calculateValues(this.buffer, this._seed);
if (interpolate) write(scale(interpolateValues(lastValues, this.buffer), scaleFactor), outputBuffer[0], index);

index += seedLength;
//if (loopCount-- <= 0) return false;
} // loop

return true;

function interpolateValues (last, current, interpolator = lerp) {
return last.map((last, i) => 
Math.floor(interpolator(last, current[i], 0.5))
); // map
} // interpolateValues

function calculateValues (current, initial) {
return current.map((n, i) => {
return nextValue(testValue, initial[i], n);
}); // map
} // calculateValues

function write (values, buffer, index) {
//console.debug("writing ", index, values);
values.forEach(value => buffer[index++] = value);
return index;
} // write


function nextValue (filter, start, n) {
let value;
do {
value = calculate(n);
value = value === 1? start : value;
} while (!filter(value));

return value;
} // nextValue

function scale (values, f) {return values.map(value => gain * ((f * value) - 1));}
} // parallel
} // class Weirdness

registerProcessor("weirdness", Weirdness);

/// helpers


function calculate (n) {
return isEven(n)? n/2 : 3*n+1;
} // calculate


function identity (n) {return n;}
function isEven (n) {return n%2 === 0;}
function isOdd (n) {return !isEven(n);}

function lerp (x, y, a) {return x * (1 - a) + y * a;}
function clamp (a, min = 0, max = 1) {return Math.min(max, Math.max(min, a));}
function invlerp (x, y, a) {return clamp((a - x) / (y - x));}
function range (x1, y1, x2, y2, a) {return lerp(x2, y2, invlerp(x1, y1, a));}

function randomInteger (min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);

return Math.floor(
(max - min) * Math.random() + min
);
} // randomInteger
