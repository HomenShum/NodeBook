# Design notes

A collection of design notes about the graph which span multiple files.

## [Load methods](#load-methods)

Load methods are used to load serialized data into the graph or graph objects. Any objects referenced by the serialized data will be resolved to their corresponding objects in the graph. If the object does not exist in the graph yet, we create a placeholder object for it. This is common while loading multiple objects into the graph in an arbitrary order. Later, when we receive the data for the missing object, we grab the placeholder and assign the data to it.
