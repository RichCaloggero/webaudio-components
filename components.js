import {audioContext, wrapWebaudioNode, Series, Parallel} from "./audioComponent.js";

/// root (top level UI)

export function app (options, component) {
const ui = new Control(component, options.title || "Webaudio App");
ui.container.appendChild(component.ui.container);
return ui;
} // app


/// wrapped webaudio nodes

export function filter (options) {
return wrapWebaudioNode(audioContext.createBiquadFilter());
} // filter

/// connectors

export function series (...components) {
const component = new Series (audioContext, components);
const ui = new Control(component);

ui.container.appendChild(ui.boolean({name: "bypass"}));
ui.container.appendChild(ui.boolean({name: "silentBypass"}));

ui.container.appendChild(ui.number({name: "mix", min: -1, max: 1, step: 0.1}));
ui.container.appendChild(ui.number({name: "feedBack", min: -1, max: 1, step: 0.1}));
ui.container.appendChild(ui.number({name: "delay", min: 0, max: 1, step: 0.00001}));
ui.container.appendChild(ui.number({name: "feedForward", min: -1, max: 1, step: 0.1}));

component.ui = ui;
return component;
} // series

export function parallel (options, ...components) {
const component = new Parallel(audioContext, components, options.feedBack,  options.delay, options.feedForward);
const ui = Control(component);

ui.container.appendChild(ui.boolean({name: "bypass"}));
ui.container.appendChild(ui.boolean({name: "silentBypass"}));
ui.container.appendChild(ui.number({name: "mix", min: -1, max: 1, step: 0.1}));

component.ui = ui;
return component;
} // parallel

