import type { WarehouseIsoView } from '../../../lib/warehouse/isometricCamera';

type Point = { x: number; y: number };
type Face = 'front' | 'side';
type FaceRole = 'doors' | 'rear' | 'side';

interface Props {
  kind: 'REFRIGERATOR' | 'FREEZER';
  view: WarehouseIsoView;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  project: (x: number, y: number, z: number) => Point;
  compact?: boolean;
}

/**
 * Industrial cold-storage cabinets, projected onto the same isometric coordinate
 * system as the room. No bitmap, external 3D dependency or database change.
 *
 * The original equipment front faces +Y in the saved depot layout. Turning the
 * camera must NOT paint doors onto an arbitrary visible face. Four views use
 * physical front / sides / rear roles, and the lid hinges stay on original -Y.
 */
export function WarehouseColdStorageVisual({
  kind, view, x, y, width, depth, height, project, compact = false,
}: Props) {
  const refrigerator = kind === 'REFRIGERATOR';
  const faceRoles: Record<WarehouseIsoView, { front: FaceRole; side: FaceRole }> = {
    front: { front: 'doors', side: 'side' },
    right: { front: 'side', side: 'doors' },
    back: { front: 'rear', side: 'side' },
    left: { front: 'side', side: 'rear' },
  };
  const roles = faceRoles[view];
  const pt = (u: number, v: number, z: number) =>
    project(x + u * width, y + v * depth, z);
  const svgPoints = (points: Point[]) =>
    points.map((p) => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' ');
  const polygon = (points: Point[], fill: string, stroke = '#687e8b', strokeWidth = 0.85) => (
    <polygon points={svgPoints(points)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
  );
  // Visible vertical planes: +Y and +X after the view transform.
  const facePt = (face: Face, u: number, z: number) =>
    face === 'front' ? pt(u, 1, z) : pt(1, u, z);
  const facePanel = (face: Face, from: number, to: number, low: number, high: number) => [
    facePt(face, from, low), facePt(face, to, low),
    facePt(face, to, high), facePt(face, from, high),
  ];
  const faceLine = (face: Face, u0: number, z0: number, u1: number, z1: number,
    stroke: string, strokeWidth = 1, opacity = 1) => {
    const a = facePt(face, u0, z0);
    const b = facePt(face, u1, z1);
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
      stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} strokeLinecap="round" />;
  };
  // Map the ORIGINAL cabinet top coordinates to each camera view, so freezer
  // lid seams, hinges and handles rotate with the actual object.
  const lidPt = (originalX: number, originalY: number, z = height + 1) => {
    const { u, v } = view === 'front' ? { u: originalX, v: originalY }
      : view === 'right' ? { u: originalY, v: 1 - originalX }
      : view === 'back' ? { u: 1 - originalX, v: 1 - originalY }
      : { u: 1 - originalY, v: originalX };
    return pt(u, v, z);
  };
  const topPanel = (x0: number, x1: number, y0: number, y1: number, z = height + 1) => [
    lidPt(x0, y0, z), lidPt(x1, y0, z),
    lidPt(x1, y1, z), lidPt(x0, y1, z),
  ];
  const lineBetween = (a: Point, b: Point, stroke: string, sw: number, opacity = 1) =>
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
      stroke={stroke} strokeWidth={sw} opacity={opacity} strokeLinecap="round" />;

  const outline = compact ? 0.75 : 1.6;
  const fine = compact ? 0.55 : 1.05;
  const frontBody = [pt(0, 1, 0), pt(1, 1, 0), pt(1, 1, height), pt(0, 1, height)];
  const sideBody = [pt(1, 0, 0), pt(1, 1, 0), pt(1, 1, height), pt(1, 0, height)];
  const topBody = [pt(0, 0, height), pt(1, 0, height), pt(1, 1, height), pt(0, 1, height)];

  const renderFace = (face: Face, role: FaceRole) => {
    const faceKey = face + '-' + role;
    if (role === 'doors' && refrigerator) {
      const segments = 2;
      return (
        <g key={faceKey} data-cold-face="doors">
          {Array.from({ length: segments }, (_, index) => {
            const start = index / segments + 0.025;
            const end = (index + 1) / segments - 0.025;
            const handleU = index === 0 ? end - 0.065 : start + 0.065;
            return (
              <g key={'door-' + index}>
                {polygon(facePanel(face, start, end, height * 0.09, height * 0.92),
                  index ? '#d9e4e9' : '#e9f0f3', '#718893', fine)}
                {polygon(facePanel(face, start + 0.014, end - 0.014, height * 0.12, height * 0.88),
                  index ? '#d3e1e8' : '#f4f8fa', '#eef5f8', fine * 0.6)}
                {faceLine(face, start + 0.036, height * 0.19, start + 0.036, height * 0.82,
                  '#ffffff', fine * 1.15, 0.85)}
                {/* Long black rubber gasket / raised stainless vertical handles. */}
                {faceLine(face, handleU, height * 0.29, handleU, height * 0.73,
                  '#526674', compact ? 1.25 : 2.5)}
                {faceLine(face, handleU - 0.009, height * 0.30, handleU - 0.009, height * 0.72,
                  '#ffffff', fine, 0.93)}
                {faceLine(face, handleU, height * 0.28, handleU, height * 0.295, '#2b3e49', fine)}
                {faceLine(face, handleU, height * 0.725, handleU, height * 0.74, '#2b3e49', fine)}
              </g>
            );
          })}
          {faceLine(face, 0.03, height * 0.06, 0.97, height * 0.06, '#667f8b', fine)}
          {faceLine(face, 0.03, height * 0.95, 0.97, height * 0.95, '#ffffff', fine)}
          {/* Control unit is mounted on the door-side fascia, not floating above the cabinet. */}
          {polygon(facePanel(face, 0.36, 0.64, height * 0.935, height * 0.981),
            '#344a56', '#849da8', fine)}
          {faceLine(face, 0.47, height * 0.956, 0.59, height * 0.956, '#78e0ed', fine)}
        </g>
      );
    }

    if (role === 'rear') {
      return (
        <g key={faceKey} data-cold-face="rear">
          {polygon(facePanel(face, 0.09, 0.91, height * 0.16, height * 0.46),
            '#7e929e', '#506978', fine)}
          {Array.from({ length: compact ? 3 : 7 }, (_, i) => {
            const ratio = (i + 1) / (compact ? 4 : 8);
            return <g key={i}>{faceLine(face, 0.16, height * (0.18 + 0.26 * ratio),
              0.84, height * (0.18 + 0.26 * ratio), '#d5e4eb', fine * 0.75)}</g>;
          })}
          {polygon(facePanel(face, 0.16, 0.84, height * 0.58, height * 0.85),
            '#a7bbc5', '#7d959f', fine)}
          {faceLine(face, 0.17, height * 0.79, 0.83, height * 0.79, '#e7f2f7', fine)}
        </g>
      );
    }

    if (role === 'doors') {
      // Chest freezer: insulated uninterrupted front panel, recessed controller.
      return (
        <g key={faceKey} data-cold-face="freezer-front">
          {polygon(facePanel(face, 0.055, 0.945, height * 0.13, height * 0.78),
            '#e8f1f5', '#b1c4ce', fine)}
          {faceLine(face, 0.09, height * 0.23, 0.09, height * 0.72,
            '#ffffff', fine, 0.8)}
          {polygon(facePanel(face, 0.70, 0.89, height * 0.63, height * 0.76),
            '#334f5d', '#7194a5', fine)}
          {faceLine(face, 0.75, height * 0.695, 0.83, height * 0.695,
            '#7de6ee', fine)}
          {faceLine(face, 0.07, height * 0.10, 0.93, height * 0.10, '#90a7b4', fine)}
        </g>
      );
    }

    return (
      <g key={faceKey} data-cold-face="side">
        {polygon(facePanel(face, 0.07, 0.93, height * 0.11, height * 0.86),
          refrigerator ? '#acbfc8' : '#c0d4de', '#829daa', fine)}
        {Array.from({ length: compact ? 2 : 5 }, (_, i) =>
          <g key={i}>{faceLine(face, 0.15, height * (0.22 + i * (compact ? 0.28 : 0.12)),
            0.84, height * (0.22 + i * (compact ? 0.28 : 0.12)),
            '#e7f4f8', fine * 0.6, 0.7)}</g>
        )}
      </g>
    );
  };

  return (
    <g data-visual-role={refrigerator ? 'cold-storage-refrigerator' : 'cold-storage-freezer'}
      data-cold-view={view}>
      {/* Base, brushed faces and bevel trim are all kept in 3D world coordinates. */}
      {polygon(frontBody, refrigerator ? '#c4d1d7' : '#d6e5ed', '#637b88', outline)}
      {polygon(sideBody, refrigerator ? '#9eafb9' : '#a9c3d1', '#617c8d', outline)}
      {polygon(topBody, refrigerator ? '#edf3f5' : '#e5f0f4', '#879eaa', outline)}
      {renderFace('front', roles.front)}
      {renderFace('side', roles.side)}
      {faceLine('front', 0.01, height * 0.025, 0.99, height * 0.025, '#4d6470', outline)}
      {faceLine('side', 0.015, height * 0.025, 0.98, height * 0.025, '#577281', outline)}
      {lineBetween(pt(0, 0, height), pt(1, 0, height), '#ffffff', fine)}
      {lineBetween(pt(0, 0, height), pt(0, 1, height), '#f9fdff', fine)}
      {refrigerator ? (
        <g data-cold-part="top-vent">
          {polygon(topPanel(0.12, 0.88, 0.16, 0.37, height + 0.35),
            '#bacbd3', '#8097a3', fine)}
          {Array.from({ length: compact ? 3 : 7 }, (_, i) => {
            const xRatio = 0.18 + i * (0.64 / (compact ? 2 : 6));
            return <g key={i}>{lineBetween(lidPt(xRatio, 0.19, height + 0.65),
              lidPt(xRatio, 0.34, height + 0.65), '#647e8b', fine * 0.7)}</g>;
          })}
        </g>
      ) : (
        <g data-cold-part="hinged-lids">
          {/* Hinged double lid with gaskets; seams always follow original X. */}
          {polygon(topPanel(0.045, 0.955, 0.07, 0.93, height + 1),
            '#9aafb9', '#6d8796', fine)}
          {Array.from({ length: 2 }, (_, i) => {
            const x0 = i * 0.455 + 0.06;
            const x1 = x0 + 0.425;
            return (
              <g key={'lid-' + i}>
                {polygon(topPanel(x0, x1, 0.10, 0.88, height + 1.5),
                  i ? '#ddebf0' : '#f5fafc', '#819aa8', fine)}
                {lineBetween(lidPt(x0 + 0.02, 0.15, height + 1.8),
                  lidPt(x0 + 0.02, 0.81, height + 1.8), '#ffffff', fine * 0.8, 0.9)}
                {/* Mechanical hinge at the rear and an inset handle at the front. */}
                {polygon(topPanel(x0 + 0.13, x1 - 0.13, 0.09, 0.135, height + 2.2),
                  '#718d9a', '#d8e7ee', fine * 0.55)}
                {polygon(topPanel(x0 + 0.12, x1 - 0.12, 0.76, 0.84, height + 2.2),
                  '#516d7b', '#e3f2f7', fine * 0.75)}
              </g>
            );
          })}
          {lineBetween(lidPt(0.50, 0.09, height + 1.9),
            lidPt(0.50, 0.91, height + 1.9), '#6e8795', fine)}
        </g>
      )}
    </g>
  );
}
