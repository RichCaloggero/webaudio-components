let probe = false;
const _probe = window.probe = new Map();

import S from "./S.module.js";


export function eventSignal (element, events = ["click", "change"]) {
const signal = S.value(new CustomEvent("init"));

for (let event of events) {
element.addEventListener(event, e => {
signal(e);
});
} // for

S.root(() => {
if (probe) S(() => saveEvents(signal()));
}); // S.root
return signal;
} // createEventSignal

export function clickSignal (element) {return eventSignal(element, ["click"]);} // createClickSignal
export function changeSignal (element) {return eventSignal(element, ["change"]);} // createClickSignal

export function valueSignal (element, _value = "") {
const events = element instanceof HTMLButtonElement?
clickSignal(element) : changeSignal(element);

return S.root(() => {
return S.on(events, _value => {
const element = events().target;
if (!element) return _value;
return element instanceof HTMLButtonElement && element.hasAttribute("aria-pressed")?
(toggleState(element), getState(element))
: element.value;
}, _value);
}); // S.root

function toggleState (element) {setState(element, !getState(element));}
function setState (element, state) {element.setAttribute("aria-pressed", state? "true" : "false"); return state;}
function getState (element) {return element.getAttribute("aria-pressed") === "true";}
} // valueSignal

export function numericSignal (element, value = 0) {
if (element.type !== "number" && element.type !== "range") throw new Error("element must have type number or range");
const values = valueSignal(element, value);
return S.root(() => {
return S.on(values, () => Number(values()));
}); // S.root
} // createNumericSignal

export function stringSignal (element, value = "") {
if (element.type !== "text" && !(element instanceof HTMLSelectElement)) throw new Error("element must be input of type text, or an HTML select element");
return valueSignal(element, value);
} // stringSignal

export function booleanSignal (button, value = false) {
if (button.tagName.toLowerCase() !== "button") throw new Error("argument must be a button element");
button.setAttribute("aria-pressed", "false");
const values = valueSignal(button, value);

return S.root(() => {
return S.on(values, () => Boolean(values()));
}); // S.root
} // createBooleanSignal


function saveEvents (e) {
const type = e.type;
const list = _probe.has(type)? [..._probe.get(type), e] : [e];
_probe.set(type, list);
} // saveEvents

