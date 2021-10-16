import {AudioComponent} from "./audioComponent.js";
import {Control, createFields} from "./ui.js";
import {intersection, difference} from "./setops.js";

const parameterMap = new Map();
const ignoreList = new Set([
"name", "id",
"numberOfInputs", "numberOfOutputs",
"channelCountMode", "channelInterpretation",
]);

export function createUi (component) {
if (isAudioNode(component)) component = wrapAudioNode(component);
return buildUi(component);
} // createUi 

function wrapAudioNode (node, name, options = {}) {
//console.debug("wrapping ", node);
// build component around node
const component = new AudioComponent(node.context, name || node.constructor.name);
component.type = "AudioNode";
component.audioNode = node;

if (node.numberOfInputs > 0) component.input.connect(node);
else component.input = null;

if (node.numberOfOutputs > 0) node.connect(component.wet);
else component.output = null;

if (!component.input && !component.output) component._error("no connections possible; both input and output are null");

// create getters and setters on component which talk to the webaudio node inside
promoteParameters(component, node);
return component;

} // wrapAudioNode

function buildUi (component) {
console.debug("buildUi: ", component);
debugger;

const ui = new Control(component, component.name);

createFields(
component, ui,
[...AudioComponent.sharedParameterNames, ...filterIgnored(allParameterNames(component))]
); // createFields

component.ui = ui;
return component;
} // wrapWebaudioNode

function promoteParameters (component, node) {
allParameters(node).forEach(p => {
const [name, value] = p;
if (isAudioParam(value)) component[name] = value;
else Object.defineProperty(component, name, createDescriptor(node, name));
}); // forEach
return component;
} // promoteParameters

function createDescriptor (node, name) {
return {
enumerable: true,
get () {return node[name];},
set (value) {node[name] = value;}
}; // descriptor
} // createDescriptor

function allParameterNames (node) {
return allParameters(node).map(p => p[0]);
} // allParameterNames

function allParameters (node) {
let parameters = [];
for (let name in node) {
const p = node[name];
if (validParameter(p)) {
if (isAudioParamMap(p))
parameters = parameters.concat([...p.entries()]);
else parameters.push([name, p]);
} // if
} // for

if (node instanceof AudioComponent) parameters = parameters.concat(allParameters(Reflect.getPrototypeOf(node)));

return parameters;
} // allParameters

function validParameter (p) {
return (
isBoolean(p) || isNumber(p) || isString(p)
|| isArray(p)
|| isAudioParam(p) || isAudioParamMap(p)
);
} // validParameter


export function reorder (_names) {
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

function filterIgnored (list) {
return list.filter(x => not(isPrivate(x)))
.filter(x => not(ignoreList.has(x)));
} // ignore
 
export function isAudioNode (node) {return node instanceof AudioNode;}
export function isAudioWorkletNode (node) {return node instanceof AudioWorkletNode;}
export function isAudioParam (param) {return param instanceof AudioParam;}
export function isAudioParamMap (m) {return m instanceof AudioParamMap;}
export function isFunction (f) {return f instanceof Function;}
export function isNumber (n) {return typeof(n) === "number" || n instanceof Number;}
export function isString (s) {return typeof(s) === "string" || s instanceof String;}
export function isBoolean (x) {return typeof(x) === "boolean";}
export function isArray (a) {return a instanceof Array;}
export function isPrivate (name) {return isString(name) && name.startsWith("_");}
export function not (x) {return !!!x;}
