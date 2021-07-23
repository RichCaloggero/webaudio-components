export function parseFieldDescriptor (s) {
if (! s) return [];
return splitOnSemi(s).map(d => createDescriptor(d));
} // parser

function createDescriptor (s) {
const [name, value] = splitOnEquals(s);
const [defaultValue, automator] = splitOnBar(value);
return {name, defaultValue, automator, value};
} // createDescriptor


function splitOnBar (s = "") {
return s.split(/\s*\|+\s*/);
} // splitOnBar

function splitOnEquals (s = "") {
return s.split(/\s*=+\s*/);
} // splitOnEquals

function splitOnSemi (s = "") {
return s.split(/\s*;+\s*/);
} // splitOnSemi

function splitOnCommaAndSpace (s) {
return s.split(/,+\s*|,*\s+/).filter(x => x.length>0);
} // splitOnCommaAndSpace
