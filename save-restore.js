export function allComponents (root, list = []) {
if (root) {
list.push(root);
root.children && root.children.forEach(child => list = [...list, ...allComponents(child)]);
return list;
} // if
} // allComponents

function fields (component) {
return component.ui.container.querySelector(".fields").querySelectorAll(".field");
} // fields

function interactiveElement (field) {return field.querySelector("[data-name]");}


window.enumerateInteractiveElements = enumerateInteractiveElements;
export function enumerateInteractiveElements (root) {
 return allComponents(root).map(component => {
//console.debug("component: ", component);
return [...fields(component)].map(field => {
//console.debug("- ", field);
return [component, interactiveElement(field)]
}) // map over fields
}) // map over components
.flat(1);
} // enumerateInteractiveElements

export function storeAll (root) {
localStorage.clear();
enumerateInteractiveElements(root).forEach(item => storeValue(item[0], item[1].dataset.name, item[1].value));
} // storeAll

export function restoreAll (root) {
enumerateInteractiveElements(root).forEach(item => {
const [component, element] = item;
const value = getStoredValue(component, element.dataset.name);
if (value !== null || value !== undefined) element.value = value;
}); // forEach
} // restoreAll

export function storeValue (component, name, value) {
const key = keyGen(component, name);
//console.debug("storeValue: ", component._id, name, value, key);
if (key) {
localStorage.setItem(key, value);
console.debug("storing ", key, value);
} // if
} // storeValue 

function getStoredValue (component, name) {
return localStorage.getItem(keyGen(component, name));
} // getStoredValue


