import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BUILDING_POSITIONS,
  NPC_POSITIONS,
  TREE_POSITIONS,
  STONE_POSITIONS,
  PLOT_POSITIONS,
} from "@/phaser/positions";

export const Route = createFileRoute("/map-editor")({
  component: MapEditor,
  head: () => ({
    meta: [
      { title: "Map Editor | Lucky Frog Farm" },
      { name: "description", content: "Drag farm objects on the full-screen tile map and copy the updated position JSON." },
      { property: "og:title", content: "Map Editor | Lucky Frog Farm" },
      { property: "og:description", content: "Drag farm objects on the full-screen tile map and copy the updated position JSON." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TILE = 16;
/** Match the in-game camera zoom (GAME_CONFIG.ZOOM). */
const GAME_ZOOM = 4;

type Group = "trees" | "stones" | "plots" | "buildings" | "npcs";

type Marker = {
  key: string;
  group: Group;
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  label: string;
  sprite?: string;
};

const BUILDING_SPRITES: Record<string, string> = {
  house: "/assets/buildings/house.png",
  market: "/assets/buildings/market_building.png",
  kitchen: "/assets/buildings/kitchen_building.png",
  blacksmith: "/assets/buildings/blacksmith_building.png",
  bank: "/assets/buildings/tailor.gif",
  wishing_well: "/assets/buildings/wishing_well.png",
  summoning_shrine: "/assets/buildings/hatchery.png",
  cabin: "/assets/buildings/cabin.png",
};

const GROUP_LABEL: Record<Group, string> = {
  trees: "Trees",
  stones: "Stones",
  plots: "Plots",
  buildings: "Buildings",
  npcs: "NPCs",
};

function buildMarkers(): Marker[] {
  const out: Marker[] = [];
  TREE_POSITIONS.forEach((t) =>
    out.push({ key: `tree:${t.id}`, group: "trees", id: t.id, x: t.x, y: t.y, w: 2, h: 2, color: "#2f7d32", label: "T", sprite: "/assets/resources/tree_node.png" })
  );
  STONE_POSITIONS.forEach((s) =>
    out.push({ key: `stone:${s.id}`, group: "stones", id: s.id, x: s.x, y: s.y, w: 2, h: 2, color: "#6b7280", label: "S", sprite: "/assets/resources/stone_node.png" })
  );
  PLOT_POSITIONS.forEach((p) =>
    out.push({ key: `plot:${p.id}`, group: "plots", id: p.id, x: p.x, y: p.y, w: 1, h: 1, color: "#a16207", label: "P", sprite: "/assets/land/soil2.png" })
  );
  BUILDING_POSITIONS.forEach((b) =>
    out.push({
      key: `building:${b.type}`,
      group: "buildings",
      id: b.type,
      x: b.x,
      y: b.y,
      w: b.width,
      h: b.height,
      color: "#7c3aed",
      label: b.type,
      sprite: BUILDING_SPRITES[b.type],
    })
  );
  NPC_POSITIONS.forEach((n) =>
    out.push({ key: `npc:${n.id}`, group: "npcs", id: n.id, x: n.x, y: n.y, w: n.width, h: n.height, color: "#dc2626", label: n.name ?? "NPC", sprite: "/assets/npcs/idle.gif" })
  );
  return out;
}

function MapEditor() {
  const [markers, setMarkers] = useState<Marker[]>(() => buildMarkers());
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [jsonGroup, setJsonGroup] = useState<Group | null>(null);
  const [mapSize, setMapSize] = useState({ w: 40, h: 40 });
  const [showGrid, setShowGrid] = useState(true);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewport, setViewport] = useState({ w: 1280, h: 720 });
  const [zoom, setZoom] = useState(GAME_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragOff = useRef({ dx: 0, dy: 0 });
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Same scale as the game camera: 16px tiles rendered at zoom×.
  const PX = TILE * zoom;
  const mapW = mapSize.w * PX;
  const mapH = mapSize.h * PX;

  const clampOffset = useCallback(
    (o: { x: number; y: number }, w: number, h: number) => ({
      x: w <= viewport.w ? (viewport.w - w) / 2 : Math.min(0, Math.max(viewport.w - w, o.x)),
      y: h <= viewport.h ? (viewport.h - h) / 2 : Math.min(0, Math.max(viewport.h - h, o.y)),
    }),
    [viewport]
  );

  useEffect(() => {
    setOffset((o) => clampOffset(o, mapW, mapH));
  }, [clampOffset, mapW, mapH]);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Wheel = zoom around the cursor (non-passive so the page never scrolls).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      setZoom((z: number) => {
        const next = Math.min(8, Math.max(1, z * Math.exp(-dy * 0.0015)));
        const k = next / z;
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        setOffset((o) => clampOffset(
          { x: px - (px - o.x) * k, y: py - (py - o.y) * k },
          mapSize.w * TILE * next,
          mapSize.h * TILE * next,
        ));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clampOffset, mapSize]);

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      const res = await fetch("/assets/phaser/maps/farm.json");
      const map = await res.json();
      if (cancelled) return;
      setMapSize({ w: map.width, h: map.height });
      const img = new Image();
      img.src = "/assets/phaser/tiles/spr_tileset_sunnysideworld_16px.png";
      await img.decode();
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = map.width * TILE;
      canvas.height = map.height * TILE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      const cols = map.tilesets[0].columns as number;
      for (const layer of map.layers) {
        if (layer.type !== "tilelayer" || !layer.visible) continue;
        if (String(layer.name).startsWith("boundary") || String(layer.name).startsWith("bondary")) continue;
        for (let i = 0; i < layer.data.length; i += 1) {
          const gid = layer.data[i];
          if (!gid) continue;
          const sx = ((gid - 1) % cols) * TILE;
          const sy = Math.floor((gid - 1) / cols) * TILE;
          const dx = (i % map.width) * TILE;
          const dy = Math.floor(i / map.width) * TILE;
          ctx.drawImage(img, sx, sy, TILE, TILE, dx, dy, TILE, TILE);
        }
      }
    }
    void draw();
    return () => {
      cancelled = true;
    };
  }, []);

  const clampTo = useCallback(
    (m: Marker, x: number, y: number) => ({
      x: Math.min(Math.max(0, x), Math.max(0, mapSize.w - m.w)),
      y: Math.min(Math.max(0, y), Math.max(0, mapSize.h - m.h)),
    }),
    [mapSize]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragKey) return;
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gx = Math.floor((e.clientX - rect.left) / PX) - dragOff.current.dx;
      const gy = Math.floor((e.clientY - rect.top) / PX) - dragOff.current.dy;
      setMarkers((prev) =>
        prev.map((m) => {
          if (m.key !== dragKey) return m;
          const next = clampTo(m, gx, gy);
          if (m.x !== next.x || m.y !== next.y) setMoved(true);
          return { ...m, ...next };
        })
      );
    },
    [dragKey, PX, clampTo]
  );

  // Arrow keys nudge the selected asset by one tile.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const move = moves[e.key];
      if (!move) return;
      e.preventDefault();
      setMarkers((prev) => prev.map((m) => (m.key === selected ? { ...m, ...clampTo(m, m.x + move[0], m.y + move[1]) } : m)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, clampTo]);

  const json = useMemo(() => {
    const get = (g: Group) => markers.filter((m) => m.group === g);
    return JSON.stringify(
      {
        trees: get("trees").map((m) => ({ id: m.id, x: m.x, y: m.y })),
        stones: get("stones").map((m) => ({ id: m.id, x: m.x, y: m.y })),
        plots: get("plots").map((m, i) => ({ id: m.id, fieldIndex: PLOT_POSITIONS[i]?.fieldIndex ?? i, x: m.x, y: m.y })),
        buildings: get("buildings").map((m) => ({ type: m.id, x: m.x, y: m.y, width: m.w, height: m.h })),
        npcs: get("npcs").map((m) => ({ id: m.id, x: m.x, y: m.y, width: m.w, height: m.h })),
      },
      null,
      2
    );
  }, [markers]);

  const filteredJson = useMemo(() => {
    if (!jsonGroup) return json;
    const get = (g: Group) => markers.filter((m) => m.group === g);
    let data: Record<string, unknown> = {};
    switch (jsonGroup) {
      case "trees":
        data = { trees: get("trees").map((m) => ({ id: m.id, x: m.x, y: m.y })) };
        break;
      case "stones":
        data = { stones: get("stones").map((m) => ({ id: m.id, x: m.x, y: m.y })) };
        break;
      case "plots":
        data = { plots: get("plots").map((m, i) => ({ id: m.id, fieldIndex: PLOT_POSITIONS[i]?.fieldIndex ?? i, x: m.x, y: m.y })) };
        break;
      case "buildings":
        data = { buildings: get("buildings").map((m) => ({ type: m.id, x: m.x, y: m.y, width: m.w, height: m.h })) };
        break;
      case "npcs":
        data = { npcs: get("npcs").map((m) => ({ id: m.id, x: m.x, y: m.y, width: m.w, height: m.h })) };
        break;
    }
    return JSON.stringify(data, null, 2);
  }, [jsonGroup, json, markers]);

  const patch = useCallback((key: string, field: "x" | "y" | "w" | "h", value: number) => {
    setMarkers((prev) => prev.map((m) => (m.key === key ? { ...m, [field]: Math.max(field === "w" || field === "h" ? 1 : 0, value) } : m)));
  }, []);

  const groups = useMemo(() => Object.keys(GROUP_LABEL) as Group[], []);
  const sel = markers.find((m) => m.key === selected) ?? null;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black text-foreground">
      {/* Full-screen map at game zoom; middle-mouse drag pans, wheel zooms */}
      <div
        ref={stageRef}
        className="absolute inset-0 overflow-hidden"
        style={{ touchAction: "none", cursor: panRef.current ? "grabbing" : "default" }}
        onPointerDown={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            panRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          const p = panRef.current;
          if (!p) return;
          setOffset(clampOffset({ x: p.ox + (e.clientX - p.x), y: p.oy + (e.clientY - p.y) }, mapW, mapH));
        }}
        onPointerUp={() => {
          panRef.current = null;
        }}
        onPointerCancel={() => {
          panRef.current = null;
        }}
      >
        <div
          ref={wrapRef}
          className="absolute left-0 top-0"
          style={{ width: mapW, height: mapH, transform: `translate(${offset.x}px, ${offset.y}px)` }}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDragKey(null)}
          onPointerLeave={() => setDragKey(null)}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget || e.target === canvasRef.current) setSelected(null);
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute left-0 top-0"
            style={{ imageRendering: "pixelated", width: mapSize.w * PX, height: mapSize.h * PX }}
          />
          {showGrid ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(0,0,0,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.18) 1px, transparent 1px)",
                backgroundSize: `${PX}px ${PX}px`,
              }}
            />
          ) : null}

          {markers.map((m) => {
            const active = selected === m.key;
            return (
              <div key={m.key} className="absolute" style={{ left: m.x * PX, top: m.y * PX, width: m.w * PX, height: m.h * PX }}>
                <button
                  type="button"
                   onPointerDown={(e) => {
                     if (e.button !== 0) return; // let middle-click bubble up to pan the map
                     e.preventDefault();
                     e.stopPropagation();
                    const rect = wrapRef.current?.getBoundingClientRect();
                    dragOff.current = rect
                      ? { dx: Math.floor((e.clientX - rect.left) / PX) - m.x, dy: Math.floor((e.clientY - rect.top) / PX) - m.y }
                      : { dx: 0, dy: 0 };
                    setDragKey(m.key);
                    setMoved(false);
                    setSelected(m.key);
                  }}
                  onPointerUp={() => {
                    if (!moved) setSelected(m.key);
                  }}
                  title={`${m.group} · ${m.id} (${m.x}, ${m.y})`}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ cursor: "grab", touchAction: "none" }}
                >
                  {m.sprite ? (
                    <img src={m.sprite} alt={m.id} draggable={false} className="h-full w-full object-contain" style={{ imageRendering: "pixelated" }} />
                  ) : null}
                  <span
                    className="absolute inset-0 transition-colors"
                    style={{
                      background: active ? `${m.color}55` : `${m.color}22`,
                      outline: active ? "2px solid #fff" : `1px dashed ${m.color}`,
                    }}
                  />
                  {!m.sprite ? <span className="relative text-[10px] font-bold text-white drop-shadow">{m.label}</span> : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating asset buttons - show JSON for each group */}
      <div className="pointer-events-auto absolute left-3 top-3 flex flex-wrap items-center gap-2 rounded-lg bg-black/70 p-2 text-xs text-white backdrop-blur">
        <span className="font-bold">Map editor</span>
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              setJsonGroup(g);
              setShowJson(true);
            }}
            className={`rounded border border-white/30 px-2 py-1 ${jsonGroup === g && showJson ? "bg-white/40" : "bg-white/15"}`}
          >
            {GROUP_LABEL[g]}
          </button>
        ))}
        <button type="button" onClick={() => setShowGrid((s) => !s)} className={`rounded border border-white/30 px-2 py-1 ${showGrid ? "bg-white/15" : "opacity-40"}`}>
          Grid
        </button>
      </div>

      {/* Floating actions */}
      <div className="absolute right-3 top-3 flex flex-wrap items-center gap-2 rounded-lg bg-black/70 p-2 text-xs text-white backdrop-blur">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(jsonGroup ? filteredJson : json);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded border border-white/30 bg-white/15 px-2 py-1"
        >
          {copied ? "Copied!" : "Copy JSON"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (showJson && jsonGroup === null) {
              setShowJson(false);
            } else {
              setJsonGroup(null);
              setShowJson(true);
            }
          }}
          className={`rounded border border-white/30 px-2 py-1 ${showJson ? "bg-white/15" : ""}`}
        >
          JSON
        </button>
        <button type="button" onClick={() => setMarkers(buildMarkers())} className="rounded border border-white/30 px-2 py-1">
          Reset
        </button>
      </div>

      {/* Floating position controls for the selected asset */}
      {sel ? (
        <div className="absolute bottom-3 left-3 w-64 rounded-lg bg-black/80 p-3 text-xs text-white backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: sel.color }} />
            <span className="flex-1 truncate font-mono font-semibold">{sel.id}</span>
            <button type="button" onClick={() => setSelected(null)} className="rounded border border-white/30 px-2">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["x", "y", "w", "h"] as const).map((f) => (
              <div key={f} className="flex items-center gap-1">
                <span className="w-3 uppercase">{f}</span>
                <button type="button" className="rounded border border-white/30 px-1" onClick={() => patch(sel.key, f, sel[f] - 1)}>
                  −
                </button>
                <input
                  type="number"
                  value={sel[f]}
                  onChange={(e) => patch(sel.key, f, Number(e.target.value))}
                  className="w-12 rounded border border-white/30 bg-transparent px-1"
                />
                <button type="button" className="rounded border border-white/30 px-1" onClick={() => patch(sel.key, f, sel[f] + 1)}>
                  +
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-white/60">Drag on the map or nudge with the arrow keys.</p>
        </div>
      ) : null}

      {/* Floating JSON output */}
      {showJson ? (
        <div className="absolute bottom-3 right-3 w-80 rounded-lg bg-black/80 p-2 text-white backdrop-blur">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase text-white/70">{jsonGroup ? `${GROUP_LABEL[jsonGroup]} JSON` : "All JSON"}</span>
            <button type="button" onClick={() => setShowJson(false)} className="rounded border border-white/30 px-1.5 text-[10px]">
              ✕
            </button>
          </div>
          <textarea readOnly value={jsonGroup ? filteredJson : json} className="h-64 w-full resize-none rounded bg-transparent p-1 font-mono text-[10px]" />
        </div>
      ) : null}
    </main>
  );
}
