# Mew Overview

We’ve got a few core functions:
1. Loading, storing & updating the graph
2. Searching
3. Displaying & Manipulating the shown tree views

I’ll go through them one by one

### 1. Loading, Storing & Updating the graph

The main graph class is `GraphStore.ts`. At a high level, at the beginning of each session we do the following:
- Query for essential user data (see `api/layer/initial` )
- Returns essential user data in serialized format
- Load this data into memory as objects (`GraphNode`, `GraphRelation`)
- Load this data into our trie index (more on this in part 2)

**Note - when I refer to functions or objects without a prefix I just mean that they are a function  of GraphStore.**

#### Loading
After the query returns with JSON data, the graphstore is loaded via the `GraphStore.load()` function in a serialized JSON format specified in `SerializedData.ts`. When loading for the first time, the function `resetAndLoad()` is called instead, which calls `load()` from within along with performing some checks for or creating some default objects (`ensureDefaultObjectsCreated`).

The class that actually performs the initial loading of graphStore (i.e. calling of  `resetAndLoad()` ) is the LayerManager.

#### Storing

The graph nodes are accessible via `nodesById` and `relationsById`. The object themselves are instances of `GraphNode` and `GraphRelation` respectively. They're both subclasses of `GraphObject`, which exposes some common properties like `GraphObject.relations`. Importantly, since we are working in a hypergraph structure, both relations and nodes can have relations.

Apart from just the relations and nodes, we also need to store the position of relations relative to some other object. This is done using relation position objects, which you can find at `GraphObject.allRelationsList`, `noteContentRelationsList`, `pinnedRelationsList`, and `pointerRelationsList`.  

#### Updating

We allow several intuitive graph operations, termed "Transactions", all of which you can find in `GraphStore.applyUpdates` or equivalently in `GraphTransactionTypes.ts`. For example, `GraphTransactionTypes.TxReplaceRelationLink` is a transaction type that replaces a relation's to or from object with a different object. However, there's an important distinction to make in these higher-level operations versus the lower-level operations that we allow to be done on the database. These can be found in `api/sync/route.ts`. These atomic operations are used *by* the aforementioned higher-level operations.

Because of the complexity involved in updating the relation positions, even simple addRelation operations require multiple different atomic updates.

Syncing the updates is done through Pusher via a simple queue of graph updates. This happens in `UpdateManager.ts`. We queue the updates every time we update the graphStore locally.

### 2. Searching

We have server-side search and client-side search, done via two different indexes. First, server-side returns the results which are then put into our local trie index (or prefix tree, same thing). You can access this search function by doing `Meta+Shift+K`.

The server-side search is all in `answerQuery.ts`. We use the trigram Gini index extension built into postgres to do this, with a pretty high threshold to improve search performance. See `pg_trgm` for more info on this.

TODO: expand on this

### 3. Displaying & Manipulating the Tree

TODO