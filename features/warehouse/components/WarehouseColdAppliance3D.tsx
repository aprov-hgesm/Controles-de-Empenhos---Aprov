'use client';

import type { WarehouseApplianceFace } from '../../../lib/warehouse/applianceOrientation';
import { warehouseApplianceVisiblePanel } from '../../../lib/warehouse/applianceOrientation';

type Point = { x: number; y: number };
type Appliance = {
  x: number; y: number; width: number; height: number;
};
type Props = {
  object: Appliance;
  z: number;
  kind: 'FREEZER' | 'REFRIGERATOR';
  front: WarehouseApplianceFace;
  project: (x: number, y: number, z: number) => Point;
  occupied: boolean;
};
type VisibleSide = 'x+' | 'y+';

function points(items: Point[]) {
  return items.map(({ x, y }) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ');
}

/** Every decorative part is defined in world coordinates before projection. */
export function WarehouseColdAppliance3D({ object, z, kind, front, project, occupied }: Props) {
  const { x, y, width: w, height: d } = object;
  const fridge = kind === 'REFRIGERATOR';
  const top = z;
  const shellBottom = 3.5;
  const world = (xx: number, yy: number, zz: number) => project(xx, yy, zz);
  const quad = (a: [number, number, number][]) =>
    points(a.map(([xx, yy, zz]) => world(xx, yy, zz)));
  const surface = (side: VisibleSide, u: number, height: number, out=0.7): Point =>
    side === 'y+'
      ? world(x + w*u, y + d + out, height)
      : world(x + w + out, y + d*u, height);
  const patch = (side: VisibleSide, u0: number, u1: number, bottom: number, roof: number, out=0.75) =>
    points([
      surface(side,u0,bottom,out),surface(side,u1,bottom,out),
      surface(side,u1,roof,out),surface(side,u0,roof,out),
    ]);

  const isFront = (side:VisibleSide)=>warehouseApplianceVisiblePanel(side,front)==='front';
  const visiblePanel = (side:VisibleSide) => warehouseApplianceVisiblePanel(side,front);
  const surfaceLine = (side:VisibleSide,u0:number,u1:number,zz:number) => {
    const a=surface(side,u0,zz);
    const b=surface(side,u1,zz);
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  };
  const verticalLine = (side:VisibleSide,u:number,h0:number,h1:number) => {
    const a=surface(side,u,h0);
    const b=surface(side,u,h1);
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  };

  const face = (side: VisibleSide) => {
    const role=visiblePanel(side);
    return (
      <g key={side} data-appliance-panel={role} data-appliance-side={side}>
        <polygon points={side==='y+'
          ? quad([[x,y+d,shellBottom],[x+w,y+d,shellBottom],[x+w,y+d,top],[x,y+d,top]])
          : quad([[x+w,y,shellBottom],[x+w,y+d,shellBottom],[x+w,y+d,top],[x+w,y,top]])}
          fill={role==='front'
            ? fridge?'url(#fridgeStainlessDoor)':'url(#freezerFront)'
            : fridge?'url(#fridgeStainlessSide)':'url(#freezerSide)'}
          stroke="#536979" strokeWidth="1.65" />

        {/* Enamelled bezel: inset all panels in world space, avoiding screen-space floating rectangles. */}
        <polygon points={patch(side,.035,.965,9,top-5)}
          fill="none" stroke={role==='front'?'#f8fdff':'#d2dfe6'}
          strokeWidth="1.45" opacity=".87" />
        <polygon points={patch(side,.05,.07,10,top-7)} fill="#f9ffff" opacity=".46"/>

        {role==='front' && fridge && (
          <g data-appliance-detail="refrigerator-double-door">
            {/* Insulated, double-door cabinet; trim reveals gasket and panel depth. */}
            <polygon points={patch(side,.065,.492,18,top-10)}
              fill="url(#fridgeStainlessDoor)" stroke="#718a96" strokeWidth="1.15"/>
            <polygon points={patch(side,.508,.935,18,top-10)}
              fill="url(#fridgeStainlessDoor)" stroke="#718a96" strokeWidth="1.15"/>
            <polygon points={patch(side,.488,.512,17,top-9)}
              fill="#586e78" opacity=".83"/>
            {[.082,.525].map((u,i)=><g key={i}>
              <polygon points={patch(side,u,u+.016,29,top-17)}
                fill="#ffffff" opacity=".46"/>
              <polygon points={patch(side,u+.021,u+.027,25,top-19)}
                fill="#90a3ab" opacity=".23"/>
            </g>)}
            {[.447,.553].map((u,i)=><g key={i}>
              {verticalLine(side,u,top*.33,top*.7)}
              <line {...(()=>{const a=surface(side,u,top*.33,2.2);
                const b=surface(side,u,top*.7,2.2);
                return {x1:a.x,y1:a.y,x2:b.x,y2:b.y};})()}
                stroke="#63717a" strokeWidth="5.3" strokeLinecap="round"/>
              <line {...(()=>{const a=surface(side,u+.009,top*.34,2.55);
                const b=surface(side,u+.009,top*.69,2.55);
                return {x1:a.x,y1:a.y,x2:b.x,y2:b.y};})()}
                stroke="#f9fdff" strokeWidth="1.6" strokeLinecap="round"/>
            </g>)}
            <polygon points={patch(side,.11,.31,top*.76,top*.85)}
              fill="#18384d" stroke="#9db7c4" strokeWidth="1"/>
            <polygon points={patch(side,.145,.244,top*.796,top*.815)}
              fill="#91e9f3" opacity=".95"/>
            {verticalLine(side,.064,17,top-10)}
            {surfaceLine(side,.07,.93,16)}
          </g>
        )}

        {role==='front' && !fridge && (
          <g data-appliance-detail="freezer-chest-front">
            {/* Thick lid, unmistakable centered pull-bar and control panel. */}
            <polygon points={patch(side,.025,.975,top-14,top-3)}
              fill="url(#freezerFront)" stroke="#6e92a6" strokeWidth="1.25"/>
            <polygon points={patch(side,.37,.63,top-19,top-11,2.1)}
              fill="#264a5c" stroke="#d5e7ee" strokeWidth="1.15"/>
            <polygon points={patch(side,.405,.595,top-16,top-13,2.6)}
              fill="#eff9fa" opacity=".79"/>
            <polygon points={patch(side,.74,.91,top*.53,top*.72)}
              fill="#1b455d" stroke="#9ac9dc" strokeWidth=".85"/>
            <polygon points={patch(side,.765,.842,top*.63,top*.66)}
              fill={occupied?'#67ead5':'#95cfe4'}/>
            <polygon points={patch(side,.74,.91,13,16)} fill="#b8cdd6" opacity=".8"/>
          </g>
        )}

        {role==='rear' && (
          <g data-appliance-detail="compressor-rear">
            <polygon points={patch(side,.14,.86,12,top*.39)}
              fill="#a9bdc7" stroke="#627986" strokeWidth="1.3"/>
            {Array.from({length:7},(_,i)=>
              <g key={i} stroke="#516b7a" strokeWidth="1.45" opacity=".92">
                {surfaceLine(side,.19,.81,16+i*((top*.39-20)/7))}
              </g>)}
            <polygon points={patch(side,.67,.85,top*.7,top*.78)}
              fill="#dfeaf0" stroke="#849ba7" strokeWidth=".8"/>
            {Array.from({length:3},(_,i)=>
              <circle key={i} cx={surface(side,.22+i*.25,top*.86).x}
                cy={surface(side,.22+i*.25,top*.86).y}
                r="1.8" fill="#687f8b"/>)}
          </g>
        )}

        {role==='side' && (
          <g data-appliance-detail="insulated-side">
            <polygon points={patch(side,.11,.86,top*.31,top*.72)}
              fill="#e8f1f4" opacity=".10" stroke="#edf6f9" strokeWidth=".85"/>
            {Array.from({length:4},(_,i)=>
              <g key={i} stroke="#839eae" strokeWidth="1.1" opacity=".56">
                {surfaceLine(side,.7,.87,17+i*4.5)}
              </g>)}
            <polygon points={patch(side,.11,.13,top*.15,top*.88)}
              fill="#f6fcfe" opacity=".24"/>
          </g>
        )}

        {role!=='rear' && <g strokeLinecap="round" opacity=".72">
          {surfaceLine(side,.06,.94,top-5)}
          <line {...(()=>{const a=surface(side,.06,top-4);
            const b=surface(side,.94,top-4);
            return {x1:a.x,y1:a.y,x2:b.x,y2:b.y};})()}
            stroke="#f8feff" strokeWidth="2.2"/>
        </g>}
      </g>
    );
  };

  const a=world(x,y,top), b=world(x+w,y,top), c=world(x+w,y+d,top), dpt=world(x,y+d,top);
  const baseA=world(x,y,1.9),baseB=world(x+w,y,1.9),baseC=world(x+w,y+d,1.9),baseD=world(x,y+d,1.9);
  return (
    <g data-visual-role={fridge?'premium-refrigerator-3d':'premium-freezer-3d'}
      data-front-face={front} data-front-axis={front.startsWith('y')?'y':'x'}>
      {/* Recessed anthracite base anchors mass to the floor. */}
      <polygon points={points([baseD,baseC,world(x+w,y+d,shellBottom),world(x,y+d,shellBottom)])} fill="#455765"/>
      <polygon points={points([baseB,baseC,world(x+w,y+d,shellBottom),world(x+w,y,shellBottom)])} fill="#334451"/>
      {face('y+')}
      {face('x+')}

      <polygon points={points([a,b,c,dpt])}
        fill={fridge?'url(#fridgeStainlessTop)':'url(#freezerGlass)'}
        stroke="#6b8494" strokeWidth="2.4"/>

      {fridge ? (
        <g data-appliance-detail="refrigerator-top">
          <polygon points={quad([
            [x+w*.08,y+d*.1,top+.7],[x+w*.9,y+d*.1,top+.7],
            [x+w*.9,y+d*.17,top+.7],[x+w*.08,y+d*.17,top+.7]
          ])} fill="#f9fcff" opacity=".6"/>
          <polygon points={quad([
            [x+w*.12,y+d*.22,top+.8],[x+w*.32,y+d*.22,top+.8],
            [x+w*.32,y+d*.64,top+.8],[x+w*.12,y+d*.64,top+.8]
          ])} fill="#c3d5dc" stroke="#f0fafc" strokeWidth="1.1"/>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeWidth="2.6" opacity=".88"/>
        </g>
      ) : (
        <g data-appliance-detail="freezer-glazed-lid">
          {/* Insulated top rim with two recessed frosted glass lids. */}
          {[[.045,.482],[.518,.955]].map(([u0,u1],i)=>
            <g key={i}>
              <polygon points={quad([
                [x+w*u0,y+d*.08,top+.9],[x+w*u1,y+d*.08,top+.9],
                [x+w*u1,y+d*.92,top+.9],[x+w*u0,y+d*.92,top+.9]
              ])} fill="url(#freezerGlass)" stroke="#83aebc" strokeWidth="1.5"/>
              <polygon points={quad([
                [x+w*(u0+.035),y+d*.13,top+1],[x+w*(u0+.12),y+d*.13,top+1],
                [x+w*(u0+.26),y+d*.82,top+1],[x+w*(u0+.18),y+d*.82,top+1]
              ])} fill="#ffffff" opacity=".29"/>
              <line {...(()=>{const a=world(x+w*u0,y+d*.1,top+1.25);
                const b=world(x+w*u1,y+d*.1,top+1.25);
                return {x1:a.x,y1:a.y,x2:b.x,y2:b.y};})()}
                stroke="#d5faff" strokeWidth="1.6" opacity=".9"/>
            </g>)}
          <polygon points={quad([
            [x+w*.488,y+d*.06,top+1.6],[x+w*.512,y+d*.06,top+1.6],
            [x+w*.512,y+d*.94,top+1.6],[x+w*.488,y+d*.94,top+1.6]
          ])} fill="#8da7b5"/>
          {/* Hinges are physically on the rear of the chest. */}
          {[.18,.82].map((u,i)=>{
            const p=world(x+w*u,y+d*.04,top+2);
            return <ellipse key={i} cx={p.x} cy={p.y} rx="5" ry="2.7"
              fill="#d6e3e9" stroke="#7c94a2" strokeWidth=".9"/>;
          })}
        </g>
      )}
      {/* Continuous premium light catch on the upper silhouette. */}
      <polyline points={points([dpt,c,b])} fill="none" stroke="#f8feff"
        strokeWidth="2.25" strokeLinejoin="round" opacity=".88"/>
    </g>
  );
}
