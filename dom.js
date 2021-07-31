import {setValue} from "./ui.js";

export function buildDom(component, depth = 1) {
const dom = component.ui.container;
const domChildren = dom.querySelector(".children");
setDepth(dom, depth);
//console.debug("build: ", depth, dom);
if (component.children) component.children.forEach(child => {
//console.debug("- appending ", child.ui.container);
domChildren.appendChild(child.ui.container);
buildDom(
child,
dom.getAttribute("role") !== "presentation" && child.type === "container"? depth+1 : depth
); // buildDom
}); // forEach child
} // buildDom

function setDepth (container, depth) {
//console.debug(`dom: ${container.className}, depth ${depth}`);
container.querySelector(".component-title").setAttribute("aria-level", depth);
} // setDepth

export function storeAllFields () {
getAllFields.forEach(f => {
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
export function getAllInteractiveElements (root) {return getAllFields(root).map(fieldToElement);}
export function fieldToElement (field) {return field.querySelector("[data-name]");}
export function elementToField (element) {return element.closest(".field");}


