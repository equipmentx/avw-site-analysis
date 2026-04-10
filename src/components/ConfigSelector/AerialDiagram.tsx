"use client";

/**
 * AerialDiagram — top-down SVG floor plan for each car wash configuration.
 *
 * Cars enter from the LEFT (west) and exit to the RIGHT (east).
 * ViewBox: 0 0 520 300
 */

const C = {
  bg:          "#080f1f",
  pavement:    "#111827",
  concrete:    "#1a2235",
  road:        "#060d1a",
  roadMark:    "#fbbf24",
  building:    "#1e3a5f",
  buildingAlt: "#172d4a",
  tunnelOpen:  "#1d4ed8",
  tunnelInner: "#1e40af",
  roof:        "#0f2040",
  roofLine:    "#2563eb",
  equipment:   "#374151",
  equipLine:   "#4b5563",
  vacuum:      "#134e4a",
  vacLine:     "#0f766e",
  kiosk:       "#4c1d95",
  kioskLight:  "#6d28d9",
  landscape:   "#14532d",
  grass:       "#15803d",
  arrow:       "#60a5fa",
  arrowDim:    "#3b82f6",
  label:       "#64748b",
  labelBright: "#94a3b8",
  dim:         "#334155",
  stripe:      "#ffffff18",
  laneDash:    "#ffffff22",
  selfBay:     "#1e3a5f",
  selfBayLine: "#2563eb",
  wand:        "#0f766e",
  ev:          "#065f46",
  evLine:      "#10b981",
  detail:      "#1e1b4b",
  detailLine:  "#7c3aed",
};

// ── Shared primitives ──────────────────────────────────────────────────────────

function Arrow({ x1, y1, x2, y2, color = C.arrow }: { x1: number; y1: number; x2: number; y2: number; color?: string }) {
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5}
      strokeDasharray="4 2" markerEnd="url(#arrowhead)" opacity={0.7} />
  );
}

function Label({ x, y, text, size = 7, color = C.label, anchor = "middle" }: {
  x: number; y: number; text: string; size?: number; color?: string; anchor?: string;
}) {
  return (
    <text x={x} y={y} fontSize={size} fill={color} textAnchor={anchor as "middle" | "start" | "end"}
      fontFamily="system-ui,sans-serif" fontWeight="500" letterSpacing="0.03em">
      {text}
    </text>
  );
}

function VacuumIsland({ x, y, w = 14, h = 22 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={C.vacuum} stroke={C.vacLine} strokeWidth={0.8} />
      <circle cx={x + w / 2} cy={y + h / 2} r={3} fill={C.vacLine} opacity={0.6} />
    </g>
  );
}

function Kiosk({ x, y }: { x: number; y: number }) {
  return (
    <rect x={x} y={y} width={12} height={18} rx={2} fill={C.kiosk} stroke={C.kioskLight} strokeWidth={0.8} />
  );
}

function LaneStripe({ x, y, len, vertical = false }: { x: number; y: number; len: number; vertical?: boolean }) {
  if (vertical) {
    return <line x1={x} y1={y} x2={x} y2={y + len} stroke={C.laneDash} strokeWidth={1} strokeDasharray="6 4" />;
  }
  return <line x1={x} y1={y} x2={x + len} y2={y} stroke={C.laneDash} strokeWidth={1} strokeDasharray="6 4" />;
}

function Landscaping({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.landscape} />
      {Array.from({ length: Math.floor(w / 18) }).map((_, i) => (
        <circle key={i} cx={x + 9 + i * 18} cy={y + h / 2} r={4} fill={C.grass} opacity={0.7} />
      ))}
    </g>
  );
}

// ── DEFS ─────────────────────────────────────────────────────────────────────

function Defs() {
  return (
    <defs>
      <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
        <polygon points="0 0, 6 2, 0 4" fill={C.arrow} opacity={0.7} />
      </marker>
      <pattern id="concretePattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill={C.concrete} />
        <line x1="0" y1="20" x2="20" y2="0" stroke={C.stripe} strokeWidth={0.4} />
      </pattern>
      <pattern id="grassPattern" patternUnits="userSpaceOnUse" width="8" height="8">
        <rect width="8" height="8" fill={C.landscape} />
        <circle cx="4" cy="4" r="1.5" fill={C.grass} opacity={0.5} />
      </pattern>
    </defs>
  );
}

// ── Tunnel building helper ────────────────────────────────────────────────────

function TunnelBuilding({
  x, y, w, h, label, sublabel, archCount = 6, variant,
}: {
  x: number; y: number; w: number; h: number;
  label: string; sublabel?: string;
  archCount?: number; variant?: string;
}) {
  const archColor = variant === "touchless" ? C.evLine : C.roofLine;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.building} stroke={C.roofLine} strokeWidth={1.2} rx={2} />
      {/* Entry opening */}
      <rect x={x} y={y + 14} width={10} height={h - 28} fill={C.tunnelOpen} opacity={0.9} />
      {/* Interior conveyor */}
      <rect x={x + 10} y={y + h * 0.28} width={w - 20} height={h * 0.44}
        fill={C.tunnelInner} opacity={0.2} rx={1} />
      {/* Arch marks */}
      {Array.from({ length: archCount }).map((_, i) => (
        <rect key={i} x={x + 16 + i * Math.floor((w - 30) / archCount)} y={y + 8} width={2} height={h - 16}
          fill={archColor} opacity={0.28} />
      ))}
      {/* Exit opening */}
      <rect x={x + w - 10} y={y + 14} width={10} height={h - 28} fill={C.tunnelOpen} opacity={0.9} />
      {/* Labels */}
      <Label x={x + w / 2} y={y + h / 2 + 4} text={label} size={8} color={C.labelBright} />
      {sublabel && <Label x={x + w / 2} y={y + h / 2 + 16} text={sublabel} size={6} color={C.label} />}
    </g>
  );
}

// ── Layout 1: Express / Conveyor Tunnel (parameterized) ───────────────────────

function ExpressTunnelLayout({
  tunnelW = 170, label = "130FT TUNNEL", variant,
}: {
  tunnelW?: number; label?: string; variant?: string;
}) {
  const tunnelX  = 100;
  const tunnelY  = 100;
  const tunnelH  = 100;
  const exitX    = tunnelX + tunnelW;
  const vacStart = Math.min(exitX + 30, 370);
  const vacCols  = exitX < 300 ? 4 : 3;

  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <LaneStripe x={0} y={11}  len={520} />
      <LaneStripe x={0} y={289} len={520} />
      <rect x={0} y={22} width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={22} />
      <Landscaping x={0} y={256} w={520} h={22} />

      {/* Stacking lanes */}
      <rect x={0} y={78} width={95} height={144} fill={C.pavement} rx={4} />
      <LaneStripe x={0} y={150} len={95} />
      <Arrow x1={20} y1={118} x2={82} y2={118} />
      <Arrow x1={20} y1={182} x2={82} y2={182} />

      {/* Pay kiosks */}
      <Kiosk x={88} y={tunnelY + 12} />
      <Kiosk x={88} y={tunnelY + tunnelH - 30} />
      <Label x={85} y={tunnelY + 8} text="PAY" size={5.5} color={C.kioskLight} anchor="end" />

      <TunnelBuilding
        x={tunnelX} y={tunnelY} w={tunnelW} h={tunnelH}
        label={label} sublabel="CONVEYOR"
        archCount={Math.max(4, Math.floor(tunnelW / 28))}
        variant={variant}
      />

      {/* Exit canopy */}
      <rect x={exitX} y={tunnelY + 5} width={26} height={tunnelH - 10}
        fill={C.roof} stroke={C.roofLine} strokeWidth={0.8} opacity={0.7} rx={2} />
      <Label x={exitX + 13} y={tunnelY + 56} text="EXIT" size={5} color={C.label} />

      {/* Vacuum stations */}
      {Array.from({ length: 6 }).map((_, i) => {
        const col = i % vacCols;
        const row = Math.floor(i / vacCols);
        return <VacuumIsland key={i} x={vacStart + col * 24} y={tunnelY + 8 + row * 40} />;
      })}
      <Label x={vacStart + vacCols * 12} y={tunnelY + 94} text="VACUUMS" size={6} color={C.label} />

      <Arrow x1={34} y1={150} x2={tunnelX - 6} y2={150} color={C.arrowDim} />
    </g>
  );
}

// ── Layout 2: Flex-Serve ──────────────────────────────────────────────────────

function FlexServeLayout() {
  const tunnelX = 100; const tunnelY = 95; const tunnelW = 170; const tunnelH = 90;
  const exitX = tunnelX + tunnelW; const finishX = exitX + 20;
  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={18} />
      <Landscaping x={0} y={260} w={520} h={18} />
      <rect x={0} y={80} width={95} height={140} fill={C.pavement} rx={3} />
      <LaneStripe x={0} y={150} len={95} />
      <Arrow x1={18} y1={115} x2={80} y2={115} />
      <Arrow x1={18} y1={185} x2={80} y2={185} />
      <Kiosk x={88} y={tunnelY + 8} />
      <Kiosk x={88} y={tunnelY + tunnelH - 28} />
      <TunnelBuilding x={tunnelX} y={tunnelY} w={tunnelW} h={tunnelH} label="130FT TUNNEL" />
      {/* Interior finish bays */}
      <rect x={finishX} y={tunnelY - 12} width={130} height={tunnelH + 24}
        fill={C.buildingAlt} stroke={C.roofLine} strokeWidth={1} rx={3} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={finishX + 8 + i * 28} y={tunnelY} width={22} height={tunnelH}
          fill={C.pavement} stroke={C.dim} strokeWidth={0.6} rx={2} />
      ))}
      <Label x={finishX + 65} y={tunnelY + 46} text="FINISH BAYS" size={7} color={C.labelBright} />
      <Label x={finishX + 65} y={tunnelY + 58} text="INTERIOR SERVICE" size={5.5} color={C.label} />
      {[0, 1, 2].map((i) => <VacuumIsland key={i} x={400 + i * 26} y={120} />)}
      <Label x={416} y={160} text="VACUUM" size={6} color={C.label} />
      <Arrow x1={30} y1={150} x2={tunnelX - 6} y2={150} color={C.arrowDim} />
    </g>
  );
}

// ── Layout 3: Full-Service ────────────────────────────────────────────────────

function FullServiceLayout() {
  const tunnelX = 95; const tunnelY = 90; const tunnelW = 165; const tunnelH = 95;
  const exitX = tunnelX + tunnelW; const detailX = exitX + 16;
  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={18} />
      <Landscaping x={0} y={260} w={520} h={18} />
      <rect x={0} y={78} width={90} height={144} fill={C.pavement} rx={3} />
      <LaneStripe x={0} y={150} len={90} />
      <Arrow x1={16} y1={113} x2={76} y2={113} />
      <Arrow x1={16} y1={188} x2={76} y2={188} />
      <Kiosk x={84} y={tunnelY + 8} />
      <Kiosk x={84} y={tunnelY + tunnelH - 28} />
      <TunnelBuilding x={tunnelX} y={tunnelY} w={tunnelW} h={tunnelH} label="130FT TUNNEL" />
      {/* Detail bays */}
      <rect x={detailX} y={tunnelY - 18} width={145} height={tunnelH + 36}
        fill={C.buildingAlt} stroke={C.roofLine} strokeWidth={1} rx={3} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={detailX + 6 + i * 26} y={tunnelY - 8} width={20} height={tunnelH + 16}
          fill={C.pavement} stroke={C.dim} strokeWidth={0.6} rx={2} />
      ))}
      <Label x={detailX + 72} y={tunnelY + 45} text="DETAIL BAYS" size={7} color={C.labelBright} />
      <Label x={detailX + 72} y={tunnelY + 57} text="INTERIOR + DRY" size={5.5} color={C.label} />
      {/* Lounge */}
      <rect x={460} y={tunnelY - 18} width={50} height={tunnelH + 36}
        fill={C.buildingAlt} stroke={C.dim} strokeWidth={0.8} rx={3} />
      <Label x={485} y={tunnelY + 45} text="LOUNGE" size={5.5} color={C.label} />
      <Arrow x1={26} y1={150} x2={tunnelX - 6} y2={150} color={C.arrowDim} />
    </g>
  );
}

// ── Layout 4: Tunnel + Detail Combo ──────────────────────────────────────────

function TunnelDetailComboLayout() {
  const tunnelX = 100; const tunnelY = 88; const tunnelW = 175; const tunnelH = 96;
  const exitX = tunnelX + tunnelW;
  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={18} />
      <Landscaping x={0} y={260} w={520} h={18} />

      {/* Stacking */}
      <rect x={0} y={76} width={95} height={148} fill={C.pavement} rx={3} />
      <LaneStripe x={0} y={150} len={95} />
      <Arrow x1={18} y1={114} x2={82} y2={114} />
      <Arrow x1={18} y1={186} x2={82} y2={186} />
      <Kiosk x={88} y={tunnelY + 10} />
      <Kiosk x={88} y={tunnelY + tunnelH - 28} />

      <TunnelBuilding x={tunnelX} y={tunnelY} w={tunnelW} h={tunnelH} label="130FT TUNNEL" sublabel="EXPRESS" />

      {/* Detail garage — distinct purple tones */}
      <rect x={exitX + 14} y={tunnelY - 20} width={150} height={tunnelH + 40}
        fill={C.detail} stroke={C.detailLine} strokeWidth={1.2} rx={4} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={exitX + 22 + i * 44} y={tunnelY - 8} width={34} height={tunnelH + 16}
            fill={C.pavement} stroke={C.detailLine} strokeWidth={0.8} rx={3} />
          <Label x={exitX + 39 + i * 44} y={tunnelY + tunnelH / 2 + 4} text={`D${i + 1}`} size={7} color={C.detailLine} />
        </g>
      ))}
      <Label x={exitX + 89} y={tunnelY - 8} text="DETAILING" size={7} color="#a78bfa" />

      {/* Vacuum */}
      {[0, 1, 2].map((i) => <VacuumIsland key={i} x={440 + i * 24} y={118} />)}
      <Label x={454} y={165} text="VAC" size={5.5} color={C.label} />

      <Arrow x1={30} y1={150} x2={tunnelX - 6} y2={150} color={C.arrowDim} />
    </g>
  );
}

// ── Layout 5: Single In-Bay ───────────────────────────────────────────────────

function InBaySingleLayout() {
  const bayX = 190; const bayY = 90; const bayW = 140; const bayH = 120;
  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={20} />
      <Landscaping x={0} y={258} w={520} h={20} />
      <rect x={0} y={90} width={bayX} height={120} fill={C.pavement} rx={3} />
      <LaneStripe x={0} y={150} len={bayX} />
      <Arrow x1={20} y1={150} x2={bayX - 5} y2={150} />
      <rect x={bayX} y={bayY} width={bayW} height={bayH}
        fill={C.building} stroke={C.roofLine} strokeWidth={1.5} rx={4} />
      <rect x={bayX} y={bayY + 20} width={12} height={bayH - 40} fill={C.tunnelOpen} opacity={0.9} />
      {/* Gantry */}
      <rect x={bayX + 20} y={bayY + 10} width={bayW - 40} height={8}
        fill={C.equipment} stroke={C.equipLine} strokeWidth={0.8} rx={2} />
      <rect x={bayX + 20} y={bayY + bayH - 18} width={bayW - 40} height={8}
        fill={C.equipment} stroke={C.equipLine} strokeWidth={0.8} rx={2} />
      <rect x={bayX + bayW / 2 - 8} y={bayY + 18} width={16} height={bayH - 36}
        fill={C.equipment} stroke={C.equipLine} strokeWidth={0.8} rx={2} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={bayX + 30 + i * 30} cy={bayY + bayH / 2} r={4}
          fill={C.tunnelOpen} opacity={0.5} />
      ))}
      <Label x={bayX + bayW / 2} y={bayY + 62} text="IN-BAY" size={9} color={C.labelBright} />
      <Label x={bayX + bayW / 2} y={bayY + 75} text="AUTOMATIC" size={7} color={C.label} />
      <rect x={bayX + bayW - 12} y={bayY + 20} width={12} height={bayH - 40} fill={C.tunnelOpen} opacity={0.9} />
      <Kiosk x={bayX - 16} y={bayY + 51} />
      <Label x={bayX - 8} y={bayY + 46} text="PAY" size={5} color={C.kioskLight} />
      <rect x={bayX + bayW} y={90} width={520 - bayX - bayW} height={120} fill={C.pavement} rx={3} />
      <LaneStripe x={bayX + bayW} y={150} len={520 - bayX - bayW} />
      <Arrow x1={bayX + bayW + 10} y1={150} x2={500} y2={150} />
      <VacuumIsland x={bayX + bayW + 30} y={96} h={26} />
      <VacuumIsland x={bayX + bayW + 30} y={178} h={26} />
      <Label x={bayX + bayW + 37} y={166} text="VAC" size={5.5} color={C.label} />
    </g>
  );
}

// ── Layout 6: Dual In-Bay ─────────────────────────────────────────────────────

function InBayDualLayout() {
  const startX = 110; const bayY = 80; const bayW = 130; const bayH = 140; const gap = 16;
  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={18} />
      <Landscaping x={0} y={260} w={520} h={18} />

      {[0, 1].map((i) => {
        const bx = startX + i * (bayW + gap);
        return (
          <g key={i}>
            <rect x={bx} y={bayY} width={bayW} height={bayH}
              fill={C.building} stroke={C.roofLine} strokeWidth={1.2} rx={3} />
            <rect x={bx} y={bayY + 22} width={11} height={bayH - 44} fill={C.tunnelOpen} opacity={0.9} />
            <rect x={bx + bayW - 11} y={bayY + 22} width={11} height={bayH - 44} fill={C.tunnelOpen} opacity={0.9} />
            {/* Gantry rails */}
            <rect x={bx + 14} y={bayY + 8} width={bayW - 28} height={7}
              fill={C.equipment} stroke={C.equipLine} strokeWidth={0.6} rx={2} />
            <rect x={bx + 14} y={bayY + bayH - 15} width={bayW - 28} height={7}
              fill={C.equipment} stroke={C.equipLine} strokeWidth={0.6} rx={2} />
            <rect x={bx + bayW / 2 - 7} y={bayY + 15} width={14} height={bayH - 30}
              fill={C.equipment} stroke={C.equipLine} strokeWidth={0.6} rx={2} />
            <circle cx={bx + 32} cy={bayY + bayH / 2} r={4} fill={C.tunnelOpen} opacity={0.45} />
            <circle cx={bx + bayW - 32} cy={bayY + bayH / 2} r={4} fill={C.tunnelOpen} opacity={0.45} />
            <Label x={bx + bayW / 2} y={bayY + bayH / 2 + 5} text={`BAY ${i + 1}`} size={8} color={C.labelBright} />
            <Arrow x1={bx - 28} y1={bayY + bayH / 2} x2={bx - 2} y2={bayY + bayH / 2} />
            <Kiosk x={bx + bayW / 2 - 6} y={bayY - 24} />
          </g>
        );
      })}

      {/* Shared approach pavement */}
      <rect x={0} y={bayY} width={startX} height={bayH} fill={C.pavement} opacity={0.5} />
      {/* Exit + vacuum */}
      <rect x={startX + 2 * bayW + gap} y={bayY} width={520 - startX - 2 * bayW - gap} height={bayH} fill={C.pavement} opacity={0.4} />
      <VacuumIsland x={startX + 2 * bayW + gap + 20} y={bayY + 20} />
      <VacuumIsland x={startX + 2 * bayW + gap + 20} y={bayY + 80} />

      <Label x={startX + bayW + gap / 2} y={264} text="DUAL IN-BAY AUTOMATIC" size={7} color={C.dim} />
    </g>
  );
}

// ── Layout 7: Triple In-Bay ───────────────────────────────────────────────────

function InBayTripleLayout() {
  const startX = 70; const bayY = 75; const bayW = 108; const bayH = 150; const gap = 10;
  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={18} />
      <Landscaping x={0} y={260} w={520} h={18} />

      {[0, 1, 2].map((i) => {
        const bx = startX + i * (bayW + gap);
        return (
          <g key={i}>
            <rect x={bx} y={bayY} width={bayW} height={bayH}
              fill={C.building} stroke={C.roofLine} strokeWidth={1.2} rx={3} />
            <rect x={bx} y={bayY + 22} width={10} height={bayH - 44} fill={C.tunnelOpen} opacity={0.9} />
            <rect x={bx + bayW - 10} y={bayY + 22} width={10} height={bayH - 44} fill={C.tunnelOpen} opacity={0.9} />
            <rect x={bx + 12} y={bayY + 8} width={bayW - 24} height={7}
              fill={C.equipment} stroke={C.equipLine} strokeWidth={0.6} rx={2} />
            <rect x={bx + 12} y={bayY + bayH - 15} width={bayW - 24} height={7}
              fill={C.equipment} stroke={C.equipLine} strokeWidth={0.6} rx={2} />
            <rect x={bx + bayW / 2 - 6} y={bayY + 15} width={12} height={bayH - 30}
              fill={C.equipment} stroke={C.equipLine} strokeWidth={0.6} rx={2} />
            <circle cx={bx + 28} cy={bayY + bayH / 2} r={3} fill={C.tunnelOpen} opacity={0.4} />
            <circle cx={bx + bayW - 28} cy={bayY + bayH / 2} r={3} fill={C.tunnelOpen} opacity={0.4} />
            <Label x={bx + bayW / 2} y={bayY + bayH / 2 + 4} text={`BAY ${i + 1}`} size={7} color={C.labelBright} />
            <Arrow x1={bx - 30} y1={bayY + bayH / 2} x2={bx - 2} y2={bayY + bayH / 2} />
            <Kiosk x={bx + bayW / 2 - 6} y={bayY - 22} />
          </g>
        );
      })}

      <rect x={0} y={75} width={startX} height={150} fill={C.pavement} opacity={0.5} />
      <rect x={startX + 3 * bayW + 2 * gap} y={75}
        width={520 - startX - 3 * bayW - 2 * gap} height={150} fill={C.pavement} opacity={0.5} />
      <VacuumIsland x={430} y={92} />
      <VacuumIsland x={460} y={92} />
      <VacuumIsland x={430} y={182} />
      <VacuumIsland x={460} y={182} />
      <Label x={455} y={152} text="VAC" size={5.5} color={C.label} />
      <Label x={startX + (3 * bayW + 2 * gap) / 2} y={252} text="TRIPLE IN-BAY AUTOMATIC" size={7} color={C.dim} />
    </g>
  );
}

// ── Layout 8: Self-Serve (parameterized 4 / 6 / 8 bays) ──────────────────────

function SelfServeLayout({ bays = 6 }: { bays?: number }) {
  const perRow  = bays <= 4 ? bays : Math.ceil(bays / 2);
  const rows    = bays <= 4 ? 1 : 2;
  const bayW    = bays <= 4 ? 80 : 62;
  const bayH    = 100;
  const gap     = 8;
  const totalW  = perRow * bayW + (perRow - 1) * gap;
  const startX  = Math.max(30, (520 - totalW - 80) / 2);
  const row1Y   = rows === 1 ? 105 : 58;
  const row2Y   = rows === 1 ? 105 : 180;
  const aisleY  = row1Y + bayH + 2;
  const aisleH  = rows === 2 ? row2Y - aisleY - 2 : 0;

  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={16} />
      <Landscaping x={0} y={262} w={520} h={16} />

      {rows === 2 && (
        <>
          <rect x={startX - 20} y={aisleY} width={520 - startX + 10} height={aisleH} fill={C.pavement} rx={2} />
          <LaneStripe x={startX - 20} y={aisleY + aisleH / 2} len={500} />
          <Arrow x1={startX + 10} y1={aisleY + aisleH / 2} x2={startX + totalW / 2} y2={aisleY + aisleH / 2} />
          <Label x={startX + totalW / 2} y={aisleY + aisleH / 2 + 3} text="DRIVE AISLE" size={6} color={C.dim} />
        </>
      )}

      {/* Row 1 */}
      {Array.from({ length: perRow }).map((_, i) => {
        const bx = startX + i * (bayW + gap);
        const n  = i + 1;
        return (
          <g key={i}>
            <rect x={bx} y={row1Y} width={bayW} height={bayH}
              fill={C.selfBay} stroke={C.selfBayLine} strokeWidth={1} rx={3} />
            <rect x={bx + 10} y={row1Y + bayH - 8} width={bayW - 20} height={8}
              fill={C.tunnelOpen} opacity={0.7} />
            <line x1={bx + bayW / 2} y1={row1Y + 18} x2={bx + bayW / 2} y2={row1Y + bayH - 18}
              stroke={C.wand} strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={bx + bayW / 2} cy={row1Y + 16} r={5} fill={C.wand} opacity={0.6} />
            <Label x={bx + bayW / 2} y={row1Y + bayH / 2 + 10} text={`BAY ${n}`} size={6} color={C.labelBright} />
            <Kiosk x={bx + bayW / 2 - 6} y={row1Y - 22} />
          </g>
        );
      })}

      {/* Row 2 (if needed) */}
      {rows === 2 && Array.from({ length: bays - perRow }).map((_, i) => {
        const bx = startX + i * (bayW + gap);
        const n  = perRow + i + 1;
        return (
          <g key={i}>
            <rect x={bx} y={row2Y} width={bayW} height={bayH}
              fill={C.selfBay} stroke={C.selfBayLine} strokeWidth={1} rx={3} />
            <rect x={bx + 10} y={row2Y} width={bayW - 20} height={8}
              fill={C.tunnelOpen} opacity={0.7} />
            <line x1={bx + bayW / 2} y1={row2Y + 18} x2={bx + bayW / 2} y2={row2Y + bayH - 18}
              stroke={C.wand} strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={bx + bayW / 2} cy={row2Y + bayH - 16} r={5} fill={C.wand} opacity={0.6} />
            <Label x={bx + bayW / 2} y={row2Y + bayH / 2 + 4} text={`BAY ${n}`} size={6} color={C.labelBright} />
            <Kiosk x={bx + bayW / 2 - 6} y={row2Y + bayH + 6} />
          </g>
        );
      })}

      {/* Vacuum on right */}
      {[0, 1, 2].map((i) => <VacuumIsland key={i} x={startX + totalW + 16} y={100 + i * 34} />)}
      <Label x={startX + totalW + 23} y={208} text="VAC" size={5.5} color={C.label} />
      <Label x={startX + totalW / 2} y={290} text={`${bays}-BAY SELF-SERVE`} size={7} color={C.dim} />
    </g>
  );
}

// ── Layout 9: Tunnel + Self-Serve Combo ──────────────────────────────────────

function TunnelComboLayout() {
  const tunnelX = 100; const tunnelY = 52; const tunnelW = 175; const tunnelH = 88;
  const exitX = tunnelX + tunnelW; const vacX = exitX + 26;
  const bayY = 178; const bayW = 58; const bayH = 80; const bayGap = 7;

  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={16} />
      <Landscaping x={0} y={262} w={520} h={16} />

      <line x1={0} y1={172} x2={520} y2={172} stroke={C.dim} strokeWidth={0.6} strokeDasharray="8 4" />
      <Label x={8} y={170} text="EXPRESS TUNNEL" size={5.5} color={C.dim} anchor="start" />
      <Label x={8} y={292} text="SELF-SERVE BAYS" size={5.5} color={C.dim} anchor="start" />

      <rect x={0} y={42} width={95} height={108} fill={C.pavement} rx={3} />
      <LaneStripe x={0} y={96} len={95} />
      <Arrow x1={16} y1={72} x2={82} y2={72} />
      <Arrow x1={16} y1={120} x2={82} y2={120} />
      <Kiosk x={88} y={tunnelY + 6} />
      <Kiosk x={88} y={tunnelY + tunnelH - 24} />

      <TunnelBuilding x={tunnelX} y={tunnelY} w={tunnelW} h={tunnelH} label="130FT TUNNEL" />

      {[0, 1, 2, 3].map((i) => <VacuumIsland key={i} x={vacX + i * 22} y={tunnelY + 10} />)}
      <Label x={vacX + 44} y={tunnelY + 82} text="VACUUM" size={5.5} color={C.label} />

      {[0, 1, 2, 3].map((i) => {
        const bx = tunnelX + i * (bayW + bayGap);
        return (
          <g key={i}>
            <rect x={bx} y={bayY} width={bayW} height={bayH}
              fill={C.selfBay} stroke={C.selfBayLine} strokeWidth={1} rx={3} />
            <rect x={bx + 8} y={bayY} width={bayW - 16} height={7} fill={C.tunnelOpen} opacity={0.6} />
            <line x1={bx + bayW / 2} y1={bayY + 14} x2={bx + bayW / 2} y2={bayY + bayH - 12}
              stroke={C.wand} strokeWidth={2} strokeLinecap="round" />
            <Label x={bx + bayW / 2} y={bayY + bayH / 2 + 4} text={`B${i + 1}`} size={6} color={C.labelBright} />
          </g>
        );
      })}

      <Arrow x1={26} y1={96} x2={tunnelX - 6} y2={96} color={C.arrowDim} />
    </g>
  );
}

// ── Layout 10: In-Bay + Self-Serve Combo ──────────────────────────────────────

function InBaySelfServeComboLayout() {
  const bayX = 100; const bayY = 60; const bayW = 150; const bayH = 130;
  const ssY  = 210; const ssW = 70; const ssH = 60; const ssGap = 10;

  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={16} />
      <Landscaping x={0} y={262} w={520} h={16} />

      <line x1={0} y1={202} x2={520} y2={202} stroke={C.dim} strokeWidth={0.6} strokeDasharray="6 4" />
      <Label x={8} y={200} text="IN-BAY AUTOMATIC" size={5.5} color={C.dim} anchor="start" />
      <Label x={8} y={292} text="SELF-SERVE BAYS" size={5.5} color={C.dim} anchor="start" />

      {/* Approach lane */}
      <rect x={0} y={bayY} width={bayX} height={bayH} fill={C.pavement} rx={3} />
      <LaneStripe x={0} y={bayY + bayH / 2} len={bayX} />
      <Arrow x1={16} y1={bayY + bayH / 2} x2={bayX - 6} y2={bayY + bayH / 2} />

      {/* In-bay */}
      <rect x={bayX} y={bayY} width={bayW} height={bayH}
        fill={C.building} stroke={C.roofLine} strokeWidth={1.5} rx={4} />
      <rect x={bayX} y={bayY + 22} width={12} height={bayH - 44} fill={C.tunnelOpen} opacity={0.9} />
      <rect x={bayX + bayW - 12} y={bayY + 22} width={12} height={bayH - 44} fill={C.tunnelOpen} opacity={0.9} />
      <rect x={bayX + 18} y={bayY + 8} width={bayW - 36} height={8} fill={C.equipment} stroke={C.equipLine} strokeWidth={0.8} rx={2} />
      <rect x={bayX + 18} y={bayY + bayH - 16} width={bayW - 36} height={8} fill={C.equipment} stroke={C.equipLine} strokeWidth={0.8} rx={2} />
      <rect x={bayX + bayW / 2 - 8} y={bayY + 16} width={16} height={bayH - 32} fill={C.equipment} stroke={C.equipLine} strokeWidth={0.8} rx={2} />
      <Label x={bayX + bayW / 2} y={bayY + bayH / 2 + 5} text="IN-BAY AUTO" size={8} color={C.labelBright} />
      <Kiosk x={bayX - 16} y={bayY + bayH / 2 - 9} />

      {/* Exit */}
      <rect x={bayX + bayW} y={bayY} width={80} height={bayH} fill={C.pavement} rx={3} />
      <Arrow x1={bayX + bayW + 10} y1={bayY + bayH / 2} x2={bayX + bayW + 70} y2={bayY + bayH / 2} />
      <VacuumIsland x={bayX + bayW + 22} y={bayY + 20} />
      <VacuumIsland x={bayX + bayW + 22} y={bayY + 80} />

      {/* Self-serve bays */}
      {[0, 1, 2].map((i) => {
        const bx = bayX + i * (ssW + ssGap);
        return (
          <g key={i}>
            <rect x={bx} y={ssY} width={ssW} height={ssH}
              fill={C.selfBay} stroke={C.selfBayLine} strokeWidth={1} rx={3} />
            <rect x={bx + 8} y={ssY} width={ssW - 16} height={6} fill={C.tunnelOpen} opacity={0.6} />
            <line x1={bx + ssW / 2} y1={ssY + 14} x2={bx + ssW / 2} y2={ssY + ssH - 10}
              stroke={C.wand} strokeWidth={2} strokeLinecap="round" />
            <Label x={bx + ssW / 2} y={ssY + ssH / 2 + 4} text={`SS ${i + 1}`} size={6} color={C.labelBright} />
            <Kiosk x={bx + ssW / 2 - 6} y={ssY + ssH + 4} />
          </g>
        );
      })}

      <Label x={260} y={264} text="IN-BAY + SELF-SERVE COMBO" size={7} color={C.dim} />
    </g>
  );
}

// ── Layout 11: Hand Wash ──────────────────────────────────────────────────────

function HandWashLayout() {
  const stallW = 70; const stallH = 110; const gap = 10;
  const stalls = 4; const startX = 60; const stallY = 90;
  const totalW = stalls * stallW + (stalls - 1) * gap;

  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={18} />
      <Landscaping x={0} y={260} w={520} h={18} />

      {/* Approach lane */}
      <rect x={0} y={stallY} width={startX} height={stallH} fill={C.pavement} rx={3} />
      <Arrow x1={10} y1={stallY + stallH / 2} x2={startX - 4} y2={stallY + stallH / 2} />

      {Array.from({ length: stalls }).map((_, i) => {
        const bx = startX + i * (stallW + gap);
        return (
          <g key={i}>
            <rect x={bx} y={stallY} width={stallW} height={stallH}
              fill={C.buildingAlt} stroke={C.roofLine} strokeWidth={1} rx={3} />
            {/* Entry */}
            <rect x={bx} y={stallY + 20} width={8} height={stallH - 40} fill={C.tunnelOpen} opacity={0.8} />
            {/* Exit */}
            <rect x={bx + stallW - 8} y={stallY + 20} width={8} height={stallH - 40} fill={C.tunnelOpen} opacity={0.8} />
            {/* Person icon */}
            <circle cx={bx + stallW / 2} cy={stallY + 35} r={8} fill={C.equipment} />
            <rect x={bx + stallW / 2 - 6} y={stallY + 44} width={12} height={20} rx={3} fill={C.equipment} />
            {/* Hose */}
            <path d={`M ${bx + stallW / 2 + 6} ${stallY + 50} Q ${bx + stallW / 2 + 20} ${stallY + 70} ${bx + stallW / 2 + 10} ${stallY + 88}`}
              stroke={C.wand} strokeWidth={2.5} fill="none" strokeLinecap="round" />
            <Label x={bx + stallW / 2} y={stallY + stallH - 10} text={`STALL ${i + 1}`} size={6} color={C.labelBright} />
          </g>
        );
      })}

      {/* Equipment/supply room */}
      <rect x={startX + totalW + 12} y={stallY} width={70} height={stallH}
        fill={C.equipment} stroke={C.equipLine} strokeWidth={1} rx={3} />
      <Label x={startX + totalW + 47} y={stallY + stallH / 2} text="EQUIP" size={6} color={C.labelBright} />
      <Label x={startX + totalW + 47} y={stallY + stallH / 2 + 12} text="ROOM" size={6} color={C.label} />

      {/* Vacuum */}
      <VacuumIsland x={startX + totalW + 90} y={stallY + 20} />
      <VacuumIsland x={startX + totalW + 90} y={stallY + 72} />

      {/* Exit lane */}
      <rect x={startX + totalW} y={stallY} width={startX} height={stallH} fill={C.pavement} rx={3} />
      <Arrow x1={startX + totalW + 4} y1={stallY + stallH / 2} x2={startX + totalW + 50} y2={stallY + stallH / 2} />

      <Label x={startX + totalW / 2} y={264} text="HAND CAR WASH — DETAILING STALLS" size={7} color={C.dim} />
    </g>
  );
}

// ── Layout 12: EV Express ─────────────────────────────────────────────────────

function EvExpressLayout() {
  const tunnelX = 95; const tunnelY = 98; const tunnelW = 175; const tunnelH = 96;
  const exitX   = tunnelX + tunnelW;
  const evX     = exitX + 30;

  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <LaneStripe x={0} y={11}  len={520} />
      <LaneStripe x={0} y={289} len={520} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={22} />
      <Landscaping x={0} y={256} w={520} h={22} />

      {/* Stacking */}
      <rect x={0} y={78} width={90} height={148} fill={C.pavement} rx={4} />
      <LaneStripe x={0} y={150} len={90} />
      <Arrow x1={18} y1={116} x2={78} y2={116} />
      <Arrow x1={18} y1={184} x2={78} y2={184} />
      <Kiosk x={84} y={tunnelY + 12} />
      <Kiosk x={84} y={tunnelY + tunnelH - 30} />

      <TunnelBuilding
        x={tunnelX} y={tunnelY} w={tunnelW} h={tunnelH}
        label="EXPRESS TUNNEL" sublabel="EV COMPATIBLE"
        variant="touchless"
      />

      {/* Vacuum */}
      {[0, 1, 2].map((i) => <VacuumIsland key={i} x={evX} y={tunnelY + 6 + i * 32} />)}
      <Label x={evX + 7} y={tunnelY + 104} text="VAC" size={5.5} color={C.label} />

      {/* EV charging canopy */}
      <rect x={evX + 28} y={tunnelY - 8} width={140} height={tunnelH + 16}
        fill={C.ev} stroke={C.evLine} strokeWidth={1.2} rx={4} />
      {/* Charging stalls */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={evX + 36 + i * 30} y={tunnelY + 8} width={22} height={tunnelH - 16}
            fill={C.pavement} stroke={C.evLine} strokeWidth={0.7} rx={2} />
          {/* Lightning bolt */}
          <text x={evX + 47 + i * 30} y={tunnelY + tunnelH / 2 + 5} fontSize={14} fill={C.evLine}
            textAnchor="middle" fontFamily="system-ui,sans-serif">⚡</text>
        </g>
      ))}
      <Label x={evX + 98} y={tunnelY - 11} text="EV CHARGING" size={6.5} color={C.evLine} />
      <Label x={evX + 98} y={tunnelY + tunnelH + 20} text="8 CHARGING STALLS" size={5.5} color={C.label} />

      <Arrow x1={30} y1={150} x2={tunnelX - 6} y2={150} color={C.arrowDim} />
    </g>
  );
}

// ── Layout 13: Mobile / Container ────────────────────────────────────────────

function MobileLayout() {
  return (
    <g>
      <rect x={0} y={0}   width={520} height={22} fill={C.road} />
      <rect x={0} y={278} width={520} height={22} fill={C.road} />
      <rect x={0} y={22}  width={520} height={256} fill="url(#concretePattern)" />
      <Landscaping x={0} y={22}  w={520} h={14} />
      <Landscaping x={0} y={264} w={520} h={14} />

      {/* Parking lot base */}
      <rect x={20} y={50} width={480} height={220} fill={C.pavement} rx={6} />

      {/* Parking bays */}
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={30 + i * 58} y={58} width={50} height={90}
          fill={C.concrete} stroke={C.dim} strokeWidth={0.6} rx={2} />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={30 + i * 58} y={172} width={50} height={90}
          fill={C.concrete} stroke={C.dim} strokeWidth={0.6} rx={2} />
      ))}

      {/* Drive aisle */}
      <rect x={20} y={150} width={480} height={20} fill={C.pavement} />
      <LaneStripe x={30} y={160} len={460} />

      {/* Container/trailer unit */}
      <rect x={170} y={66} width={130} height={74} rx={4}
        fill="#1e293b" stroke={C.evLine} strokeWidth={2} />
      {/* Container ribs */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={170 + 22 + i * 22} y1={66} x2={170 + 22 + i * 22} y2={140}
          stroke={C.dim} strokeWidth={0.8} />
      ))}
      {/* Pump unit */}
      <rect x={180} y={78} width={36} height={50} rx={3} fill={C.equipment} stroke={C.equipLine} strokeWidth={1} />
      <circle cx={198} cy={96} r={8} fill={C.vacLine} opacity={0.6} />
      <Label x={198} y={129} text="PUMP UNIT" size={5} color={C.evLine} />

      {/* Hose reel */}
      <circle cx={252} cy={100} r={18} fill={C.equipment} stroke={C.equipLine} strokeWidth={1} />
      <circle cx={252} cy={100} r={8}  fill={C.wand} opacity={0.4} />
      <Label x={252} y={132} text="HOSE" size={5} color={C.label} />

      {/* Water tank */}
      <rect x={285} y={78} width={40} height={52} rx={4} fill="#0c4a6e" stroke="#0284c7" strokeWidth={1} />
      <Label x={305} y={108} text="TANK" size={5.5} color="#7dd3fc" />

      {/* Service vehicle */}
      <rect x={30} y={68} width={110} height={72} rx={5} fill="#1e3a5f" stroke={C.roofLine} strokeWidth={1} />
      <rect x={40} y={74} width={40} height={28} rx={3} fill="#172d4a" />
      <circle cx={55}  cy={140} r={10} fill={C.equipment} />
      <circle cx={120} cy={140} r={10} fill={C.equipment} />
      <Label x={85} y={106} text="SERVICE VAN" size={5.5} color={C.labelBright} />

      <Label x={220} y={60} text="MOBILE WASH UNIT" size={7} color={C.evLine} />
      <Label x={260} y={272} text="MOBILE / CONTAINER FORMAT — MINIMAL SITE FOOTPRINT" size={6.5} color={C.dim} />
    </g>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  diagramType: string;
  diagramParams?: Record<string, unknown>;
  className?: string;
}

export default function AerialDiagram({ diagramType, diagramParams = {}, className = "" }: Props) {
  let diagram: React.ReactNode;

  switch (diagramType) {
    case "express-tunnel":
      diagram = (
        <ExpressTunnelLayout
          tunnelW={(diagramParams.tunnelW as number) ?? 170}
          label={(diagramParams.label as string) ?? "TUNNEL"}
          variant={diagramParams.variant as string | undefined}
        />
      );
      break;
    case "flex-serve":
      diagram = <FlexServeLayout />;
      break;
    case "full-service":
      diagram = <FullServiceLayout />;
      break;
    case "tunnel-detail-combo":
      diagram = <TunnelDetailComboLayout />;
      break;
    case "inbay-single":
      diagram = <InBaySingleLayout />;
      break;
    case "inbay-dual":
      diagram = <InBayDualLayout />;
      break;
    case "inbay-triple":
      diagram = <InBayTripleLayout />;
      break;
    case "self-serve":
      diagram = <SelfServeLayout bays={(diagramParams.bays as number) ?? 6} />;
      break;
    case "tunnel-combo":
      diagram = <TunnelComboLayout />;
      break;
    case "inbay-selfserve-combo":
      diagram = <InBaySelfServeComboLayout />;
      break;
    case "hand-wash":
      diagram = <HandWashLayout />;
      break;
    case "ev-express":
      diagram = <EvExpressLayout />;
      break;
    case "mobile":
      diagram = <MobileLayout />;
      break;
    default:
      diagram = (
        <text x="260" y="150" fill={C.label} textAnchor="middle" fontSize="12">
          Diagram not available
        </text>
      );
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <svg
        viewBox="0 0 520 300"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <Defs />
        <rect width="520" height="300" fill={C.bg} />
        {diagram}
      </svg>
    </div>
  );
}
