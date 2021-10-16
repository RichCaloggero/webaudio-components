import S from "./S.module.js";
import {AudioComponent} from "./audioComponent.js";
import {compile, setValue, getState} from "./ui.js";
import {addAutomation, removeAutomation, compileFunction} from "./automation.js";
import {union, intersection, symmetricDifference, difference} from "./setops.js";


export function buildDom(component, depth = 1, parent = null) {
component.parent = parent;
const dom = component.ui.container;
const domChildren = dom.querySelector(".children");

setDepth(dom, depth);
//console.debug("build: ", depth, dom);

if (component.children) component.children.forEach(child => {
//console.debug("- appending ", child.ui.container);
domChildren.appendChild(child.ui.container);
buildDom(
child,
dom.getAttribute("role") !== "presentation" && child._type === "container"? depth+1 : depth,
component
); // buildDom
}); // forEach child
} // buildDom

function setDepth (container, depth) {
//console.debug(`dom: ${container.className}, depth ${depth}`);
container.querySelector(".component-title").setAttribute("aria-level", depth);
} // setDepth

export function showFields (component) {
//console.debug("showFields: ", component);
const ui = component.ui;
if (!ui._initializers) return;
const initializers = ui._initializers;
const initialized = new Set();
const hide = ui._hide;
const show = ui._show;
const container = ui.fields;

//console.debug("showFields: initializing ", initializers);
initializers.forEach(initialize);

const fieldsToShow = [...symmetricDifference(
union(union(initialized, show), AudioComponent.sharedParameterNames),
hide
)].map(name => component.ui.nameToField(name))
.filter(field => field);
//console.debug("fieldsToShow: ", component.name, container.label, fieldsToShow);

if (fieldsToShow.length === 0) {
if (component._type === "container") {
container.parentElement.querySelector(".component-title").hidden = true;
container.parentElement.setAttribute("role", "presentation");
} // if

} else {
fieldsToShow.forEach(field => field.hidden = false);
} // if

// handle hide on bypass
const bypass = component.ui.nameToField("bypass");
//console.debug("showFields: ", bypass, component.name);
if (bypass) {
const hideOnBypass = fieldsToShow.filter(x => x.dataset.name !== "bypass")
.filter(x => x.dataset.name !== "silentBypass");

//console.debug("hideOnBypass for ", component.name, " / ", component.ui.label, " / ", component._id);
//console.debug("- ", hideOnBypass.length, " fields");
handleHideOnBypass(component.ui.signals.bypass, hideOnBypass);
} // if
return;

function handleHideOnBypass (bypassSignal, hideOnBypass) {
S.root(() => {
S(() => {
const hide = bypassSignal();
hideOnBypass.forEach(x => x.hidden = hide);
});
}); // S.root
} // handleHideOnBypass

function initialize (d) {
const {name, defaultValue, automator} = d;
//console.debug("initialize: ", name);
const element = component.ui.nameToElement(name);


if (element) {
initialized.add(name);
if (element.dataset.datatype === "action") return;

if (defaultValue) setValue(element, defaultValue, "fire change event");
if (automator) addAutomation(element, automator, compile(automator));

} else {
throw new Error(`field ${name} not found in ${component.name}`);
} // if
} // initialize
} // showFields

export function storeAllFields () {
getAllFields().forEach(f => {
if (f.dataset.dataType === "Action") return;
localStorage.setItem(f.dataset.storageKey, f.dataset.value);
});
} // storeAllFields

export function restoreAllFields () {
getAllFields().forEach(field => {
if (field.dataset.dataType === "Action") return;
const value = field.dataset.dataType === "Boolean"? localStorage.getItem(field.dataset.storageKey) === "true" : localStorage.getItem(field.dataset.storageKey);
const element = field.querySelector("[data-name]");

setValue(element, value, "fireChangeEvent");
});
} // restoreAllFields

export function getInteractiveElement (name, container) {return container.querySelector(`[data-name=${name}]`);}
export function getAllFields (root = document) {return [...root.querySelectorAll(".fields > .field")];}
export function getAllInteractiveElements (root) {return [...root.querySelectorAll(".fields .field [data-name]")];}
export function fieldToElement (field) {return field.querySelector("[data-name]");}
export function elementToField (element) {return element.closest(".field");}

export function keyGen (component, name) {return `${component._id}_${name}`;}

