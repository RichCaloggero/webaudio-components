export class Control {
static dataTypes = new Set([
Number, String, Boolean,
]);

static dataTypeMap = new Map([
["String", String],
["Boolean", Boolean],
["Number", Number]
]);


constructor (receiver, label = "") {
if (!receiver) {
alert("Control: need a receiver");
return null;
} // if
this.receiver = receiver;
this.label = label;
this.container = document.createElement("fieldset");
//this.container.setAttribute("role", "main");
//this.container.setAttribute("aria-roledescription", "component");
//this.container.setAttribute("aria-label", label);
this.container.className = `component ${label}`;
this.container.innerHTML = `
<legend><div class="component-title" role="heading">${label}</div></legend>
`;

this.container.addEventListener("change", createUpdateHandler(this));
} // constructor

string ({
name = "",
label = separateWords(name),
defaultValue = "",
dataType = String,
receiver = this.receiver
}) {
return createControl(receiver, name, dataType, defaultValue,
`<label>
<span class="text">${label}</span>
<input type="text" value="${defaultValue}" data-name="${name}">
</label>
`);
} // string


boolean ({
name = "",
label = separateWords(name),
defaultValue = false,
dataType = Boolean,
receiver = this.receiver
}) {
const element = createControl(
receiver, name, dataType, defaultValue,
`<button data-name="${name}" aria-pressed="${defaultValue? "true" : "false"}">${label}</button>`
);
element.dataset.value = dataType(defaultValue);
booleanHelper(element);
return element;
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

return createControl(receiver, name, dataType, defaultValue,
`<label>
<span class="text">${label}</span>
<input class="control"
type="${controlType}"
data-name="${name}"
value="${dataType(defaultValue)}"
min="${min}" max="${max}" step="${step}">
</label>
`);
} // number


} // class Control

function createControl (receiver, name, dataType, defaultValue, html) {
const control = document.createElement("div");
try {
control.insertAdjacentHTML("afterBegin", html);
} catch (e) {
throw new Error(`createControl: invalid markup - ${e}`);
} // catch

control.hidden = true;
control.className = `${dataType.name.toLowerCase()} field ${name}`;
control.dataset.dataType = dataType.name;

return control;
} // createControl

function createUpdateHandler (ui) {
const {receiver, container} = ui;
//console.debug("createUpdateHandler: ", receiver.name, container.className);
if (! receiver) throw new Error("need receiver");
if (! container) throw new Error("need container");

return e => {
e.stopPropagation();
//e.stopImmediatePropagation();


const element = e.target;
const name = element.dataset.name;
const dataType = Control.dataTypeMap.get(element.closest(".field").dataset.dataType);
const value = getValue(element);
if (nullish(value)) return;
console.debug("in change handler: ", element.tagName, name, dataType, value );

if (receiver[name] instanceof Function) receiver[name].call(receiver, dataType(value));
else updateValue(receiver, name, dataType(value));
}; // function
} // createUpdateHandler


function updateValue (receiver, property, value) {
console.debug("updateValue: ", receiver instanceof AudioNode? " AudioNode " : " AudioComponent ", receiver.name || receiver.label, property, value);
if (property instanceof Function) property.call(receiver, value);
else receiver[property] = value;
} // updateValue

export function update (element) {
element.dispatchEvent(new CustomEvent("change", {bubbles: true}));
} // update

function booleanHelper (element) {
element.addEventListener("click", e => {
setState(e.target, !getState(e.target));
e.target.dispatchEvent(new CustomEvent("change", {bubbles: true}));
}); // click handler
} // booleanHelper

function separateWords (text) {
return text.replace(/([a-z])([A-Z])([a-z])/g, "$1 $2$3");
} // separateWords

export function getState (button) {
return button.hasAttribute("aria-pressed")?
button.getAttribute("aria-pressed") === "true"
: false;
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

if (fireChangeEvent) element.dispatchEvent(new CustomEvent("change", {bubbles: true}));
} // setValue


function nullish (value) {return value === null || value === undefined || value === "";}

