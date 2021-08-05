import {AudioComponent} from "./audioComponent.js";
import {Control, createFields} from "./ui.js";
import {intersection, difference} from "./setops.js";

const parameterMap = new Map();

export function wrapWebaudioNode (node) {
console.debug("wrapping ", node);
const component = new AudioComponent(node.context, node.constructor.name);
component.type = "webaudioNode";
component.webaudioNode = node;

if (node.numberOfInputs > 0) component.input.connect(node);
else component.input = null;

if (node.numberOfOutputs > 0) node.connect(component.wet);
else component.output = null;

if (!component.input && !component.output) component._error("no connections possible; both input and output are null");

// create getters and setters on component which talk to the webaudio node inside
webaudioParameters(node).forEach(p => {
//console.debug("creating descriptor: ", p);
const descriptor = {
enumerable: true,
get () {return _get(p.object, p.name, p.param);},
set (value) {
_set(p.object, p.name, p.param, value);
} // set
}; // descriptor
Object.defineProperty(component, p.name, descriptor);
}); // forEach

// create UI
const ui = new Control(component, component.name);
createFields(
component, ui,
reorder([...AudioComponent.sharedParameterNames, ...webaudioParameters(node).map(p => p.name)]),
node
); // createFields

component.ui = ui;
return component;
} // wrapWebaudioNode

function _get (object, name, param) {
return isAudioParam(param)?
param.value : param;
} // _get

function _set (object, name, param, value) {
//console.debug(`_set: ${object}, ${name}, ${value}`);
if (object && name && param) {
isAudioParam(param)?
param.value  = value : object[name] = value;
} // if
return object;
} // _set


function webaudioParameters (node, _exclude = []) {
const excludedParameterNames = [
"context",
"numberOfInputs", "numberOfOutputs",
"channelCountMode", "channelInterpretation",
"addEventListener", "removeEventListener"
];
let params = [];
const exclude = new Set(_exclude.concat(excludedParameterNames));

for (let name in node) {
params.push({object: node, name, param: node[name]});
} // for

if (node.parameters && node.parameters instanceof AudioParamMap) {
[...node.parameters.keys()].forEach(name => 
params.push({name, object: node.parameters, param: node.parameters[name]}));
} // if

return params
.filter(p => !exclude.has(p.name))
.filter(p => isParameter(p.param))
} // webaudioParameters

function isParameter (param) {
return isFunction(param) || isAudioParamMap(param)? false
: (
isAudioParam(param)
|| isNumber(param)
|| isString(param)
);
} // isParameter



function reorder (_names) {
const ordering = new Set([
...AudioComponent.sharedParameterNames,
"type", "frequency", "Q",
"positionX", "positionY", "positionZ", "radius", "angle",
"orientationX", "orientationY", "orientationZ",
"gain",
"delayTime", "feedback"
]); // ordering

const names = new Set(_names);
return [...intersection(names, ordering), ...difference(names, ordering)];
} // reorder

export function isAudioParam (param) {return param && param instanceof AudioParam;}
export function isAudioParamMap (m) {return m && m instanceof AudioParamMap;}
export function isFunction (f) {return f && f instanceof Function;}
export function isNumber (n) {return typeof(n) === "number" || n instanceof Number;}
export function isString (s) {return typeof(s) === "string" || s instanceof String;}
