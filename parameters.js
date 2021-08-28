import {AudioComponent} from "./audioComponent.js";
import {Control, createFields} from "./ui.js";
import {intersection, difference} from "./setops.js";
import {publish} from "./observer.js";

const parameterMap = new Map();

export function wrapWebaudioNode (node, options = {}) {
//console.debug("wrapping ", node);
let component = new AudioComponent(node.context, node.constructor.name);
component.type = "webaudioNode";
component.webaudioNode = node;

if (node.numberOfInputs > 0) component.input.connect(node);
else component.input = null;

if (node.numberOfOutputs > 0) node.connect(component.wet);
else component.output = null;

if (!component.input && !component.output) component._error("no connections possible; both input and output are null");

// create getters and setters on component which talk to the webaudio node inside
//debugger;
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

if (options.publish) component = publish(component);

// create UI
if (options.doNotCreateUi) return component;

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


export function webaudioParameters (node, _exclude = []) {
const excludedParameterNames = [
"context", "port", "parameters",
"numberOfInputs", "numberOfOutputs",
"channelCountMode", "channelInterpretation",
"addEventListener", "removeEventListener"
];
const exclude = new Set(_exclude.concat(excludedParameterNames));

const allProps = allProperties(node).filter(p => !exclude.has(p));
const allMapped = (node.parameters && node.parameters instanceof AudioParamMap)? [...node.parameters.keys()] : [];
const params = validParameters(node, allProps, allMapped);
//console.debug("webaudioParameters: ", params);
return params;

function validParameters (node, all, mapped) {
const params = all.map(name => ({name, object: node, param: node[name]}))
.concat(mapped.map(name => ({name, object: node.parameters, param: node.parameters.get(name)})))
.filter(p => !exclude.has(p.name))
.filter(p => isParameter(p.param));

if (mapped && mapped.length > 0) console.debug("validParameters: ", params);
return params;
} // validParameters
} // webaudioParameters

function allProperties (node) {
let props = [];
for (let name in node) {
props.push(name);
} // for
return props;
} // allProperties


function isParameter (param) {
return isFunction(param) || isAudioParamMap(param)? false
: (
isAudioParam(param)
|| isNumber(param)
|| isString(param)
);
} // isParameter



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

export function isAudioParam (param) {return param && param instanceof AudioParam;}
export function isAudioParamMap (m) {return m && m instanceof AudioParamMap;}
export function isFunction (f) {return f && f instanceof Function;}
export function isNumber (n) {return typeof(n) === "number" || n instanceof Number;}
export function isString (s) {return typeof(s) === "string" || s instanceof String;}
