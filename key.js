let separator = " ";
export const keyNameMap = new Map([
["ctrlKey", "control"],
["altKey", "alt"],
["shiftKey", "shift"],
["metaKey", "meta"]
]); // map
const modifierNames = [...invertMap(keyNameMap).keys()];


export class Key {
constructor (e) {
this.event = e;
this.key = eventToKey(e);
} // constructor

toString () {return this.key.join(separator);}
} // class Key

export function eventToKey (e, ignoreUnadornedModifier = true) {
if (ignoreUnadornedModifier && modifierNames.includes(e.key.toLowerCase())) return [];

const map = invertMap(keyNameMap);
const key = modifierNames.map(modifier => e[map.get(modifier)]? modifier : null)
.filter(modifier => modifier);

if (e.key === " ") key.push("space");
else if (e.key.length > 1) key.push(e.key.toLowerCase());
else key.push(e.key);

return key;
} // eventToKey

export function invertMap (map) {
return new Map(
[...map.entries()].map(x => [x[1],x[0]])
); // new Map
} // invertMap

/// tests

console.assert(new Key({ctrlKey:true, shiftKey:true, altKey: true, key: " "}).toString() === new Key({altKey: true, key: " ", ctrlKey:true, shiftKey:true}).toString());

