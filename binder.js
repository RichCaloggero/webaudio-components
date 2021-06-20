class Control {
static dataTypes = new Set([
Number, String, Boolean,
]);

constructor (receiver = document || window || global) {
if (!receiver) {
alert(`Control: need a receiver`);
return null;
} // if
this.receiver = receiver;
} // constructor

boolean ({
name: "",
label: separateWords(name),
defaultValue: false,
dataType: Boolean,
receiver: this.receiver
}) {
element = createControl(`<button aria-pressed="${defaultValue? "true" : "false"}">${label}</button>`);
element.dataset.value = Boolean(defaultValue);
Control.booleanHelper(element);
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
dataType = Number
}) {
return createControl(receiver, name, dataType,
`<label>
<span class="text">${label}</span>
<input class="control"
type="${controlType}"
name="${name}"
value="${dataType(defaultValue)}"
min="${min}" max="${max}" step="${step}"
></label>
`);
} // number


} // class Control

function createControl (receiver, name, dataType, html) {
const control = document.createElement("div");
try {
control.innerHTML = html;
} catch (e) {
throw new Error(`createControl: invalid markup - ${e}`);
} // catch


createHandler(control, name);
return control;

function createHandler (control, name) {
if (receiver instanceof Function) {
control.addEventListener("change", receiver);
return receiver;
} else if (receiver instanceof Array) {
receiver.forEach(r => createHandler(control);
} else if (receiver instanceof Object) {
const handler = updateValue(receiver, name);
control.addEventListener("change", handler);
return handler;
} // if
} // createHandler

function updateValue (object, property) {
return (object[property] instanceof Function?
e => {
const _function = object[property];
const value = dataType(e.target.value);
_function.call(object, value);
} : e => {
const value = dataType(e.target.value);
if (object[property] instanceof AudioParam) object[property].value = value;
else object[property] = value);
}); // return handler
} // updateValue
} // createControl

function booleanHelper (element) {
element.addEventListener("click", e => {
e.target.dataset.value = !e.target.dataset.value;
setAriaState(e.target.dataset.value);
e.target.dispatchEvent(new CustomEvent("change", {bubbles: true}));

function setAriaState (value) {e.target.setAttribute("aria-pressed", value? "true" : "false");}
}); // click handler
} // booleanHelper
