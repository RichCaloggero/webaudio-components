class MidSide extends AudioWorkletProcessor {
static get parameterDescriptors() {
return [{
name: "midGain",
defaultValue: 1.0,
minValue: -1.0,
maxValue: 1.0, // 1 second
automationRate: "k-rate"
}, {
name: "sideGain",
defaultValue: 1.0,
minValue: -1.0,
maxValue: 1.0, // 1 second
automationRate: "k-rate"
}];
} // get parameterDescriptors

constructor () {
super ();
console.debug(`midSide.worklet ready.`);
} // constructor

process (inputs, outputs, parameters) {
const midGain = parameters.midGain[0];
const sideGain = parameters.sideGain[0];

const inputBuffer = inputs[0];
const outputBuffer = outputs[0];
const channelCount = inputBuffer.length;


if (channelCount !== 2) return true;

const sampleCount = inputBuffer[0].length;

for (let i=0; i<sampleCount; i++) {
[outputBuffer[0][i], outputBuffer[1][i]]
= decode(...encode(inputBuffer[0][i], inputBuffer[1][i], midGain, sideGain));
//= [inputBuffer[0][i], inputBuffer[1][i]];
} // loop over samples
return true;

function encode (left, right, midGain, sideGain) {
const mid = 0.5 * (left + right);
const side = (right - left);

return [midGain*mid, sideGain*side];
} // encode

function decode (mid, side) {
const left = mid - side;
const right = mid + side;
return [left, right];
} // decode
} // process
} // class MidSide

registerProcessor("midSide", MidSide);
