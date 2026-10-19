'use client';

import type { NeighborhoodResident } from '../../lib/adminNeighborhoodModel.mjs';
import {
  CityBuilding, CityBuildingLabel, CityLamp, CityMailbox, CityPolygon, CityTree, CityWaterTower,
  type CityPlot, type CityProject,
} from './AdminWorldArchitecture';
import styles from './AdminWorldHomePanel.module.css';

type Props = {
  residents: NeighborhoodResident[];
  founder: NeighborhoodResident | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  waterLevel: number;
  waterKnown: boolean;
  waterExceeded: boolean;
  viewAngle: number;
  zoom: number;
};

// Nine possible outer user buildings per page. Unassigned lots remain EMPTY.
// The central HGeSM account is rendered separately and never duplicated.
const USER_PLOT_INDICES = [0,3,12,14,2,10,6,9,8] as const;

export const DISTRICT_PLOTS: CityPlot[] = [
  [109,114,76,72,100],[244,113,72,72,110],[502,115,75,69,104],[634,114,75,70,103],
  [102,246,78,74,94],[243,246,72,75,82],[502,246,79,76,98],[637,247,74,69,89],
  [105,618,78,74,90],[243,502,78,76,93],[502,501,79,74,90],[635,501,75,74,98],
  [243,635,82,79,99],[502,638,75,73,93],[633,636,78,74,107],
].map(([x,z,w,d,height],seed)=>({x,z,w,d,height,seed}));

type SceneryObject = {
  kind:'building'|'tree'|'lamp'|'mail'|'tower'|'center';
  x:number;z:number; seed:number;plot?:CityPlot; resident?:NeighborhoodResident;
};
const buildings = DISTRICT_PLOTS.map((plot,i)=>({kind:'building' as const,x:plot.x+plot.w/2,z:plot.z+plot.d/2,seed:i,plot}));
const central: CityPlot={x:338,z:338,w:105,d:105,height:197,seed:19};
const mainRoads=[{from:348,to:433},{from:199,to:225},{from:577,to:603}];
function inPlot(x:number,z:number,pad:number) {
  return DISTRICT_PLOTS.some(b=>
    x>=b.x-pad&&x<=b.x+b.w+pad&&z>=b.z-pad&&z<=b.z+b.d+pad
  ) || (x>central.x-pad&&x<central.x+central.w+pad&&z>central.z-pad&&z<central.z+central.d+pad);
}
function onRoad(x:number,z:number) {
  return mainRoads.some(r=>x>=r.from-7&&x<=r.to+7||z>=r.from-7&&z<=r.to+7);
}

function sceneryObjects(residents:NeighborhoodResident[]):SceneryObject[] {
  const byPlot=new Map<number,NeighborhoodResident|undefined>(
    USER_PLOT_INDICES.map((index,i):[number,NeighborhoodResident|undefined]=>[index,residents[i]])
  );
  // No resident means no building, no inactive scenic building and no mailbox.
  const out:SceneryObject[]=buildings.filter(b=>Boolean(byPlot.get(b.seed)))
    .map(b=>({...b,resident:byPlot.get(b.seed)}));
  out.push({kind:'center',x:390,z:392,seed:39,plot:central});
  out.push({kind:'tower',x:148,z:478,seed:20});
  // Tree-lined avenues, private garden clusters, perimeter hedges.
  const treeCandidates:Array<[number,number]>=[];
  for(let i=0;i<19;i++){
    const t=55+i*37;
    treeCandidates.push([59,t],[743,t],[t,59],[t,741]);
    treeCandidates.push([323,t],[460,t],[t,323],[t,460]);
  }
  for(let i=0;i<20;i++){
    const t=65+i*32;
    treeCandidates.push([190,t],[232,t],[568,t],[611,t]);
    treeCandidates.push([t,190],[t,233],[t,568],[t,610]);
  }
  for(const b of DISTRICT_PLOTS) {
    treeCandidates.push([b.x-12,b.z-8],[b.x+b.w+12,b.z+b.d+12],
      [b.x+b.w+14,b.z-8],[b.x-10,b.z+b.d+12]);
  }
  // Tree locations are deterministic: no randomness, network or new data.
  const seen=new Set<string>();
  let treeSeed=0;
  for(const [x,z] of treeCandidates) {
    if(x<35||z<35||x>758||z>758)continue;
    if(inPlot(x,z,7)||onRoad(x,z))continue;
    if((x-148)**2+(z-478)**2<76**2)continue;
    const key=Math.round(x/12)+':'+Math.round(z/12);
    if(seen.has(key))continue;
    seen.add(key);
    out.push({kind:'tree',x,z,seed:treeSeed++});
  }
  for(let i=0;i<17;i++){
    const t=87+i*37;
    for(const [x,z] of [[334,t],[445,t],[t,335],[t,446]]) {
      if(!inPlot(x,z,10)&&((x-148)**2+(z-478)**2>82**2))
        out.push({kind:'lamp',x,z,seed:i});
    }
  }
  for(const b of DISTRICT_PLOTS) {
    if(byPlot.has(b.seed) && byPlot.get(b.seed))
      out.push({kind:'mail',x:b.x+b.w-5,z:b.z+b.d+14,seed:b.seed});
  }
  return out.sort((a,b)=>(a.x+a.z)-(b.x+b.z) ||
    (a.kind==='building'?1:-1)-(b.kind==='building'?1:-1));
}

function Road({project,along,low,high,start=35,end=765}:{
  project:CityProject;along:'x'|'z';low:number;high:number;start?:number;end?:number;
}) {
  const base=along==='x'
    ? [[low,start],[high,start],[high,end],[low,end]]
    : [[start,low],[end,low],[end,high],[start,high]];
  const side1=along==='x'
    ? [[low-7,start],[low,start],[low,end],[low-7,end]]
    : [[start,low-7],[end,low-7],[end,low],[start,low]];
  const side2=along==='x'
    ? [[high,start],[high+7,start],[high+7,end],[high,end]]
    : [[start,high],[end,high],[end,high+7],[start,high+7]];
  const lines=Array.from({length:18},(_,i)=>{
    const a=start+17+i*(end-start-20)/18;
    const b=a+16;
    if(a>315&&a<468)return null;
    const x=(low+high)/2;
    return <CityPolygon key={i} project={project}
      points={along==='x'?[[x-1,a],[x+1,a],[x+1,b],[x-1,b]]:
        [[a,x-1],[b,x-1],[b,x+1],[a,x+1]]}
      fill="#f6f7e9" opacity={.75}/>;
  });
  return <g aria-hidden="true">
    <CityPolygon project={project} points={side1 as [number,number][]} fill="#d8ded8"/>
    <CityPolygon project={project} points={side2 as [number,number][]} fill="#cbd9d5"/>
    <CityPolygon project={project} points={base as [number,number][]}
      fill="#35404c" stroke="#58636a"/>
    {lines}
  </g>;
}

function Crosswalk({project,x,z,axis}:{
  project:CityProject;x:number;z:number;axis:'x'|'z';
}) {
  return <g aria-hidden="true">{Array.from({length:8},(_,i)=>{
    const d=i*10;
    const p=axis==='x'
      ? [[x+d,z],[x+d+5,z],[x+d+5,z+12],[x+d,z+12]]
      : [[x,z+d],[x+12,z+d],[x+12,z+d+5],[x,z+d+5]];
    return <CityPolygon key={i} project={project} points={p as [number,number][]}
      fill="#f0f4eb" opacity={.91}/>;
  })}</g>;
}

function CurbedBlock({project,plot}:{
  project:CityProject;plot:CityPlot;
}) {
  const {x,z,w,d,seed}=plot;
  return <g aria-hidden="true">
    <CityPolygon project={project} points={[[x-19,z-19],[x+w+19,z-19],[x+w+19,z+d+23],[x-19,z+d+23]]}
      fill="#cddad3" stroke="#e5e8dd" strokeWidth={1.3}/>
    <CityPolygon project={project} points={[[x-15,z-15],[x+w+15,z-15],[x+w+15,z+d+18],[x-15,z+d+18]]}
      fill={seed%3===0?'#74a671':'#8db57f'}/>
    <CityPolygon project={project} points={[[x+10,z+d+7],[x+w-9,z+d+7],[x+w-9,z+d+19],[x+10,z+d+19]]}
      fill="#bac9b6" opacity={.9}/>
  </g>;
}

export function AdminWorldScene({
  residents,founder,selectedId,onSelect,waterLevel,waterKnown,waterExceeded,viewAngle,zoom,
}:Props) {
  const project:CityProject=(x,z,h=0)=>{
    const a=viewAngle*Math.PI/180;
    const dx=x-400,dz=z-400;
    const rx=400+dx*Math.cos(a)-dz*Math.sin(a);
    const rz=400+dx*Math.sin(a)+dz*Math.cos(a);
    return [600+(rx-rz)*.774,100+(rx+rz)*.325-h*.95];
  };
  const items=sceneryObjects(residents);
  const assigned = USER_PLOT_INDICES.slice(0,residents.length).map((plotIndex,i)=>({
    plot:DISTRICT_PLOTS[plotIndex],resident:residents[i],
  }));
  const occupiedPlotIndices = new Set(assigned.map(({plot})=>plot.seed));
  const corners=[
    project(24,24),project(776,24),project(776,776),project(24,776),
  ];
  const front=([x,y]:[number,number])=>[x,y+24] as [number,number];
  const coord=(points:Array<[number,number]>)=>points.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ');
  const [towerX]=project(148,478);
  const [,towerTop]=project(148,478,224);
  const [,towerBottom]=project(148,478,121);
  return (
    <svg className={styles.sceneSvg} viewBox="0 0 1200 675" role="group"
      aria-label="Maquete isométrica do bairro digital com prédios de vidro azul, jardins verdes, ruas convergentes ao centro e reservatório transparente do Firestore">
      <defs>
        <linearGradient id="district-night" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#041a2e"/><stop offset=".52" stopColor="#11374b"/><stop offset="1" stopColor="#0e3448"/>
        </linearGradient>
        <radialGradient id="district-aurora"><stop stopColor="#65bac8" stopOpacity=".28"/><stop offset="1" stopColor="#65bac8" stopOpacity="0"/></radialGradient>
        <linearGradient id="district-glass" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#b9f7f5" stopOpacity=".49"/><stop offset=".43" stopColor="#eaffff" stopOpacity=".18"/><stop offset="1" stopColor="#8fd8e7" stopOpacity=".56"/>
        </linearGradient>
        <linearGradient id="district-water" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#a5f9ff"/><stop offset=".5" stopColor="#38b7e0"/><stop offset="1" stopColor="#116db0"/>
        </linearGradient>
        <linearGradient id="district-water-alert" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#ffe3c3"/><stop offset="1" stopColor="#e88181"/>
        </linearGradient>
        <filter id="district-bloom" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="8"/>
        </filter>
        <pattern id="district-grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M36 0 H0 V36" fill="none" stroke="#9dd3dd" strokeWidth=".6" opacity=".12"/>
        </pattern>
        <clipPath id="district-tower-clip">
          <rect x={towerX-45} y={towerTop+2} width="90" height={towerBottom-towerTop-3} rx="10"/>
        </clipPath>
      </defs>
      <rect width="1200" height="675" fill="url(#district-night)"/>
      <ellipse cx="620" cy="320" rx="560" ry="350" fill="url(#district-aurora)"/>
      <rect width="1200" height="675" fill="url(#district-grid)"/>
      {Array.from({length:47},(_,i)=><circle key={i} cx={26+(i*181)%1160}
        cy={13+(i*79)%240} r={i%4===0?1.25:.65} fill="#d6f4f7"
        opacity={i%3===0?.65:.32}/>)}
      <g transform={'translate(600 337) scale('+zoom+') translate(-600 -337)'}>
        {/* Inset metallic floating pedestal with true visible side faces. */}
        <polygon points={coord([corners[3],corners[2],front(corners[2]),front(corners[3])])}
          fill="#395969" stroke="#6f9aaa" strokeWidth="1.5"/>
        <polygon points={coord([corners[2],corners[1],front(corners[1]),front(corners[2])])}
          fill="#17384d" stroke="#6d9aa8" strokeWidth="1.5"/>
        <CityPolygon project={project} points={[[24,24],[776,24],[776,776],[24,776]]}
          fill="#c2d5ca" stroke="#d2efe4" strokeWidth={3}/>
        <CityPolygon project={project} points={[[35,35],[765,35],[765,765],[35,765]]}
          fill="#7baa79" stroke="#9cc78f" strokeWidth={1.3}/>
        {/* Central avenues connect all four sides with a reserved monumental civic center. */}
        <Road project={project} along="x" low={348} high={432}/>
        <Road project={project} along="z" low={348} high={432}/>
        <Road project={project} along="x" low={199} high={226}/>
        <Road project={project} along="x" low={576} high={604}/>
        <Road project={project} along="z" low={199} high={226}/>
        <Road project={project} along="z" low={576} high={604}/>
        {[[348,318,'x'],[348,463,'x'],[318,348,'z'],[463,348,'z']].map(([x,z,d],i)=>(
          <Crosswalk key={i} project={project} x={Number(x)} z={Number(z)}
            axis={d as 'x'|'z'}/>
        ))}
        {/* Monumental central plaza, hedges and stone walkways. */}
        <CityPolygon project={project} points={[[320,320],[460,320],[460,460],[320,460]]}
          fill="#dbe1d8" stroke="#f6faf0" strokeWidth={2.4}/>
        <CityPolygon project={project} points={[[329,329],[451,329],[451,451],[329,451]]}
          fill="#92b58e" stroke="#d1dacc"/>
        <CityPolygon project={project} points={[[360,316],[420,316],[420,471],[360,471]]}
          fill="#c5d5cb" opacity={.8}/>
        <CityPolygon project={project} points={[[316,359],[465,359],[465,419],[316,419]]}
          fill="#c5d5cb" opacity={.7}/>
        {DISTRICT_PLOTS.map(plot=><CurbedBlock key={plot.seed} project={project} plot={plot}/>)}
        {/* Only empty plot foundations are shown until an actual account occupies them. */}
        {DISTRICT_PLOTS.filter(plot=>!occupiedPlotIndices.has(plot.seed)).map(plot=>{
          const inset=12;
          const x=plot.x+inset, z=plot.z+inset, w=plot.w-2*inset, d=plot.d-2*inset;
          const [cx,cy]=project(plot.x+plot.w/2,plot.z+plot.d/2,1);
          return <g key={'vacant-'+plot.seed} data-testid="admin-world-vacant-lot"
            data-plot-index={plot.seed} aria-label="Lote reservado para futuro usuário">
            <title>Lote vazio — aguardando cadastro de usuário</title>
            <CityPolygon project={project} points={[[x,z,1],[x+w,z,1],[x+w,z+d,1],[x,z+d,1]]}
              fill="#9dbb96" opacity={.47} stroke="#deebe0" strokeWidth={1.3}/>
            <circle cx={cx} cy={cy} r="9" fill="#527e77" opacity={.8}/>
            <path d={'M '+(cx-4)+' '+cy+' h 8 M '+cx+' '+(cy-4)+' v 8'}
              stroke="#e5f5e9" strokeWidth="1.5" strokeLinecap="round"/>
          </g>;
        })}
        {/* 3D structures and vegetation are painter-sorted for correct overlap. */}
        {items.map((item,i)=>{
          if(item.kind==='building'&&item.plot) return <CityBuilding key={'building'+item.seed}
            project={project} plot={item.plot} resident={item.resident}
            selected={item.resident?.id===selectedId} onSelect={onSelect}/>;
          if(item.kind==='center'&&item.plot) return <CityBuilding key="emprovex-central" project={project}
            plot={item.plot} central resident={founder||undefined}
            selected={founder?.id===selectedId} onSelect={onSelect}/>;
          if(item.kind==='tower') return <CityWaterTower key="firestore" project={project}
            level={waterLevel} known={waterKnown} exceeded={waterExceeded}/>;
          if(item.kind==='tree')return <CityTree key={'tree'+i} project={project} x={item.x} z={item.z} seed={item.seed}/>;
          if(item.kind==='lamp')return <CityLamp key={'lamp'+i} project={project} x={item.x} z={item.z}/>;
          return <CityMailbox key={'mail'+i} project={project} x={item.x} z={item.z}/>;
        })}
        {/* Topmost pass: all owner names float ABOVE roofs, never at street level. */}
        {assigned.map(({plot,resident})=><CityBuildingLabel key={'label-'+resident.id}
          project={project} plot={plot} resident={resident}/>)}
        <CityBuildingLabel project={project} plot={central} resident={founder||undefined} central/>
      </g>
      <path d="M.5.5 H1199.5 V674.5 H.5 Z" fill="none" stroke="#8ac1cc" strokeOpacity=".13"/>
    </svg>
  );
}
