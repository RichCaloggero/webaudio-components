class Control {
static dataTypes = new Set([
Number, String, Boolean,
]);

constructor (receiver, label = "") {
if (!receiver) {
alert("Control: need a receiver");
return null;
} // if
this.receiver = receiver;
this.label = label;
this.container = document.createElement("div");
//this.container.setAttribute("role", "main");
//this.container.setAttribute("aria-roledescription", "component");
this.container.className = `component ${label}`;
this.container.innerHTML = `
<div class="component-title" role="heading">${label}</div>
`;
} // constructor

string ({
name = "",
label = separateWords(name),
defaultValue = "",
dataType = String,
receiver = this.receiver
}) {
return createControl(receiver, name, dataType, 
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
receiver, name, dataType,
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

return createControl(receiver, name, dataType,
`<label>
<span class="text">${label}</span>
<input class="control"
type="${controlType}"
data-name="${name}"
value="${dataType(defaultValue)}"
min="${min}" max="${max}" step="${step}"
></label>
`);
} // number


} // class Control

function createControl (receiver, name, dataType, html) {
const control = document.createElement("div");
try {
control.insertAdjacentHTML("afterBegin", html);
} catch (e) {
throw new Error(`createControl: invalid markup - ${e}`);
} // catch

control.hidden = true;
control.className = `${dataType.name.toLowerCase()} field ${name}`;
control.addEventListener("change", createHandler(control, name, receiver));
return control;

function createHandler (control, name, receiver) {
if (receiver instanceof Function) {
return receiver;
} else if (receiver instanceof Array) {
receiver.forEach(r => createHandler(control, name, r));
} else if (receiver instanceof Object) {
return updateValue(receiver, name);
} // if
} // createHandler

function updateValue (object, property, update) {
return (object[property] instanceof Function?
e => {
const value = getValue(e.target);
if (nullish(value)) return;

const _function = object[property];
_function.call(object, dataType(value));
} : e => {
const value = getValue(e.target);
if (nullish(value)) return;
object[property] = dataType(value);
}); // return handler
} // updateValue
} // createControl


function booleanHelper (element) {
element.addEventListener("click", e => {
setAriaState(!getState(e.target));
e.target.dispatchEvent(new CustomEvent("change", {bubbles: true}));

function setAriaState (value) {e.target.setAttribute("aria-pressed", value? "true" : "false");}
}); // click handler
} // booleanHelper

function separateWords (text) {
return text.replace(/([a-z])([A-Z])([a-z])/g, "$1 $2$3");
} // separateWords

function getState (button) {
return button.hasAttribute("aria-pressed")?
button.getAttribute("aria-pressed") === "true"
: false;
} // getState

function getValue (element) {
return element instanceof HTMLButtonElement? getState(element) : element.value;
} // getValue

function nullish (value) {return value === null || value === undefined || value === "";}
