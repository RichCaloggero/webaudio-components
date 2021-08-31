# Webaudio Components

## Overview

This is a library which helps create webaudio connection graphs, and basic UI for the underlying webaudio primitive nodes. It is also possible to create your own nodes via the AudioWorklet facility and create UI and connection graphs involving these user defined nodes.

## Architecture

there are three main architectural levels to this system:

1. the tope level is a set of javascript functions which can be called to instantiate a component and build it's UI. These functions also build the connection graph (more about this below).
2. The next layer consists of two classes:
   - AudioComponent(): this extends the underlying webaudio primitive nodes with various facilities to help create the connection graph;
   - UI: this class creates the markup representing the UI and attaches the UI to the underlying AudioCOmponent() object.
3. The lowest layer consists of the underlying webaudio nodes and any user-defined AudioWorkletNode objects in the system.

## Adding a new node

To add a node to the system:

- if it's a standalone webaudio node such as BiquadFilterNode(), use the wrapWebaudioNode() function as follows:
 
```
export function filter (options) {
return applyFieldInitializer(
options,
wrapWebaudioNode(audioContext.createBiquadFilter())
);
} // filter
```

The wrapWebaudioNode() function first creates a new AudioComponent(), and then creates getters and setters on this object which talk to the webaudio node.

The applyFieldInitializer() function processes the options (which may be a string or object) and initializes properties of the component based on the supplied options. 

the options can be either:

- a semicolon separated sequence of initializers.
- or and array of objects

Each initializer string can be:

- name = defaultValue
- name = defaultValue | automation
- show = names
- show = *
- hide = names

The names for show / hide are comma separated field names corresponding to the exposed properties of each component object.

Each initializer object may have  properies:

- name
- defaultValue
- automator

__Note: the object form has not been tested and may disappear.__

### Adding a AudioComponent() subclass

To add a component which is implemented as an AudioComponent() subclass, the process is less automated. Here are the steps:

```
export function delay(options) {
// create the component
const component = new Delay(audioContext);

// create the associated UI object
const ui = new Control(component, "delay");


// create the individual HTML elements corresponding to the exposed properties of the component
// this node has delay and feedback properties
// all components have bypass, silentBypass, and mix properties
createFields(
component, ui,
[...AudioComponent.sharedParameterNames, "delay", "feedBack"]
); // createFields

// add the ui to the component
component.ui = ui;

// processes the options and creates sets of fields to be shown, hidden, and initialized
// it returns the supplied component object
return applyFieldInitializer(options, component);
} // delay
```

## Creating the connection graph

There are three functions which create the graph:

- series()
- parallel()
- split()

Each of these takes options, and all remaining arguments become children of the component. THese children are attached to the component via an array, and are connected to each other and the rest of the graph by these connector components.

As with all component functions, connector functions return a component object.

Because of javascripts evaluation order, the graph is connected correctly, bottom up, as the tree of functions is evaluated. Of course, the user is free to write the graph as a call tree, or as separate calls with appropriate variable references to hold previous results.

For instance:

```
import * as audio from "./components.js";
 
const app - audio.app("enableAutomation = true",
audio.series(
audio.panner("radius = 1; angle = 0"),
audio.destination()
) // series
); // app

document.body.appendChild(app.ui.container);
```

