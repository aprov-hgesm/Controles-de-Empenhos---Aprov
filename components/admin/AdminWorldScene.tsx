'use client';

import type { KeyboardEvent } from 'react';
import type { NeighborhoodResident } from '../../lib/adminNeighborhoodModel.mjs';
import styles from './AdminWorldHomePanel.module.css';

type Point = [number, number];
type Project = (x: number, z: number, altitude?: number) => Point;
type WorldSceneProps = {
  residents: NeighborhoodResident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  waterLevel: number;
  waterKnown: boolean;
  waterExceeded: boolean;
  viewAngle: number;
  zoom: number;
};

const HOME_PALETTES = [
  { wall: '#b9d8e7', shadow: '#759bb5', roof: '#335575', edge: '#5582a5' },
  { wall: '#d8cbbf', shadow: '#968c88', roof: '#705366', edge: '#94718c' },
  { wall: '#c6d4cb', shadow: '#819d99', roof: '#426b70', edge: '#629da2' },
  { wall: '#d5c3a5', shadow: '#a39480', roof: '#655468', edge: '#8d7892' },
  { wall: '#c5cfe9', shadow: '#8598bd', roof: '#414e80', edge: '#6e7bb3' },
];

function pts(project: Project, points: Array<[number, number, number?]>): string {
  return points.map(([x, z, h = 0]) => project(x, z, h).map((n) => n.toFixed(1)).join(',')).join(' ');
}

function GroundPolygon({ project, vertices, fill, stroke, opacity }: {
  project: Project;
  vertices: Array<[number, number, number?]>;
  fill: string;
  stroke?: string;
  opacity?: number;
}) {
  return <polygon points={pts(project, vertices)} fill={fill} stroke={stroke} strokeWidth={1} opacity={opacity} />;
}

function StreetLamp({ project, x, z, name }: { project: Project; x: number; z: number; name: string }) {
  const [bx, by] = project(x, z);
  const [tx, ty] = project(x, z, 73);
  return (
    <g aria-hidden="true">
      <ellipse cx={bx} cy={by} rx="14" ry="5" fill="#8febff" opacity=".10" />
      <path d={'M ' + bx + ' ' + by + ' L ' + tx + ' ' + ty} stroke="#a2c5d6" strokeWidth="3" strokeLinecap="round" />
      <path d={'M ' + tx + ' ' + ty + ' l -14 -6'} stroke="#b5d5df" strokeWidth="3" fill="none" />
      <ellipse cx={tx - 15} cy={ty - 6} rx="20" ry="11" fill="#ffdda2" opacity=".20" filter="url(#world-halo)" />
      <circle cx={tx - 15} cy={ty - 6} r="4.5" fill="#ffe2a0" className={styles.lampGlow} />
      <circle cx={tx - 15} cy={ty - 6} r="2" fill="#fff6dd" />
      <text x={tx - 10000} y={ty} aria-label={name} fill="none">{name}</text>
    </g>
  );
}

function Tree({ project, x, z, variety = 0 }: {
  project: Project; x: number; z: number; variety?: number;
}) {
  const [bx, by] = project(x, z);
  const [tx, ty] = project(x, z, 48 + (variety % 3) * 8);
  const radius = 18 + (variety % 3) * 2.7;
  return (
    <g aria-hidden="true">
      <ellipse cx={bx + 8} cy={by + 5} rx="26" ry="8" fill="#010b20" opacity=".28" />
      <path d={'M ' + bx + ' ' + by + ' L ' + tx + ' ' + ty} stroke="#5f5354" strokeWidth="7" strokeLinecap="round" />
      <path d={'M ' + (tx + 1) + ' ' + (ty + 24) + ' l -8 -16 M ' + (tx + 1) + ' ' + (ty + 15) + ' l 9 -18'} stroke="#5f5354" strokeWidth="3" />
      <ellipse cx={tx + 1} cy={ty + 5} rx={radius + 7} ry={radius + 2} fill="#0c3449" opacity=".75" />
      <circle cx={tx - radius * .45} cy={ty - radius * .12} r={radius * .79} fill={variety % 2 ? '#226269' : '#185862'} />
      <circle cx={tx + radius * .38} cy={ty - radius * .23} r={radius * .81} fill={variety % 2 ? '#2b7471' : '#27717b'} />
      <circle cx={tx} cy={ty - radius * .64} r={radius * .85} fill={variety % 2 ? '#397f7a' : '#31818b'} />
      <ellipse cx={tx - 6} cy={ty - radius * .79} rx="8" ry="4" fill="#9ce4bf" opacity=".24" />
      <circle cx={tx + 8} cy={ty + 3} r="2" fill="#a7e6c2" opacity=".3" />
    </g>
  );
}

function Mailbox({ project, x, z, online }: {
  project: Project; x: number; z: number; online: boolean;
}) {
  const [bx, by] = project(x, z);
  const [mx, my] = project(x, z, 21);
  return (
    <g aria-hidden="true">
      <path d={'M ' + bx + ' ' + by + ' L ' + mx + ' ' + my} stroke="#8aa3ad" strokeWidth="2.4" />
      <rect x={mx - 6} y={my - 5} width="13" height="9" rx="2" fill={online ? '#e6b87d' : '#7996a3'} stroke="#b6cfdb" strokeWidth=".8" />
      <rect x={mx + 4} y={my - 8} width="2.5" height="6" fill="#ff726e" />
    </g>
  );
}

function House({ project, resident, position, selected, onSelect }: {
  project: Project;
  resident: NeighborhoodResident;
  position: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const row = Math.floor(position / 3);
  const column = position % 3;
  const x = 150 + column * 164;
  const z = 149 + row * 164;
  const w = 88;
  const d = 82;
  const h = 69 + (position % 3) * 5;
  const ridge = h + 30;
  const lit = resident.presence === 'online';
  const palette = HOME_PALETTES[position % HOME_PALETTES.length];
  const [cx, cy] = project(x + w / 2, z + d / 2);
  const [labelX, labelY] = project(x + w / 2, z + d + 21, 4);
  const [smokeX, smokeY] = project(x + 24, z + 20, ridge + 14);
  const handleKeyboard = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(resident.id);
    }
  };
  const windowFront = (px: number) => pts(project, [
    [px, z + d + .4, 28], [px + 17, z + d + .4, 28],
    [px + 17, z + d + .4, 48], [px, z + d + .4, 48],
  ]);
  return (
    <g role="button" tabIndex={0} aria-pressed={selected}
      aria-label={resident.email + ' · ' + (lit ? 'sessão ativa' : resident.presence === 'unknown' ? 'presença indisponível' : resident.disabled ? 'conta suspensa' : 'sem sessão ativa')}
      onClick={() => onSelect(resident.id)} onKeyDown={handleKeyboard} className={styles.houseGroup}
      data-presence={resident.presence} data-resident-id={resident.id}>
      <title>{resident.email} — {lit ? 'sessão válida' : resident.presence === 'unknown' ? 'sem dados de presença' : 'sem sessão válida'}</title>
      {selected && <ellipse cx={cx} cy={cy + 5} rx="94" ry="40" fill="#5de3ff" opacity=".12" filter="url(#world-halo)" />}
      <GroundPolygon project={project} vertices={[[x - 11,z - 11],[x + w + 11,z - 11],[x + w + 11,z + d + 15],[x - 11,z + d + 15]]}
        fill={selected ? '#285a68' : '#214b55'} stroke={selected ? '#82f3eb' : '#49737b'} />
      <GroundPolygon project={project} vertices={[[x+33,z+d],[x+57,z+d],[x+57,z+d+29],[x+33,z+d+29]]} fill="#b3ad9b" opacity={.62} />
      <GroundPolygon project={project} vertices={[[x - 7,z + 7],[x + 6,z + 7],[x + 6,z + d - 6],[x - 7,z+d-6]]} fill="#347a6a" opacity={.52} />
      <ellipse cx={cx+11} cy={cy+30} rx="70" ry="21" fill="#010d25" opacity=".23" />
      <GroundPolygon project={project} vertices={[[x,z+d,0],[x+w,z+d,0],[x+w,z+d,h],[x,z+d,h]]} fill={palette.wall} stroke="#bfd3d5" />
      <GroundPolygon project={project} vertices={[[x+w,z,0],[x+w,z+d,0],[x+w,z+d,h],[x+w,z,h]]} fill={palette.shadow} stroke="#90acb8" />
      <GroundPolygon project={project} vertices={[[x,z,0],[x,z+d,0],[x,z+d,h],[x,z,h]]} fill="#577d91" opacity=".78" />
      <GroundPolygon project={project} vertices={[[x-8,z+d+4,h-2],[x+w/2,z+d+4,ridge],[x+w/2,z-5,ridge],[x-8,z-5,h-2]]}
        fill={palette.roof} stroke={palette.edge} />
      <GroundPolygon project={project} vertices={[[x+w/2,z+d+4,ridge],[x+w+8,z+d+4,h-2],[x+w+8,z-5,h-2],[x+w/2,z-5,ridge]]}
        fill={palette.edge} stroke="#98b2c5" />
      <GroundPolygon project={project} vertices={[[x-8,z+d+4,h-2],[x+w/2,z+d+4,ridge],[x+w+8,z+d+4,h-2]]}
        fill={palette.roof} stroke="#b5c9d3" strokeWidth={1.1} />
      <GroundPolygon project={project} vertices={[[x+58,z+18,ridge-9],[x+75,z+18,ridge-9],[x+75,z+35,ridge-9],[x+58,z+35,ridge-9]]}
        fill="#516576" />
      <path d={'M ' + project(x+64,z+24,ridge-9).join(' ') + ' L ' + project(x+64,z+24,ridge+8).join(' ')}
        stroke="#798fa1" strokeWidth="9" strokeLinecap="square" />
      <GroundPolygon project={project} vertices={[[x+34,z+d+.9,0],[x+54,z+d+.9,0],[x+54,z+d+.9,40],[x+34,z+d+.9,40]]}
        fill="#394955" stroke="#91aaba" />
      <circle cx={project(x+52,z+d+1,20)[0]} cy={project(x+52,z+d+1,20)[1]} r="1.6" fill="#e4d5a8" />
      {[x+10,x+63].map((wx) => (
        <g key={wx}>
          <polygon points={windowFront(wx)} fill={lit ? '#ffcf75' : resident.presence === 'unknown' ? '#527085' : '#233a4d'}
            stroke={lit ? '#fff0c2' : '#91a8b6'} strokeWidth="2" className={lit ? styles.litWindow : undefined} />
          {lit && <polygon points={windowFront(wx)} fill="#ffbf5a" opacity=".36" filter="url(#world-halo)" />}
          <path d={'M ' + project(wx+8.5,z+d+1,28).join(' ') + ' L ' + project(wx+8.5,z+d+1,48).join(' ')}
            stroke="#758b9a" strokeWidth="1.2" />
        </g>
      ))}
      <GroundPolygon project={project} vertices={[[x+w+.8,z+21,32],[x+w+.8,z+41,32],[x+w+.8,z+41,52],[x+w+.8,z+21,52]]}
        fill={lit ? '#ffd18a' : '#25465a'} stroke="#c2ccd5" />
      {lit && <ellipse cx={project(x+w,z+31,36)[0]+7} cy={project(x+w,z+31,36)[1]+5}
        rx="27" ry="19" fill="#ffd281" opacity=".25" filter="url(#world-halo)" />}
      {resident.kind === 'admin' && <ellipse cx={project(x+w/2,z+d+3,ridge-20)[0]}
        cy={project(x+w/2,z+d+3,ridge-20)[1]} rx="4.5" ry="4" fill="#8be8ef" />}
      {lit && <ellipse cx={smokeX} cy={smokeY} rx="9" ry="4" fill="#c2e8de" opacity=".17" />}
      <Mailbox project={project} x={x+75} z={z+d+23} online={lit} />
      <g pointerEvents="none">
        <rect x={labelX - 47} y={labelY-2} width="94" height="19" rx="8" fill={selected ? '#0d434b' : '#091c30'} opacity=".93"
          stroke={selected ? '#7df4e5' : '#568196'} strokeWidth=".8" />
        <circle cx={labelX-35} cy={labelY+8} r="3" fill={lit ? '#ffd276' : resident.presence === 'unknown' ? '#8998a8' : resident.disabled ? '#fb7e89' : '#638292'} />
        <text x={labelX+3} y={labelY+11} fill="#e3f1f6" textAnchor="middle"
          fontSize="9" fontFamily="system-ui, sans-serif" fontWeight="700">{resident.label.slice(0, 12)}</text>
      </g>
    </g>
  );
}

function WaterTower({ project, level, known, exceeded }: {
  project: Project; level: number; known: boolean; exceeded: boolean;
}) {
  const [cx, groundY] = project(683, 81, 0);
  const [, topY] = project(683, 81, 249);
  const [, bottomY] = project(683, 81, 121);
  const radius = 59;
  const width = radius * 2;
  const fluidHeight = (bottomY - topY) * level;
  const fluidY = bottomY - fluidHeight;
  return (
    <g aria-label="Reservatório de consumo do Firestore" data-testid="admin-world-water-tower">
      <ellipse cx={cx} cy={groundY + 4} rx="72" ry="20" fill="#092c45" opacity=".7" />
      <path d={'M ' + (cx-43) + ' ' + (bottomY+9) + ' L ' + (cx-51) + ' ' + groundY
        + ' M ' + (cx+43) + ' ' + (bottomY+9) + ' L ' + (cx+51) + ' ' + groundY
        + ' M ' + (cx-43) + ' ' + (bottomY+45) + ' L ' + (cx+43) + ' ' + (bottomY+75)
        + ' M ' + (cx+43) + ' ' + (bottomY+45) + ' L ' + (cx-43) + ' ' + (bottomY+75)}
        fill="none" stroke="#839daa" strokeWidth="6" strokeLinecap="round" />
      <path d={'M ' + (cx-39) + ' ' + (bottomY+15) + ' H ' + (cx+39)} stroke="#b4c6cc" strokeWidth="4" />
      <rect x={cx-radius} y={topY} width={width} height={bottomY-topY} rx="12"
        fill="#b2eff2" opacity=".12" stroke="#bafaff" strokeWidth="1.5" />
      {known && level > 0 && (
        <g clipPath="url(#world-tower-clip)" data-testid="admin-world-water-fill">
          <rect x={cx-radius+2} y={fluidY} width={width-4} height={fluidHeight+11}
            fill={exceeded ? 'url(#world-water-alert)' : 'url(#world-water)'} opacity=".83" />
          <ellipse cx={cx} cy={fluidY} rx={radius-2} ry="13" fill={exceeded ? '#ffbe95' : '#8af4fb'} opacity=".7" className={styles.waterSurface} />
          <path d={'M ' + (cx-radius+7) + ' ' + (fluidY+13) + ' Q ' + cx + ' ' + (fluidY-4) + ' ' + (cx+radius-7) + ' ' + (fluidY+10)}
            stroke="#d9ffff" strokeWidth="2" opacity=".48" fill="none" />
        </g>
      )}
      <ellipse cx={cx} cy={topY} rx={radius} ry="16" fill="#96d5df" opacity=".28"
        stroke="#d1feff" strokeWidth="2" />
      <ellipse cx={cx} cy={bottomY} rx={radius} ry="14" fill="none" stroke="#b4edf2" opacity=".6" strokeWidth="2" />
      {Array.from({length:5},(_,i)=>{
        const y=topY + (bottomY-topY)*i/4;
        return <g key={i}>
          <path d={'M ' + (cx-radius-9) + ' ' + y + ' h 8'} stroke="#e2f7ff" opacity=".5" strokeWidth="1.6" />
          <text x={cx-radius-13} y={y+3} textAnchor="end" fill="#d9f3fc" fontSize="9" opacity=".66">{100-i*25}</text>
        </g>;
      })}
      <rect x={cx-39} y={topY+27} width="78" height="29" rx="7" fill="#05273b" opacity=".83" stroke="#a4e4e9" />
      <text x={cx} y={topY+40} textAnchor="middle" fill="#b4ebf6" fontSize="10" fontWeight="800" letterSpacing="1.5">FIRESTORE</text>
      <text x={cx} y={topY+51} textAnchor="middle" fill={known ? '#fff4cf' : '#91a8b9'} fontSize="10" fontWeight="700">{known ? 'CONSUMO GLOBAL' : 'SEM MEDIÇÃO'}</text>
      <path d={'M ' + (cx+radius+6) + ' ' + (topY+10) + ' v ' + (bottomY-topY+13)}
        fill="none" stroke="#88b3c1" strokeWidth="2" opacity=".62" />
      {Array.from({length:7},(_,i)=><path key={i}
        d={'M ' + (cx+radius+1) + ' ' + (topY+20+i*18) + ' h 10'}
        fill="none" stroke="#a9cbd6" strokeWidth="1.7" />)}
    </g>
  );
}

export function AdminWorldScene({
  residents, selectedId, onSelect, waterLevel, waterKnown, waterExceeded, viewAngle, zoom,
}: WorldSceneProps) {
  // Perspective is built from real x/z/height geometry; a small camera yaw is
  // supported while preserving a readable isometric neighborhood.
  const project: Project = (x,z,altitude=0) => {
    const a = viewAngle * Math.PI / 180;
    const dx = x-380;
    const dz = z-380;
    const rx = 380 + dx*Math.cos(a) - dz*Math.sin(a);
    const rz = 380 + dx*Math.sin(a) + dz*Math.cos(a);
    return [586+(rx-rz)*.82, 116+(rx+rz)*.295-altitude*1.15];
  };
  const streets = [115,279,443,607];
  const decorations = residents.flatMap((_,i)=>{
    const row = Math.floor(i/3);
    const col = i%3;
    return [
      {x:251+col*164,z:191+row*164,variety:i},
      {x:137+col*164,z:212+row*164,variety:i+1},
    ];
  });
  const landmarks = Array.from({length:52},(_,i)=>({
    x: 58+(i*73)%660, z: 55+(i*131)%655, size: 1+i%3,
  }));
  return (
    <svg className={styles.sceneSvg} viewBox="0 0 1200 675" role="img"
      aria-label="Bairro digital tridimensional: cada residência representa uma conta; janelas acesas indicam sessão válida. Caixa d'água transparente indica o percentual observado da referência diária do Firestore.">
      <defs>
        <linearGradient id="world-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#061628"/><stop offset=".48" stopColor="#13334a"/><stop offset="1" stopColor="#29495a"/></linearGradient>
        <radialGradient id="world-horizon"><stop stopColor="#51a4a7" stopOpacity=".31"/><stop offset="1" stopColor="#51a4a7" stopOpacity="0"/></radialGradient>
        <linearGradient id="world-water" x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#baf9ff"/><stop offset=".55" stopColor="#48cbdc"/><stop offset="1" stopColor="#0f87bc"/></linearGradient>
        <linearGradient id="world-water-alert"><stop stopColor="#ffe3c3"/><stop offset="1" stopColor="#ed7e78"/></linearGradient>
        <filter id="world-halo" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="8"/></filter>
        <pattern id="world-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" stroke="#c0f0f7" strokeWidth=".5" opacity=".06" fill="none"/></pattern>
        <clipPath id="world-tower-clip"><rect x={project(683,81)[0]-57} y={project(683,81,249)[1]+2} width="114" height={project(683,81,121)[1]-project(683,81,249)[1]-4} rx="10"/></clipPath>
      </defs>
      <rect width="1200" height="675" fill="url(#world-sky)" />
      <ellipse cx="780" cy="245" rx="560" ry="280" fill="url(#world-horizon)" />
      <g opacity=".42" aria-hidden="true">
        {landmarks.slice(0,30).map((item,i)=><circle key={i} cx={30+(item.x*1.65)%1160} cy={26+(item.z*.32)%175} r={item.size*.38} fill="#c4ecf1" />)}
      </g>
      <g transform={'translate(600 337) scale(' + zoom + ') translate(-600 -337)'}>
        <GroundPolygon project={project} vertices={[[30,30],[742,30],[742,742],[30,742]]} fill="#123849" stroke="#4c8292" />
        <GroundPolygon project={project} vertices={[[47,47],[725,47],[725,725],[47,725]]} fill="#22545a" opacity=".9"/>
        {streets.map((road,i)=>(
          <g key={'r-x-'+i}>
            <GroundPolygon project={project} vertices={[[road,49],[road+29,49],[road+29,720],[road,720]]} fill="#293f4f" stroke="#476477" />
            {Array.from({length:11},(_,j)=><GroundPolygon key={j} project={project}
              vertices={[[road+13,67+j*57],[road+17,67+j*57],[road+17,90+j*57],[road+13,90+j*57]]}
              fill="#b2bbbc" opacity=".45"/>)}
          </g>
        ))}
        {streets.map((road,i)=>(
          <g key={'r-z-'+i}>
            <GroundPolygon project={project} vertices={[[49,road],[720,road],[720,road+29],[49,road+29]]} fill="#2a4050" stroke="#486678" />
            {Array.from({length:11},(_,j)=><GroundPolygon key={j} project={project}
              vertices={[[64+j*56,road+12],[88+j*56,road+12],[88+j*56,road+16],[64+j*56,road+16]]}
              fill="#c6cdc9" opacity=".34"/>)}
          </g>
        ))}
        {Array.from({length:9},(_,i)=>{
          const col=i%3, row=Math.floor(i/3);
          const x=137+col*164,z=138+row*164;
          return <g key={'lot-'+i}>
            <GroundPolygon project={project} vertices={[[x,z],[x+116,z],[x+116,z+125],[x,z+125]]} fill={i%2?'#2a6464':'#2b6b65'} stroke="#64928a"/>
            <GroundPolygon project={project} vertices={[[x+3,z+3],[x+113,z+3],[x+113,z+122],[x+3,z+122]]} fill="#366e69" opacity=".42"/>
            {Array.from({length:5},(_,j)=><GroundPolygon key={j} project={project}
              vertices={[[x+8+j*19,z+111],[x+15+j*19,z+111],[x+15+j*19,z+115],[x+8+j*19,z+115]]}
              fill={j%2?'#82ad85':'#d5ad84'} opacity=".6"/>)}
          </g>;
        })}
        <WaterTower project={project} level={waterLevel} known={waterKnown} exceeded={waterExceeded} />
        {landmarks.slice(0,20).map((spot,i)=><GroundPolygon key={'stone-'+i} project={project}
          vertices={[[spot.x,spot.z],[spot.x+4,spot.z],[spot.x+4,spot.z+3],[spot.x,spot.z+3]]}
          fill={i%2?'#91bd96':'#82a4a3'} opacity=".38"/>)}
        {decorations.map((tree,i)=><Tree key={'tree-'+i} project={project} {...tree}/>)}
        {[
          [122,122],[286,122],[450,122],[614,122],
          [122,286],[286,286],[450,286],[614,286],
          [122,450],[286,450],[450,450],[614,450],
        ].map(([x,z],i)=><StreetLamp key={i} project={project} x={x} z={z} name={'Poste '+(i+1)} />)}
        {residents.map((resident,index)=>(
          <House key={resident.id} resident={resident} position={index} project={project}
            selected={selectedId===resident.id} onSelect={onSelect}/>
        ))}
        <GroundPolygon project={project} vertices={[[40,713],[731,713],[731,726],[40,726]]} fill="#0b283b" opacity=".50" />
      </g>
      <rect width="1200" height="675" fill="url(#world-grid)" pointerEvents="none"/>
      <path d="M0 0H1200V675H0Z" fill="none" stroke="#8bd4d9" strokeOpacity=".24" strokeWidth="2" />
    </svg>
  );
}
