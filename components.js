import {audioContext, wrapWebaudioNode, Destination, Series, Parallel} from "./audioComponent.js";

/// root (top level UI)

export function app (options, component) {
const ui = new Control({}, "App");
setDepth(ui.container, 1);
buildDom(component, ui.container);
return ui.container;
} // app


/// wrapped webaudio nodes

export function player (source) {
const sourceNode = source instanceof HTMLMediaElement?
audioContext.createMediaElementSource(source)
: createBufferSource(source);
return wrapWebaudioNode(sourceNode);
} // player

export function destination () {
const component = new Destination(audioContext);
const ui = new Control(component, "destination");
component.ui = ui;
return component;
} // destination

export function gain (options) {
return wrapWebaudioNode(audioContext.createGain());
} // gain

export function filter (options) {
return wrapWebaudioNode(audioContext.createBiquadFilter());
} // filter

export function delay(options) {
return wrapWebaudioNode(audioContext.createDelay());
} // delay


/// containers

export function series (...children) {
const component = new Series (audioContext, children);
component.type = "container";
const ui = new Control(component, "series");

ui.container.appendChild(ui.boolean({name: "bypass"}));
ui.container.appendChild(ui.boolean({name: "silentBypass"}));

ui.container.appendChild(ui.number({name: "mix", min: -1, max: 1, step: 0.1}));
ui.container.appendChild(ui.number({name: "feedBack", min: -1, max: 1, step: 0.1}));
ui.container.appendChild(ui.number({name: "delay", min: 0, max: 1, step: 0.00001}));

component.ui = ui;
return component;
} // series

export function parallel (...children) {
const component = new Parallel(audioContext, children);
component.type = "container";
const ui = new Control(component, "parallel");

ui.container.appendChild(ui.boolean({name: "bypass"}));
ui.container.appendChild(ui.boolean({name: "silentBypass"}));
ui.container.appendChild(ui.number({name: "mix", min: -1, max: 1, step: 0.1}));

component.ui = ui;
return component;
} // parallel

/// helpers

function createBufferSource (buffer) {
const source = audioContext.createBufferSource();
source.buffer = buffer;
return source;
} // createBufferSource

function buildDom(root, dom, depth = 1) {
const container = root.ui.container;
container.insertAdjacentHTML("afterBegin", '<hr role="presentation">');
container.insertAdjacentHTML("beforeEnd", `<hr aria-roledescription="end ${root.ui.label}">`);
dom.appendChild(container);
if (root.children) depth += 1;
setDepth(container, depth);
if (root.children) root.children.forEach(child => buildDom(child, container, depth));
} // buildDom

function setDepth (container, depth) {
console.debug(`dom: ${container.className}, depth ${depth}`);
container.querySelector(".component-title").setAttribute("aria-level", depth);
} // setDepth
