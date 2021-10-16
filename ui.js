import S from "./S.module.js";
import * as jSig from "./jSig.js";
import * as dom from "./dom.js";
import {AudioComponent} from "./audioComponent.js";
import {isNumber, isString, isFunction, isAudioParam, isAudioParamMap} from "./parameters.js";
import {removeBlanks, separateWords} from "./parser.js";
import {compileFunction} from "./automation.js";
//import {storeValue} from "./save-restore.js";
const statusMessageQueue = [];


// this represents an action (button) with no state; it just returns it's input
function Action (value) {return value;}


export class Control {
static dataTypes = new Set([
Action, Number, String, Boolean,
]);

static dataTypeMap = new Map([
["Action", Action],
["String", String],
["Boolean", Boolean],
["Number", Number]
]);


constructor (receiver, label = "") {
if (!receiver) {
alert("Control: need a receiver");
throw new Error("need a receiver");
} // if
this.receiver = receiver;
this.label = label;
this.signals = Object.create(null);
this.container = document.createElement("div");
this.fields = document.createElement("div");
this.fields.className = "fields";
this.children = document.createElement("div");
this.children.className = "children";

this.container.setAttribute("role", "region");
//this.container.setAttribute("aria-roledescription", "component");
this.container.setAttribute("aria-label", label);
this.container.className = `component ${label}`;
this.container.innerHTML = `
<div  class="component-title" role="heading">${label}</div>
`;
this.container.appendChild(this.fields);
this.container.appendChild(this.children);
//this.container.addEventListener("change", createUpdateHandler(this));
} // constructor

getElementByName (name) {
console.debug("getElementByName: ", name);
return (name in this.receiver && this.receiver.hasOwnProperty(name))?
this.container.querySelector(`.fields > .field [data-name=${name}]`)
: null;
} // getElementByName

string ({
name = "",
label = separateWords(name),
defaultValue = "",
dataType = String,
receiver = this.receiver
}) {
const field = createField(receiver, name, dataType, defaultValue,
`<label>
<span class="text">${label}</span>
<input class="control" type="text" value="${defaultValue}" data-name="${name}">
</label>
`);
this.createSignal(name, field, defaultValue);
return field;
} // string

list ({
name = "",
label = separateWords(name),
defaultValue = "",
dataType = String,
receiver = this.receiver
}) {
const field = createField(receiver, name, dataType, defaultValue,
`<label>
<span class="text">${label}</span>
<select data-default="${defaultValue}" data-name="${name}"></select>
</label>
`);
this.createSignal(name, field, defaultValue);
return field;
} // string


action ({
name = "",
label = separateWords(name),
dataType = Action,
defaultValue = null,
receiver = this.receiver
}) {
const field = createField(receiver, name, dataType, defaultValue,
`<button class="control" data-name="${name}">${label}</button>`
); // createField
this.createSignal(name, field, jSig.clickSignal);
return field;
} // action

boolean ({
name = "",
label = separateWords(name),
defaultValue = false,
dataType = Boolean,
receiver = this.receiver
}) {
const field = createField(
receiver, name, dataType, defaultValue,
`<button class="control" data-name="${name}" aria-pressed="${defaultValue? "true" : "false"}">${label}</button>`
);
field.dataset.value = (defaultValue);
this.createSignal(name, field, defaultValue);
return field;
} // boolean

number ({
name = "",
label = separateWords(name),
receiver = this.receiver,
defaultValue = 0.0,
min = 0.0,
max = Number.POSITIVE_INFINITY,
step = 1,
controlType = "range",
dataType = Number,
}) {

if (Math.abs((max-min) / step) > 100) controlType = "number";

const field = createField(receiver, name, dataType, defaultValue,
`<label>
<span class="text">${label}</span>
<input class="control"
type="${controlType}"
data-name="${name}"
value="${dataType(defaultValue)}"
min="${min}" max="${max}" step="${step}">
</label>
`);

this.createSignal(name, field, defaultValue);
return field;
} // number

createSignal (name, field, defaultValue, receiver = this.receiver) {
const creator = defaultValue instanceof Function?
defaultValue : signalCreator(typeof(defaultValue));
const signal = this.signals[name] = creator(dom.fieldToElement(field), defaultValue);
this.connectSignal(name, receiver);
return signal;
} // createSignal

connectSignal (name, receiver = this.receiver) {
const signal = this.signals[name];
S.root(() => {
S(() => {
if (isAudioParam(receiver[name])) receiver[name].value = signal();
else receiver[name] = signal();
});
}); // S.root
} // connectSignal

nameToField (name) {return this.fields.querySelector(`.field[data-name=${name}]`);}
nameToElement (name) {return this.fields.querySelector(`.control[data-name=${name}]`);}
valueOf (name) {return this.signals[name]();}
sample (name) {return S.sample(this.signals[name]);}
setValue (name, value, _update) {
const element = this.nameToElement(name);
element.value = value;
if (_update) update(element);
} // setValue

populateList (name, values) {
const list = this.nameToElement(name);
const entries = values instanceof Array? values : Object.entries(values);
entries.map(entry => {
const option = document.createElement("option");
option.value = entry[0];
option.textContent = entry[1];
return option;
}).forEach(option => list.add(option));
return list;
} // populateList

} // class Control

/// helpers

function createField (receiver, name, dataType, defaultValue, html) {
const field = document.createElement("div");
try {
field.insertAdjacentHTML("afterBegin", html);
} catch (e) {
throw new Error(`createField: invalid markup - ${e}`);
} // catch

field.hidden = true;
field.className = `${dataType.name.toLowerCase()} field ${name}`;
field.dataset.name = name;
field.dataset.dataType = dataType.name;
field.dataset.componentId = receiver._id;
field.dataset.storageKey = dom.keyGen(receiver, name);

return field;
} // createField

/*function createUpdateHandler (ui) {
const {receiver, container} = ui;
if (! receiver) throw new Error("need receiver");
if (! container) throw new Error("need container");
//console.debug("createUpdateHandler: ", receiver.name, container.className);

return e => {
e.stopPropagation();
//e.stopImmediatePropagation();


const element = e.target;
const field = element.closest(".field");
const name = element.dataset.name;
const dataType = Control.dataTypeMap.get(field.dataset.dataType);
let value = getValue(element);

if (dataType === Action) {
receiver[name] = "dummy value";
return;
} else if (nullish(value)) {
return;
} // if

field.dataset.value = getValue(element);


if (receiver[name] instanceof Function) receiver[name].call(receiver, dataType(value));
else updateValue(receiver, name, dataType(value));
}; // function

function updateValue (receiver, property, value) {
//console.debug("updateValue: ", receiver instanceof AudioNode? " AudioNode " : " AudioComponent ", receiver.name || receiver.label, property, value);
if (property instanceof AudioParam) property.value = value;
else if (receiver[property] instanceof AudioParam) receiver[property].value = value;
else receiver[property] = value;
//if (property === "midGain") debugger;
} // updateValue
} // createUpdateHandler
*/


function booleanHelper (element) {
element.addEventListener("click", e => {
setState(e.target, !getState(e.target));
update(e.target);
}); // click handler
} // booleanHelper

export function createFields (component, ui, propertyNames, after = "") {
//console.debug("createFields: ", component, " propertyNames = ", propertyNames);
const container = ui.fields;

const fields = propertyNames.map(name => createField(component, name)).filter(field => field);
//console.debug("createFields: ", fields);

if (after) {
const afterField = after instanceof Number? container.children[after] : after && ui.nameToField(after);

if (afterField instanceof HTMLElement && afterField.matches(".field")) {
fields.reverse().forEach(field => afterField.insertAdjacentElement("afterEnd", field));
} // if

} else {
fields.forEach(field => container.appendChild(field));
} // if

function createField (component, property) {
if (isAudioParam(component[property]) || typeof(component[property]) === "number") {
const constraints = calculateConstraints(component, property);
return ui.number(Object.assign({}, constraints, AudioComponent.constraints[property]));

} else if (typeof(component[property]) === "boolean") {
return (ui.boolean({name: property}));

} else if (typeof(component[property]) === "string") {
return (ui.string({name: property}));

} else if (component[property] === null) {
return (ui.action({name: property}));
} // if

function calculateConstraints (node, property) {
let constraints = {name: property, min: -Infinity, max: Infinity, step: 0.1, defaultValue: 0.0};
if (!node) return constraints;

const p = node[property] || node.parameters?.get(property) || null;
if (!p) return constraints;

if (isNumber(p)) return Object.assign(constraints, {defaultValue: p});

if (isAudioParam(p)) return {
name: property,
min: p.minValue,
max: p.maxValue,
defaultValue: p.defaultValue,
step: calculateStepSize(p.defaultValue)
};

return constraints;
} // calculateConstraints
} // createField
} // createFields

export function getState (button) {
return button.hasAttribute("aria-pressed")?
button.getAttribute("aria-pressed") === "true"
: null;
} // getState

export function setState (button, value) {
if (button.hasAttribute("aria-pressed")) {
button.setAttribute("aria-pressed", value? "true" : "false");
} // if
} // setState

export function getValue (element) {
return element instanceof HTMLButtonElement? getState(element) : element.value;
} // getValue

export function setValue (element, value, fireChangeEvent) {
if (element instanceof HTMLButtonElement) {
setState(element, value);
} else {
element.value = value;
} // if

if (fireChangeEvent) update(element);
} // setValue

export function update (element) {
element.dispatchEvent(new CustomEvent("change", {bubbles: true}));
} // update


function nullish (value) {return value === null || value === undefined || value === "";}

export function calculateStepSize (value) {
const s = 1;

const n = value === 0?
(0 <= value? -1 : 1)
: Math.floor(Math.log10(value));
return  10**(n-1);
} // calculateStepSize


export function createModal (options) {
const title = options.title || "modal";
const id = {
title: `${removeBlanks(title)}-title`,
description: `${removeBlanks(title)}-description`,
}; // id

const modal = document.createElement("div");
modal.setAttribute("style", "position: relative");

modal.innerHTML =`
<div role="dialog" aria-labelledby="${id.title}" style="position:absolute; left: 25%; right: 25%; top: 25%; bottom: 25%;">
<header>
<h2 class="title" id="${id.title}">${options.title || ""}</h2>
<button class="close" aria-label="close">X</button>
</header>
<div class="body">
<div class="description" id="${id.description}">${options.description || ""}</div>
 ${options.body || ""}
</div><!-- body -->
</div><!-- modal -->
`; // html

return modal;
} // createModal

export function displayModal (modal) {
document.body.appendChild(modal);

modal.addEventListener("click", e => e.target.classList.contains("close") && close(modal));
modal.addEventListener("focusout", maintainFocus);
modal.addEventListener("keydown", e => e.key === "Escape"? close(modal) : true);

modal.__restoreFocus__ = document.activeElement;
modal.querySelector(".close").focus();
return modal;

function close (modal) {
if (modal.__restoreFocus__) modal.__restoreFocus__.focus();
document.body.removeChild(modal);
} // close

function maintainFocus (e) {
const focusTo = e.relatedTarget, focusFrom = e.target;
//console.debug("maintainFocus: ", modal, focusFrom, focusTo, focusableElements);
if (focusTo && modal.contains(focusTo)) return;
e.preventDefault();
console.debug("shifting focus...");
setTimeout(() => focusFrom.focus(), 0);
} // maintainFocus
} // displayModal

export function statusMessage (text, append, ignoreQueue) {
const status = document.querySelector(".root .status, #status");
if (!status) {
//alert(text);
return;
} // if

if (append) {
status.setAttribute("aria-atomic", "false");
status.insertAdjacentHTML("beforeEnd", `<p class="message">${text}</p>\n`);
} else {
status.setAttribute("aria-atomic", "true");
status.innerHTML = `<p>${text}</p>`;
} // if
} // statusMessage

export function compile (text) {
const _function = compileFunction(text);
if (_function && _function instanceof Function) return _function;
statusMessage(`Invalid automation function: ${text}`);
return false;
} // compile

function signalCreator (type) {
const map = {
string: jSig.stringSignal,
number: jSig.numericSignal,
boolean: jSig.booleanSignal,
};
const func = map[type];
if (func) return func;
else throw new Error("invalid signal type");
} // signalCreator
