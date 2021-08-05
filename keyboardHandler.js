import {eventToKey} from "./key.js";
import {displayModal, createModal} from "./ui.js";
import {update} from "./ui.js";

const savedValues = new Map();
export function keyboardHandler(e) {
// all must be lowercase
const commands = {
"control alt shift enter": help,
"control home": max, "control end": min,
"control arrowup": increase10, "pageup": increase50,
"control arrowdown": decrease10, "pagedown": decrease50,
"control -": negate, "control 0": zero,
"control space": save, "control shift space": swap,
"control enter": defineAutomation,
};

const key = eventToKey(e).join(" ");
//console.debug(`key: ${key}, command: ${commands[key]}`);
const element = e.target;

if (key in commands && element.tagName.toLowerCase() === "input" && (element.type === "number" || element.type === "range")) {
e.preventDefault();
e.stopPropagation();
execute(commands[key], element, Number(element.value));
} // if

function execute (command, element, value) {
command(element, value, commands);

//if (element.validationMessage) {
//statusMessage(element.validationMessage);
//element.value = value;
//} else {
update(element);
//} // if

return true;
} // execute

/// commands

function help (element, value, commands) {
console.log("command keys: ", Object.keys(commands));
let message = Object.keys(commands)
.map(key => `<tr><th>${key}</th> <td> ${commands[key].name || "[no name]"}</td></tr>`)
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
 } // keyboardHandler

