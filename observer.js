const observers = new Map();
const proxied = new Map();

/// test
/*let myObject = {
a: 1,
_b: 0,
get b () {return 2 * this._b;},
set b (v) {
this._b = v;
console.log(`myObject setter: set b to ${v}`);
} // set b
}; // myObject
 myObject = publish(myObject);
subscribe(myObject, "b", (object, p, v) =>
console.log(`notification: changed ${p} to ${v} in ${object}`)
); // subscribe
myObject.b = 77;
//console.log(`myObject:  ${myObject.a}, ${myObject._b}, ${myObject.b}`);
*/

export function publish (object) {
console.debug("publishing ", object);
const properties = new Map();
const newProperty = {property: "", cachedValue: undefined, callbacks: []};

// special case HTMLElement because they cannot be proxied
if (object instanceof HTMLElement) {
observers.set(object, properties);
proxied.set(object, null);
if (!properties.has("value")) properties.set("value", {...newProperty, property: "value"});
const subscriptions = properties.get("value");
object.addEventListener("change", e => {
const value = e.target.value;
if (subscriptions.cachedValue !== value) {
subscriptions.cachedValue = value;
notify(subscriptions.callbacks, object, "value", value);
} // if
}); // change handler
return object;
} // if

Reflect.ownKeys(object).forEach(property => properties.set(property, {...newProperty, property}));
Reflect.ownKeys(object).forEach(property => properties.set(property, {...newProperty, property}));
console.debug("- ", properties.size, " properties being published");

const proxy = createProxy(object, properties);
observers.set(proxy, properties);
proxied.set(object, proxy);
console.debug("- proxy created; returning ...");
return proxy;

function createProxy (object, properties) {
//console.debug("createProxy: properties: ", properties);
return new Proxy(object, {
defineProperty: function (target, property, descriptor, receiver) {
if (Reflect.defineProperty(...arguments)) {
properties.set(property, {...newProperty, property});
return true;
} else {
return false;
} // if
}, // defineProperty

set: function (target, property, value, receiver) {
console.debug("in set trap", property, value);
const subscriptions = properties.has(property)? properties.get(property)
: (properties.set(property, {...newProperty, property}), console.debug("- added property ", property), properties.get(property));

if (subscriptions.callbacks.length === 0) {
target[property] = value;
console.debug("- no subscriptions, so just update target");
return true;
} // if

if (subscriptions.cachedValue === value) return true;
subscriptions.cachedValue = target[property] = value;
notify(subscriptions.callbacks, target, property, value);
console.debug("- updated target...");

return true;
} // set
}); // Proxy
} // createProxy
} // publish

export function subscribe (object, property, callback) {
console.debug("subscribe: ", [...arguments]);
if (observers.has(object)) {
const properties = observers.get(object);
console.debug("- ", properties.size, " properties found");
if (properties.has(property)) {
const subscriptions = properties.get(property);
if (subscriptions.property !== property) throw new Error(`expected property ${property}, got ${subscriptions.property} instead.`);

const callbacks = callback? [...subscriptions.callbacks, callback] : [];
if (callbacks.length === 0) console.log("removing subscriptions for property ", property);
subscriptions.callbacks = callbacks;
properties.set(property, subscriptions);
console.debug("- subscriptions: ", properties.get(property));
} // if
} // if
} // subscribe

function notify (callbacks, object, property, value) {
callbacks.forEach(f => f(object, property, value));
} // notify
