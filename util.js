function bind (name, audioNode, prop, processValue) {
const element = document.querySelector(`#${name}`);
element.addEventListener("change", e => update(audioNode, prop, getValue(element, processValue)));
update(audioNode, prop, getValue(element, processValue));
console.debug("bound ", name, " to ", prop, " on ", audioNode.constructor.name);
} // bind


function update(audioNode, prop, value) {
let param = null;

if (prop in audioNode) {
if (audioNode[prop] instanceof AudioParam) param = audioNode[prop];

} else if (audioNode.parameters && audioNode.parameters.has(prop)) {
param = audioNode.parameters.get(prop);
if (!(param instanceof AudioParam)) param = null;

} else {
alert(`update: can't update property ${prop} on ${audioNode} to ${value}`);
throw new Error("cannot update");
} // if

param? param.value = Number(value) : audioNode[prop] = value;
console.debug("updated ", prop, value);
} // update


function getValue (element, processValue = value => value) {
return element.type === "checkbox"? processValue(element.checked) : processValue(element.value);
} // getValue

function $ (s, c = document) {return c.querySelector(s);}
function $$ (s, c = document) {return [...c.querySelectorAll(s)];}
