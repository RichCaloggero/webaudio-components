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

export function getInteractiveElement (name, container) {return container.querySelector(`[data-name=${name}]`);}
export function getField (name, container) {return getInteractiveElement(name, container)?.closest(".field");}

