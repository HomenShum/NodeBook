export function calculateArrowPoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  nodeRadius: number,
) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = Math.atan2(dy, dx);

  // Arrow properties
  const arrowLength = 4;

  // Calculate end point adjusted for node radius
  const length = Math.sqrt(dx * dx + dy * dy);
  const endX = sourceX + dx * (1 - nodeRadius / length);
  const endY = sourceY + dy * (1 - nodeRadius / length);

  // Calculate arrow points
  const tipX = endX;
  const tipY = endY;
  const leftX = endX - arrowLength * Math.cos(angle - Math.PI / 6);
  const leftY = endY - arrowLength * Math.sin(angle - Math.PI / 6);
  const rightX = endX - arrowLength * Math.cos(angle + Math.PI / 6);
  const rightY = endY - arrowLength * Math.sin(angle + Math.PI / 6);

  return {
    tip: { x: tipX, y: tipY },
    left: { x: leftX, y: leftY },
    right: { x: rightX, y: rightY },
  };
}

export function getDisplayText(text: string) {
  // Show max 15 (arbitrary) characters for consistency in boundary calculations
  return text.length > 15 ? text.slice(0, 12) + "..." : text;
}
