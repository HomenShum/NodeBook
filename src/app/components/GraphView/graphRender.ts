import { Tween as Tweened, Group as TweenGroup } from "@tweenjs/tween.js";
import {
  drag,
  forceCenter,
  forceCollide,
  forceManyBody,
  forceSimulation,
  select,
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
  zoom,
  zoomIdentity,
} from "d3";
import { Application, Container, ContainerChild, Graphics, Rectangle, Text } from "pixi.js";

import { FONT_SIZE } from "@/app/components/GraphView/styles";
import { calculateArrowPoints, getDisplayText } from "@/app/components/GraphView/utils";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { Tree } from "@/app/tree/Tree";
import { BaseTreeNode } from "@/app/tree/nodes";

type GraphicsInfo = {
  color: string;
  gfx: Graphics;
  alpha: number;
  active: boolean;
};

type NodeData = BaseTreeNode & SimulationNodeDatum;

type RelationData = {
  source: NodeData;
  target: NodeData;
  // TODO: Proper relation type and rendering
  relation: string;
} & SimulationLinkDatum<NodeData>;

type RelationRenderData = GraphicsInfo & {
  simulationData: RelationData;
};

type NodeRenderData = GraphicsInfo & {
  simulationData: NodeData;
  label: Text;
};

type TweenNode = {
  update: (time: number) => void;
  stop: () => void;
};

export async function renderGraph(
  graphContainerId: string,
  tree: Tree,
  settingsStore: SettingsStore,
  navigate: (node: NodeData) => void,
) {
  // ================ GRAPH CONTAINER ================
  const container = document.getElementById(graphContainerId);
  if (!container) return () => {};

  // Size
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  // ====================================================

  // ================ SETTINGS =========================
  let enableDrag = true;
  let enableZoom = true;
  const repelForce = 0;
  const centerForce = 1;
  const collisionStrength = 1;
  const opacityScale = 1;

  // ====================================================

  // ================ STATE =============================
  const currentNodeId: string = tree.state.root.object.id;
  let hoveredNodeId: string | null = null;
  let hoveredNeighbours: Set<string> = new Set();

  const nodes: Map<string, NodeData> = new Map();
  const relations: RelationData[] = [];

  function traverseTree(node: BaseTreeNode) {
    for (const child of node.visibleChildren) {
      nodes.set(child.object.id, child);
      // Only add relations if we're showing the root or this isn't a relation to the root
      if (settingsStore.showGraphRoot || node.object.id !== tree.state.root.object.id) {
        relations.push({
          source: nodes.get(node.object.id)!,
          target: nodes.get(child.object.id)!,
          relation: "unknown",
        });
      }
      if (child.isExpanded) {
        traverseTree(child);
      }
    }
  }

  // Only add the root node if showGraphRoot is true
  if (settingsStore.showGraphRoot) {
    nodes.set(tree.state.root.object.id, tree.state.root);
  }
  traverseTree(tree.state.root);

  const graphData: { nodes: NodeData[]; relations: RelationData[] } = {
    nodes: Array.from(nodes.values()),
    relations: relations,
  };

  const nodeRadius = (d: NodeData) => {
    const numRelations = graphData.relations.filter(
      (l) => l.source.object.id === d.object.id || l.target.object.id === d.object.id,
    ).length;
    return 2 + Math.sqrt(numRelations);
  };

  // TODO: The rectangular bounds isn't fully correct here, but it's good enough for now. Revisit this
  const getBounds = (d: NodeData) => {
    const text = getDisplayText(d.object.text);
    const padding = 10; // Padding inside rectangle
    return {
      width: FONT_SIZE * text.length * 0.6 + padding * 2, // Approximate text width
      height: FONT_SIZE + padding * 2,
    };
  };

  // we virtualize the simulation and use pixi to actually render it
  const simulation: Simulation<NodeData, RelationData> = forceSimulation<NodeData>(graphData.nodes)
    .force("charge", forceManyBody().strength(repelForce))
    .force("center", forceCenter().strength(centerForce))
    .force(
      "collide",
      forceCollide<NodeData>()
        .radius((d) => {
          const bounds = getBounds(d);
          return Math.sqrt((bounds.width / 2) ** 2 + (bounds.height / 2) ** 2);
        })
        .strength(collisionStrength)
        .iterations(3),
    );

  // TODO: Join the render data like the graph data
  const relationRenderData: RelationRenderData[] = [];
  const nodeRenderData: NodeRenderData[] = [];

  let dragStartTime = 0;
  let dragging = false;

  function updateHoverInfo(newHoveredId: string | null) {
    hoveredNodeId = newHoveredId;

    if (newHoveredId === null) {
      hoveredNeighbours = new Set();
      for (const n of nodeRenderData) {
        n.active = false;
      }

      for (const r of relationRenderData) {
        r.active = false;
      }
    } else {
      hoveredNeighbours = new Set();
      for (const r of relationRenderData) {
        const relationData = r.simulationData;
        if (relationData.source.object.id === newHoveredId || relationData.target.object.id === newHoveredId) {
          hoveredNeighbours.add(relationData.source.object.id);
          hoveredNeighbours.add(relationData.target.object.id);
        }

        r.active = relationData.source.object.id === newHoveredId || relationData.target.object.id === newHoveredId;
      }

      for (const n of nodeRenderData) {
        n.active = hoveredNeighbours.has(n.simulationData.id);
      }
    }
  }

  // ====================================================

  // ================ STYLING ==========================
  // TODO: Refacto this to util and organize all the computed styles
  const computedStyleMap = getComputedStyle(document.documentElement);
  const color = (d: NodeData) => {
    const isCurrent = d.object.id === currentNodeId;
    if (isCurrent) {
      return computedStyleMap.getPropertyValue("--teal-8");
    } else {
      return computedStyleMap.getPropertyValue("--gray-11");
    }
  };

  // ================ TWEENING ======================================
  const tweens = new Map<string, TweenNode>();

  // =================================================================

  // ========================= PIXI CONTAINERS =======================
  const app = new Application();
  await app.init({
    width,
    height,
    antialias: true,
    autoStart: false,
    autoDensity: true,
    backgroundAlpha: 0,
    preference: "webgpu",
    resolution: window.devicePixelRatio,
    eventMode: "static",
  });
  // Ensure there's only one canvas
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  container.appendChild(app.canvas);

  const stage = app.stage;
  stage.interactive = false;

  // Set up pixi containers
  const labelsContainer = new Container<Text>({ zIndex: 3 });
  const nodesContainer = new Container<ContainerChild>({ zIndex: 2 });
  const relationsContainer = new Container<Graphics>({ zIndex: 1 });
  stage.addChild(nodesContainer, labelsContainer, relationsContainer);

  // Fill containers with data
  function renderNodes() {
    tweens.get("hover")?.stop();

    const tweenGroup = new TweenGroup();
    for (const n of nodeRenderData) {
      const alpha = !hoveredNodeId || hoveredNodeId === n.simulationData.object.id ? 1 : 0.2;
      // TODO: should probably highlight the neighbours too, but im gonna rewrite the neighbours logic now
      tweenGroup.add(new Tweened<Graphics>(n.gfx, tweenGroup).to({ alpha }, 200));
    }

    tweenGroup.getAll().forEach((tw) => tw.start());
    tweens.set("hover", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop());
      },
    });
  }

  function renderRelations() {
    tweens.get("relation")?.stop();
    const tweenGroup = new TweenGroup();

    for (const l of relationRenderData) {
      let alpha = 1;

      // if we are hovering over a node, we want to highlight the immediate neighbours
      // with full alpha and the rest with default alpha
      if (hoveredNodeId) {
        alpha = l.active ? 1 : 0.2;
      }

      const relationData = l.simulationData;
      const sourceX = relationData.source.x! + width / 2;
      const sourceY = relationData.source.y! + height / 2;
      const targetX = relationData.target.x! + width / 2;
      const targetY = relationData.target.y! + height / 2;

      // Calculate arrow points
      // TODO: recalculate arrow points now that the target is a rectangle instead of a circle
      const arrow = calculateArrowPoints(sourceX, sourceY, targetX, targetY, nodeRadius(relationData.target));

      l.gfx
        .clear()
        // Draw the line
        .moveTo(sourceX, sourceY)
        .lineTo(arrow.tip.x, arrow.tip.y)
        .stroke({ alpha: l.alpha, width: 1, color: l.color })
        // Draw the arrow
        .moveTo(arrow.tip.x, arrow.tip.y)
        .lineTo(arrow.left.x, arrow.left.y)
        .lineTo(arrow.right.x, arrow.right.y)
        .lineTo(arrow.tip.x, arrow.tip.y)
        .stroke({ color: l.color, alpha: l.alpha, width: 1 });

      l.color = l.active
        ? computedStyleMap.getPropertyValue("--gray-11")
        : computedStyleMap.getPropertyValue("--gray-12");
      tweenGroup.add(new Tweened<RelationRenderData>(l).to({ alpha }, 200));
    }

    tweenGroup.getAll().forEach((tw) => tw.start());
    tweens.set("relation", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop());
      },
    });
  }

  function renderLabels() {
    tweens.get("label")?.stop();
    const tweenGroup = new TweenGroup();

    const defaultScale = 1;
    const activeScale = 1.1;
    for (const n of nodeRenderData) {
      const nodeId = n.simulationData.object.id;

      if (hoveredNodeId === nodeId) {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: 1,
              scale: { x: activeScale, y: activeScale },
            },
            100,
          ),
        );
      } else {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: n.label.alpha,
              scale: { x: defaultScale, y: defaultScale },
            },
            100,
          ),
        );
      }
    }

    tweenGroup.getAll().forEach((tw) => tw.start());
    tweens.set("label", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop());
      },
    });
  }

  const renderPixiFromD3 = () => {
    renderNodes();
    renderRelations();
    renderLabels();
  };

  tweens.forEach((tween) => tween.stop());
  tweens.clear();

  for (const n of graphData.nodes) {
    const nodeId = n.object.id;
    const bounds = getBounds(n);

    const label = new Text({
      interactive: false,
      eventMode: "none",
      text: getDisplayText(n.object.text),
      alpha: 1,
      anchor: { x: 0.5, y: 0.5 },
      style: {
        fontSize: FONT_SIZE,
        fill: computedStyleMap.getPropertyValue("--gray-1"),
      },
      resolution: window.devicePixelRatio * 4,
    });
    let oldLabelOpacity = 0;
    const gfx = new Graphics({
      interactive: true,
      label: nodeId,
      eventMode: "static",
      hitArea: new Rectangle(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height),
      cursor: "pointer",
    })
      .roundRect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height, 4)
      .fill({ color: color(n) })
      .stroke({ width: 0, color: color(n) })
      .on("pointerover", (e) => {
        updateHoverInfo(n.object.id);
        oldLabelOpacity = label.alpha;
        if (!dragging) {
          renderPixiFromD3();
        }
      })
      .on("pointerleave", () => {
        updateHoverInfo(null);
        label.alpha = oldLabelOpacity;
        if (!dragging) {
          renderPixiFromD3();
        }
      });

    // Add red circle indicator
    const indicator = new Graphics().circle(-bounds.width / 2, -bounds.height / 2, 6).fill({ color: 0xff0000 }); // Red color

    // Add indicator count
    const count = new Text({
      text: "1",
      style: {
        fontSize: 10,
        fill: 0xffffff, // White text
      },
      anchor: { x: 0.5, y: 0.5 },
      position: { x: -bounds.width / 2, y: -bounds.height / 2 },
    });

    // Create container and add all elements
    const container = new Container();
    container.addChild(gfx, label, indicator, count);
    nodesContainer.addChild(container);

    nodeRenderData.push({
      simulationData: n,
      gfx,
      label,
      color: color(n),
      alpha: 1,
      active: false,
    });
  }

  for (const r of graphData.relations) {
    const gfx = new Graphics({ interactive: false, eventMode: "none" });
    relationsContainer.addChild(gfx);

    const relationRenderDatum: RelationRenderData = {
      simulationData: r,
      gfx,
      color: computedStyleMap.getPropertyValue("--gray-12"),
      alpha: 1,
      active: false,
    };

    relationRenderData.push(relationRenderDatum);
  }

  // ============================== DRAGGING HANDLING ==================================
  let currentTransform = zoomIdentity;
  if (enableDrag) {
    select<HTMLCanvasElement, NodeData | undefined>(app.canvas).call(
      drag<HTMLCanvasElement, NodeData | undefined>()
        .container(() => app.canvas)
        .subject(() => graphData.nodes.find((n) => n.object.id === hoveredNodeId))
        .on("start", function dragstarted(event) {
          // TODO: This is required for drag behaviour, but also make the graph "zoom in" by repelling all nodes away
          if (!event.active) simulation.alphaTarget(1).restart();
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
          event.subject.__initialDragPos = {
            x: event.subject.x,
            y: event.subject.y,
            fx: event.subject.fx,
            fy: event.subject.fy,
          };
          dragStartTime = Date.now();
          dragging = true;
        })
        .on("drag", function dragged(event) {
          const initPos = event.subject.__initialDragPos;
          event.subject.fx = initPos.x + (event.x - initPos.x) / currentTransform.k;
          event.subject.fy = initPos.y + (event.y - initPos.y) / currentTransform.k;
        })
        .on("end", function dragended(event) {
          if (!event.active) simulation.alphaTarget(0);
          event.subject.fx = null;
          event.subject.fy = null;
          dragging = false;

          // if the time between mousedown and mouseup is short, we consider it a click
          if (Date.now() - dragStartTime < 200) {
            navigate(graphData.nodes.find((n) => n.object.id === event.subject.object.id)!);
          }
        }),
    );
  } else {
    for (const node of nodeRenderData) {
      node.gfx.on("click", () => {
        navigate(graphData.nodes.find((n) => n.object.id === node.simulationData.object.id)!);
      });
    }
  }

  // ============================== ZOOMING HANDLING ==================================
  if (enableZoom) {
    select<HTMLCanvasElement, NodeData>(app.canvas).call(
      zoom<HTMLCanvasElement, NodeData>()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.25, 4])
        .on("zoom", ({ transform }) => {
          currentTransform = transform;
          stage.scale.set(transform.k, transform.k);
          stage.position.set(transform.x, transform.y);

          // zoom adjusts opacity of labels too
          const scale = transform.k * opacityScale;
          let scaleOpacity = Math.max((scale - 1) / 3.75, 0);
          const activeNodes = nodeRenderData.filter((n) => n.active).flatMap((n) => n.label);

          for (const label of labelsContainer.children) {
            if (!activeNodes.includes(label)) {
              label.alpha = scaleOpacity;
            }
          }
        }),
    );
  }

  // ============================== RENDER LOOP ==================================
  function animate(time: number) {
    // TODO: not sure if this a clean way to handle container resize
    const container = document.getElementById(graphContainerId);
    if (!container) return () => {};

    // Size
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    app.renderer.resize(width, height);

    for (const n of nodeRenderData) {
      const { x, y } = n.simulationData;
      if (!x || !y) continue;
      // Update the parent container position instead
      n.gfx.parent.position.set(x + width / 2, y + height / 2);
    }

    for (const r of relationRenderData) {
      const relationData = r.simulationData;

      const sourceX = relationData.source.x! + width / 2;
      const sourceY = relationData.source.y! + height / 2;
      const targetX = relationData.target.x! + width / 2;
      const targetY = relationData.target.y! + height / 2;

      // Calculate arrow points
      const arrow = calculateArrowPoints(sourceX, sourceY, targetX, targetY, nodeRadius(relationData.target));

      r.gfx
        .clear()
        // Draw the line
        .moveTo(sourceX, sourceY)
        .lineTo(arrow.tip.x, arrow.tip.y)
        .stroke({ alpha: r.alpha, width: 1, color: r.color })
        // Draw the arrow
        .moveTo(arrow.tip.x, arrow.tip.y)
        .lineTo(arrow.left.x, arrow.left.y)
        .lineTo(arrow.right.x, arrow.right.y)
        .lineTo(arrow.tip.x, arrow.tip.y)
        .fill({ color: r.color, alpha: r.alpha });
    }

    tweens.forEach((t) => t.update(time));
    app.renderer.render(stage);
    requestAnimationFrame(animate);
  }

  const animationFrame = requestAnimationFrame(animate);

  // ============================== CLEANUP ==================================
  return () => {
    simulation.stop();
    cancelAnimationFrame(animationFrame);
    // TODO: Check if this actually cleans up all the memory and avoid memory leaks
    relationRenderData.forEach((l) => l.gfx.destroy());
    nodeRenderData.forEach((n) => n.gfx.destroy());
  };
}
