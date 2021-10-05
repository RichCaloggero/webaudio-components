import S from "./S.module.js";

const _probe_ = false;

export function eventSignal (element, events = ["click", "change"]) {
const signal = S.data(new CustomEvent("init"));

for (let event of events) {
element.addEventListener(event, e => {
//message(`event ${e.type} from ${e.target}`);
signal(e);
});
} // for

if (_probe_) S(() => message(`probe: event ${signal().type} from ${signal().target?.id || null}`));
return signal;
} // createEventSignal

export function clickSignal (element) {
return eventSignal(element, ["click"]);
} // createClickSignal

export function numericSignal (element, value = 0) {
if (element.type !== "number" && element.type !== "range") throw new Error("element must have type number or range");
const events = eventSignal(element, ["change"]);
 const numbers = S.value(value);

S.on(events, () => {
if (events().target ) numbers(Number(events().target.value));
}); // handler

return numbers;
} // createNumericSignal


export function stringSignal (element, value = "") {
if (element.type !== "text" && !(element instanceof HTMLSelectElement)) throw new Error("element must be input of type text, or an HTML select element");

const events = eventSignal(element, ["change"]);
 const strings = S.value(value);

S.on(events, () => {
if (events().target ) strings(String(events().target.value));
}); // handler

return strings;
} // stringSignal

export function booleanSignal (button, value = false) {
if (button.tagName.toLowerCase() !== "button") throw new Error("argument must be a button element");
button.setAttribute("aria-pressed", "false");
button.setAttribute("role", "button");
const events = eventSignal(button, ["click"]);
const values = S.value(value);

S.on(events, () => {
if (events().target) {
toggleState(events().target);
values(getState(events().target));
} // if
});
return values;

function toggleState (element) {setState(element, !getState(element));}
function setState (element, state) {element.setAttribute("aria-pressed", state? "true" : "false");}
function getState (element) {return element.getAttribute("aria-pressed") === "true";}
} // createBooleanSignal


function message(text) {
const status = document.querySelector("[aria-live], [role=log], [role=status]");
if (status) status.insertAdjacentHTML("beforeEnd", `<p>${text}</p>`);
else alert(text);
} // message
