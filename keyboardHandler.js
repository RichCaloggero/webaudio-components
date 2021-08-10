import {eventToKey} from "./key.js";
import {statusMessage, displayModal, createModal, update, compile} from "./ui.js";
import {addAutomation, getAutomation, removeAutomation} from "./automation.js";
import {separateWords} from "./parser.js";

const savedValues = new Map();
export function keyboardHandler(e) {
// all must be lowercase
const commands = {
"control h": {command: help},
 "f1": {command: help},

"control home": {command: max, type: "numeric"},
 "control end": {command: min, type: "numeric"},
"control arrowup": {command: increase10, type: "numeric"},
 "pageup": {command: increase50, type: "numeric"},
"control arrowdown": {command: decrease10, type: "numeric"},
 "pagedown": {command: decrease50, type: "numeric"},

"control -": {command: negate, type: "numeric"},
 "control 0": {command: zero, type: "numeric"},

"control space": {command: save, type: "numeric"},
 "control shift space": {command: swap, type: "numeric"},

"enter": {command: defineAutomation, type: "numeric"},
"control enter": {command: defineStepSize, type: "numeric"},
}; // commands

const key = eventToKey(e).join(" ");
//console.debug(`key: ${key}, command: ${commands[key]}`);
const element = e.target;

if (key in commands
//&& element.tagName.toLowerCase() === "input"
) {
e.preventDefault();
e.stopPropagation();
execute(commands[key], element, Number(element.value));
return false;
} // if

function execute (command, element, value) {
if (command.type === "numeric") {
 if (element instanceof HTMLInputElement && (element.type === "number" || element.type === "range")) {
command.command(element, value, commands);
update(element);
} // if

} else {
command.command(element, value, commands);
} // if
} // execute

/// commands

function help (element, value, commands) {
//console.log("command keys: ", Object.keys(commands));
let message = Object.keys(commands)
.map(key => `<tr><th>${key}</th> <td> ${separateWords(commands[key].command.name) || "[no name]"}</td></tr>`)
.join("\n");

displayModal(createModal({
title: "Keyboard help",
body: `<table><tr><th>key</th><th>command</th></tr>${message}</table>`
}));
} // help

function defineAutomation (element) {
const text = prompt("automator: ", (getAutomation(element) || {}).text).trim();
if (!text) {
removeAutomation(element);
statusMessage("Automation removed.");
return;
} // if

const _function = compile(text);
if (_function) addAutomation(element, text, _function);
} // defineAutomation

function save (element, value) {
savedValues.set(element, value);
statusMessage("saved.");
} // save

function swap (element, value) {
if (!savedValues.has(element)) {
statusMessage("no saved value.");
return;
} // if

const savedValue = savedValues.get(element);
savedValues.set(element, value);
element.value = Number(savedValue);
} // swap

function negate (input, value) {input.value = -1*value;}
function zero (input) {input.value = 0;}

function max (input) {input.value = Number(input.max);} // max
function min (input) {input.value = Number(input.min);}

function increase10 (input, value) {input.value = value + 10*Number(input.step);}
function increase50 (input, value) {input.value = value + 50*Number(input.step);}
function decrease10 (input, value) {input.value = value - 10*Number(input.step);}
function decrease50 (input, value) {input.value = value - 50*Number(input.step);}
 

function defineStepSize (input, value) {
const text = prompt("step size: ", input.step).trim();
if (!text) return;
input.step = Number(text) || 1;
} // defineStepSize
} // keyboardHandler

