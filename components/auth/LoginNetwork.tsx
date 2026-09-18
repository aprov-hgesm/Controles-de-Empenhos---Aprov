'use client';

const nodes = [
  { x: 132, y: 178, label: 'EMPENHO', code: 'NE' },
  { x: 330, y: 118, label: 'RECEBIMENTO', code: 'REC' },
  { x: 510, y: 258, label: 'NOTA FISCAL', code: 'NF' },
  { x: 708, y: 160, label: 'LIQUIDAÇÃO', code: 'LIQ' },
  { x: 860, y: 334, label: 'RELATÓRIOS', code: 'RLT' },
  { x: 606, y: 486, label: 'DOCUMENTOS', code: 'DOC' },
  { x: 296, y: 468, label: 'CRONOGRAMA', code: 'CRN' },
];

export function LoginNetwork() {
  return (
    <svg
      aria-hidden="true"
      className="emprovex-login-network h-full w-full"
      viewBox="0 0 1000 640"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="network-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(96,165,250,0.06)" />
          <stop offset="48%" stopColor="rgba(96,165,250,0.34)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0.08)" />
        </linearGradient>
        <radialGradient id="network-node" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(147,197,253,0.95)" />
          <stop offset="45%" stopColor="rgba(59,130,246,0.55)" />
          <stop offset="100%" stopColor="rgba(37,99,235,0)" />
        </radialGradient>
        <filter id="network-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <path id="route-a" d="M132 178 C210 116 260 116 330 118 S430 190 510 258 S628 220 708 160" />
        <path id="route-b" d="M330 118 C392 222 418 382 296 468 S490 556 606 486 S792 438 860 334" />
        <path id="route-c" d="M132 178 C160 330 192 420 296 468 C410 520 526 520 606 486" />
        <path id="route-d" d="M510 258 C590 330 650 390 606 486 C704 468 798 420 860 334" />
      </defs>

      <g className="emprovex-network-routes" fill="none" stroke="url(#network-stroke)" strokeWidth="1.15">
        <use href="#route-a" />
        <use href="#route-b" />
        <use href="#route-c" />
        <use href="#route-d" />
      </g>

      <g className="emprovex-network-routes emprovex-network-routes--signal" fill="none" strokeWidth="1.2">
        <use href="#route-a" />
        <use href="#route-b" />
        <use href="#route-c" />
      </g>

      <g className="emprovex-network-pulse" filter="url(#network-glow)">
        <circle r="3.2" fill="#93c5fd">
          <animateMotion dur="9.4s" repeatCount="indefinite">
            <mpath href="#route-a" />
          </animateMotion>
        </circle>
        <circle r="2.6" fill="#67e8f9">
          <animateMotion dur="12.8s" begin="-4.2s" repeatCount="indefinite">
            <mpath href="#route-b" />
          </animateMotion>
        </circle>
        <circle r="2.8" fill="#60a5fa">
          <animateMotion dur="11.2s" begin="-7.1s" repeatCount="indefinite">
            <mpath href="#route-c" />
          </animateMotion>
        </circle>
      </g>

      <g className="emprovex-network-nodes">
        {nodes.map((node, index) => (
          <g key={node.code} transform={`translate(${node.x} ${node.y})`}>
            <circle
              className="emprovex-network-node-halo"
              r={index === 2 ? 18 : 14}
              fill="url(#network-node)"
            />
            <circle r="4.2" fill="rgba(2,8,23,0.98)" stroke="rgba(147,197,253,0.72)" strokeWidth="1.2" />
            <circle r="1.65" fill="rgba(191,219,254,0.95)" />
            <g className="emprovex-network-label">
              <rect
                x="9"
                y="-12"
                width={node.label.length * 5.8 + 30}
                height="24"
                rx="8"
                fill="rgba(3,12,31,0.70)"
                stroke="rgba(148,181,255,0.10)"
              />
              <text
                x="19"
                y="4"
                fill="rgba(191,219,254,0.52)"
                fontSize="8.5"
                fontFamily="monospace"
                letterSpacing="1.2"
              >
                {node.code} · {node.label}
              </text>
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
