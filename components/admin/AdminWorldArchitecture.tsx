'use client';

import type { KeyboardEvent } from 'react';
import type { NeighborhoodResident } from '../../lib/adminNeighborhoodModel.mjs';
import styles from './AdminWorldHomePanel.module.css';

export type CityProject = (x: number, z: number, height?: number) => [number, number];
type Point3 = [number, number, number?];

export function cityPoints(project: CityProject, coordinates: Point3[]): string {
  return coordinates.map(([x,z,h=0]) => project(x,z,h).map(v => v.toFixed(2)).join(',')).join(' ');
}
export function CityPolygon({project, points, fill, stroke, opacity=1, strokeWidth=1}:{
  project: CityProject; points: Point3[]; fill: string; stroke?: string; opacity?: number; strokeWidth?: number;
}) {
  return <polygon points={cityPoints(project,points)} fill={fill} stroke={stroke}
    strokeWidth={strokeWidth} opacity={opacity} strokeLinejoin="round"/>;
}

export type CityPlot = {
  x: number; z: number; w: number; d: number; height: number; seed: number;
};
const whites = ['#f2f6f0','#f9f7ed','#dae9e8','#ecf3fa','#e9eee8'];
const sideWhites = ['#b8cdd0','#c6d4d2','#adc8cc','#bacbd8','#b5cbc5'];

function FacadeWindow({project,x,z,height,face,lit,seed}:{
  project:CityProject; x:number; z:number; height:number;
  face:'front'|'side'; lit:boolean; seed:number;
}) {
  const w=8, h=12;
  const outline: Point3[] = face === 'front'
    ? [[x,z+.18,height],[x+w,z+.18,height],[x+w,z+.18,height+h],[x,z+.18,height+h]]
    : [[x+.18,z,height],[x+.18,z+w,height],[x+.18,z+w,height+h],[x+.18,z,height+h]];
  const shine = lit && (seed%7===0 || seed%7===3 || seed%7===5);
  const glass = shine ? '#ffcf8e' : '#2e83ad';
  return (
    <g aria-hidden="true">
      <CityPolygon project={project} points={outline} fill="#f2f8f8" opacity={.98}/>
      <CityPolygon project={project} points={outline.map(([px,pz,ph])=>[px+(face==='front' ? (px===x?.85:-.85) : 0),pz+(face==='side' ? (pz===z?.85:-.85) : 0),(ph||0)+(ph===height?.9:-.9)] as Point3)}
        fill={glass} opacity={shine?1:.95} className={shine?styles.litWindow:undefined}/>
      {shine && <CityPolygon project={project} points={outline} fill="#ffd27d" opacity={.18} />}
    </g>
  );
}

/** A central administration tower is symbolic infrastructure, never an additional fake user. */
export function CityBuilding({project, plot, resident, selected=false, onSelect, central=false}:{
  project:CityProject; plot: CityPlot; resident?:NeighborhoodResident; selected?:boolean;
  onSelect?:(id:string)=>void; central?:boolean;
}) {
  const {x,z,w,d,height,seed}=plot;
  const h=height;
  const isPerson=Boolean(resident);
  const lit=resident?.presence==='online';
  const known=resident?.presence!=='unknown';
  const frontZ=z+d;
  const frontX=x+w;
  const floors=central?6:Math.max(2,Math.min(5,Math.floor((height-15)/23)));
  const frontWindows=Math.max(2,Math.floor((w-14)/18));
  const sideWindows=Math.max(2,Math.floor((d-14)/19));
  const frontStep=(w-22)/frontWindows, sideStep=(d-22)/sideWindows;
  const [cx,cy]=project(x+w/2,z+d/2);
  const [lx,ly]=project(x+w/2,z+d+18,6);
  const id=resident?.id||'';
  const handleKey=(e:KeyboardEvent<SVGGElement>)=>{
    if(resident && (e.key==='Enter'||e.key===' ')) {e.preventDefault();onSelect?.(id);}
  };
  return (
    <g role={isPerson?'button':undefined} tabIndex={isPerson?0:undefined}
      aria-label={resident ? resident.email+' · '+(lit?'sessão válida':resident.presence==='unknown'?'presença indisponível':resident.disabled?'conta suspensa':'sem sessão válida') : central?'Centro da plataforma EMPROVEX':undefined}
      aria-pressed={isPerson?selected:undefined} onKeyDown={handleKey}
      onClick={resident?()=>onSelect?.(id):undefined}
      className={isPerson?styles.houseGroup:undefined} data-presence={resident?.presence}
      data-resident-id={resident?.id}>
      <title>{resident ? resident.email : central?'EMPROVEX · Centro administrativo':'Edifício cenográfico'}</title>
      {selected&&<ellipse cx={cx} cy={cy+9} rx={86} ry={42} fill="#80ffda" opacity={.27} filter="url(#district-bloom)"/>}
      <CityPolygon project={project} points={[[x-9,z-9],[x+w+9,z-9],[x+w+9,z+d+12],[x-9,z+d+12]]}
        fill={central?'#cdd5d2':'#b9c9bc'} stroke={selected?'#72f9e2':'#eff9ef'} strokeWidth={central?3:1.5}/>
      <CityPolygon project={project} points={[[x-3,z-3],[x+w+3,z-3],[x+w+3,z+d+3],[x-3,z+d+3]]} fill="#a3c5a5"/>
      <CityPolygon project={project} points={[[x,z,0],[x+w,z,0],[x+w,z+d,0],[x,z+d,0]]}
        fill="#a5bac5"/>
      {/* Visible glazed x+ and z+ walls, lightly shaded to enforce the perspective. */}
      <CityPolygon project={project} points={[[x,z+d,0],[x+w,z+d,0],[x+w,z+d,h],[x,z+d,h]]}
        fill={whites[seed%whites.length]} stroke="#c8dbda"/>
      <CityPolygon project={project} points={[[x+w,z,0],[x+w,z+d,0],[x+w,z+d,h],[x+w,z,h]]}
        fill={sideWhites[seed%sideWhites.length]} stroke="#8caeb8"/>
      {/* Architectural corner piers and facade lines. */}
      {Array.from({length:floors},(_,floor)=>{
        const altitude=15+floor*23;
        if(altitude+15>=h) return null;
        return <g key={floor}>
          {Array.from({length:frontWindows},(_,j)=><FacadeWindow key={'f'+j}
            project={project} x={x+11+j*frontStep} z={frontZ+1.2} height={altitude}
            face="front" lit={lit} seed={seed+j+floor*3}/>)}
          {Array.from({length:sideWindows},(_,j)=><FacadeWindow key={'s'+j}
            project={project} x={frontX+1.2} z={z+11+j*sideStep} height={altitude}
            face="side" lit={lit} seed={seed+j*2+floor*4}/>)}
        </g>;
      })}
      {Array.from({length:Math.max(0,floors-1)},(_,j)=>(
        <g key={'band'+j}>
          <CityPolygon project={project} points={[[x,frontZ+1,12+(j+1)*23],[frontX,frontZ+1,12+(j+1)*23],[frontX,frontZ+1,14+(j+1)*23],[x,frontZ+1,14+(j+1)*23]]}
            fill="#e4f0e8" opacity={.93}/>
        </g>
      ))}
      <CityPolygon project={project} points={[[x,z,h],[x+w,z,h],[x+w,z+d,h],[x,z+d,h]]}
        fill="#f7fbf1" stroke="#d9ebe3" strokeWidth={2}/>
      <CityPolygon project={project} points={[[x+5,z+5,h+.6],[x+w-5,z+5,h+.6],[x+w-5,z+d-5,h+.6],[x+5,z+d-5,h+.6]]}
        fill={central?'#b3d9c0':'#78ad67'} stroke="#b5d9a1"/>
      {/* Flat green roof, small rooftop services and paving. */}
      <CityPolygon project={project} points={[[x+12,z+13,h+1],[x+26,z+13,h+1],[x+26,z+30,h+1],[x+12,z+30,h+1]]}
        fill="#e0e9e6" stroke="#f2f3ef"/>
      <CityPolygon project={project} points={[[x+15,z+16,h+5],[x+24,z+16,h+5],[x+24,z+25,h+5],[x+15,z+25,h+5]]} fill="#829e9e"/>
      {!central&&<CityPolygon project={project} points={[[x+w-19,z+d-22,h+1],[x+w-9,z+d-22,h+1],[x+w-9,z+d-12,h+1],[x+w-19,z+d-12,h+1]]}
        fill="#e1eadb"/>}
      {/* Wide entrance canopy and warm lobby of the central building. */}
      {central ? (
        <g>
          <CityPolygon project={project} points={[[x+w*.22,frontZ+2,0],[x+w*.66,frontZ+2,0],[x+w*.66,frontZ+2,31],[x+w*.22,frontZ+2,31]]}
            fill="#245a7f" stroke="#ebfaf1"/>
          <CityPolygon project={project} points={[[x+w*.16,frontZ-2,32],[x+w*.74,frontZ-2,32],[x+w*.74,frontZ+17,32],[x+w*.16,frontZ+17,32]]}
            fill="#e2ede7" stroke="#c4dfd6"/>
          <CityPolygon project={project} points={[[x+w*.29,frontZ+2,6],[x+w*.59,frontZ+2,6],[x+w*.59,frontZ+2,26],[x+w*.29,frontZ+2,26]]}
            fill="#b1e9ff" opacity={.85}/>
        </g>
      ):(
        <CityPolygon project={project} points={[[x+w*.38,frontZ+1,0],[x+w*.64,frontZ+1,0],[x+w*.64,frontZ+1,18],[x+w*.38,frontZ+1,18]]}
          fill={lit?'#ffc986':known?'#376780':'#6e8496'} stroke="#e1f5f1"/>
      )}
      {isPerson&&(
        <g pointerEvents="none">
          <rect x={lx-55} y={ly-2} width="110" height="19" rx="8"
            fill={selected?'#06465b':'#061d31'} opacity={.94}
            stroke={selected?'#8ff5e2':'#66909e'} strokeWidth=".9"/>
          <circle cx={lx-44} cy={ly+7.5} r="3.2"
            fill={lit?'#ffd37b':!known?'#bac9d3':resident?.disabled?'#fb8490':'#7398af'}/>
          <text x={lx+5} y={ly+11.2} textAnchor="middle" fill="#f2fbff" fontSize="9" fontWeight="750"
            fontFamily="system-ui,sans-serif">{resident?.label.slice(0,12)}</text>
        </g>
      )}
      {central&&<g>
        <rect x={project(x+w/2,frontZ+14,38)[0]-38} y={project(x+w/2,frontZ+14,38)[1]-12}
          width="76" height="19" rx="4" fill="#072841" opacity={.96} stroke="#d7e8e2"/>
        <text x={project(x+w/2,frontZ+14,38)[0]} y={project(x+w/2,frontZ+14,38)[1]+1}
          textAnchor="middle" fill="#f7fffa" fontSize="10" fontWeight="800">EMPROVEX</text>
      </g>}
    </g>
  );
}

export function CityTree({project,x,z,seed=0}:{
  project:CityProject; x:number; z:number; seed?:number;
}) {
  const [bx,by]=project(x,z,0);
  const tall=29+(seed%4)*5;
  const [tx,ty]=project(x,z,tall);
  const r=10+(seed%3)*2.2;
  const tone=seed%3;
  return <g aria-hidden="true">
    <ellipse cx={bx+4} cy={by+5} rx={r*1.8} ry={r*.45} fill="#072d31" opacity={.28}/>
    <path d={'M '+bx+' '+by+' L '+tx+' '+(ty+6)} stroke="#786d5c" strokeWidth="3" strokeLinecap="round"/>
    <circle cx={tx-6} cy={ty+3} r={r*.92} fill={tone===0?'#316d38':tone===1?'#306f43':'#286b49'}/>
    <circle cx={tx+5} cy={ty+1} r={r} fill={tone===0?'#418945':tone===1?'#4a9853':'#3a8b56'}/>
    <circle cx={tx-1} cy={ty-6} r={r*.9} fill={tone===0?'#63a35b':tone===1?'#64ae67':'#5aa976'}/>
    <ellipse cx={tx-6} cy={ty-8} rx={r*.36} ry="3" fill="#bce89d" opacity={.35}/>
  </g>;
}

export function CityLamp({project,x,z}:{project:CityProject;x:number;z:number}) {
  const [bx,by]=project(x,z);
  const [tx,ty]=project(x,z,45);
  return <g aria-hidden="true">
    <line x1={bx} y1={by} x2={tx} y2={ty} stroke="#b4bdaf" strokeWidth="2.6"/>
    <line x1={tx} y1={ty} x2={tx-8} y2={ty-6} stroke="#cdd7be" strokeWidth="2.6"/>
    <ellipse cx={tx-8} cy={ty-6} rx="11" ry="7" fill="#ffd886" opacity={.37} filter="url(#district-bloom)"/>
    <circle cx={tx-8} cy={ty-6} r="3" fill="#fff3c3" className={styles.lampGlow}/>
  </g>;
}

export function CityMailbox({project,x,z}:{project:CityProject;x:number;z:number}) {
  const [bx,by]=project(x,z);
  const [tx,ty]=project(x,z,14);
  return <g aria-hidden="true">
    <path d={'M '+bx+' '+by+' L '+tx+' '+ty} stroke="#728d91" strokeWidth="2"/>
    <rect x={tx-5} y={ty-5} width="10" height="8" rx="2" fill="#d7e7e2" stroke="#6b8fa3"/>
    <path d={'M '+(tx+3)+' '+(ty-5)+' v -4'} stroke="#e66562" strokeWidth="2"/>
  </g>;
}

export function CityWaterTower({project,level,known,exceeded}:{
  project:CityProject;level:number;known:boolean;exceeded:boolean;
}) {
  const [cx,ground]=project(148,478,0);
  const [,top]=project(148,478,224);
  const [,bottom]=project(148,478,121);
  const radius=47;
  const waterHeight=(bottom-top)*level;
  const fluidY=bottom-waterHeight;
  return <g aria-label="Reservatório de consumo do Firestore" data-testid="admin-world-water-tower">
    <ellipse cx={cx} cy={ground+8} rx="64" ry="15" fill="#163d49" opacity={.3}/>
    {[-36,36].map((dx,i)=><path key={i}
      d={'M '+(cx+dx)+' '+(bottom+2)+' L '+(cx+dx*1.35)+' '+ground}
      fill="none" stroke={i?'#e5e9e5':'#a8c5cb'} strokeWidth="5.2" strokeLinecap="round"/>)}
    <path d={'M '+(cx-42)+' '+(bottom+31)+' L '+(cx+45)+' '+(bottom+72)
      +' M '+(cx+42)+' '+(bottom+31)+' L '+(cx-45)+' '+(bottom+72)
      +' M '+(cx-47)+' '+(bottom+78)+' H '+(cx+47)}
      fill="none" stroke="#b0c2c5" strokeWidth="4" opacity={.95}/>
    <rect x={cx-radius} y={top} width={radius*2} height={bottom-top} rx="11"
      fill="url(#district-glass)" stroke="#bceaf0" strokeWidth="1.8" opacity={.91}/>
    {known&&level>0&&<g clipPath="url(#district-tower-clip)" data-testid="admin-world-water-fill">
      <rect x={cx-radius+2} y={fluidY} width={radius*2-4} height={waterHeight+5}
        fill={exceeded?'url(#district-water-alert)':'url(#district-water)'} opacity={.84}/>
      <ellipse cx={cx} cy={fluidY} rx={radius-3} ry="9" fill={exceeded?'#ffd2a6':'#9ef6fa'}
        opacity={.9} className={styles.waterSurface}/>
    </g>}
    <path d={'M '+(cx-29)+' '+(top+9)+' V '+(bottom-7)} fill="none" stroke="#efffff" strokeWidth="3" opacity={.20}/>
    <ellipse cx={cx} cy={bottom} rx={radius} ry="13" fill="none" stroke="#bceaf0" strokeWidth="2"/>
    <ellipse cx={cx} cy={top} rx={radius+2} ry="16" fill="#d8f4f2" opacity={.66} stroke="#f8ffff" strokeWidth="2"/>
    <path d={'M '+(cx-radius-5)+' '+(top-3)+' Q '+cx+' '+(top-47)+' '+(cx+radius+5)+' '+(top-3)}
      fill="none" stroke="#d6e3e2" strokeWidth="7"/>
    <rect x={cx-39} y={top+27} width="78" height="30" rx="6" fill="#0b3e64" opacity={.9} stroke="#bceaf0"/>
    <text x={cx} y={top+41} textAnchor="middle" fontSize="11" fill="#f0ffff" fontWeight="850">FIRESTORE</text>
    <text x={cx} y={top+53} textAnchor="middle" fontSize="9" fill="#d3f9fe" fontWeight="700">{known?'CONSUMO':'SEM MEDIÇÃO'}</text>
    <path d={'M '+(cx+radius+9)+' '+(top+2)+' V '+bottom} stroke="#d0e7ea" strokeWidth="1.5" opacity={.7}/>
    {Array.from({length:5},(_,i)=><g key={i}>
      <path d={'M '+(cx+radius+6)+' '+(top+i*(bottom-top)/4)+' h 9'} stroke="#d9f8fe" strokeWidth="1.5"/>
      <text x={cx+radius+18} y={top+i*(bottom-top)/4+3} fill="#ebfbfc" fontSize="9">{100-i*25}</text>
    </g>)}
  </g>;
}
