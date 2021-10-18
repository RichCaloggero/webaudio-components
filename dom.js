import S from "./S.module.js";
import {AudioComponent} from "./audioComponent.js";
import {compile, setValue, getValue, getState} from "./ui.js";
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
//console.debug("showFields: ", component.name, component);
if (component.ui.allFieldNames.size === 0) return;
const ui = component.ui;
const container = ui.fields;
const initialized = new Set();

ui._initializers.forEach(initializer => initialize(ui, initializer));

//console.debug("showFields: ", component.name, ui._allFieldNames, ui._hide, ui._hideOnBypass);

/*if (component._type === "container" && ui._hide.size === ui.allFieldNames.size) {
const level = Number(ui.container.getAttribute("aria-level"));
if (level) ui.container.setAttribute("aria-level", level-1);
ui.container.querySelector(".component-title").hidden = true;
ui.container.setAttribute("role", "presentation");
} // if
*/

const bypass = ui.nameToField("bypass");
//if (bypass && !bypass.hidden) handleHideOnBypass(component);
return;

function handleHideOnBypass (component) {
const bypassSignal = component.ui.signals.bypass;

S.root(() => {
S(() => {
const hide = bypassSignal();
component.ui._hideOnBypass.forEach(name => ui.nameToField(name).hidden = hide);
});
}); // S.root
} // handleHideOnBypass

function initialize (ui, initializer) {
const {name, defaultValue, automator} = initializer;
const element = ui.nameToElement(name);


if (element) {
if (element.dataset.datatype === "action") return;

if (element.dataset.dataType === "boolean" || defaultValue) ui.setValue(name, defaultValue, "fire event");
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
export function fieldToElement (field) {return field.querySelector(".control");}
export function elementToField (element) {return element.closest(".field");}

export function keyGen (component, name) {return `${component._id}_${name}`;}

