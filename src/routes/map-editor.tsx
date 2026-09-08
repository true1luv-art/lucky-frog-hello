import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BUILDING_POSITIONS,
  NPC_POSITIONS,
  TREE_POSITIONS,
  STONE_POSITIONS,
  PLOT_POSITIONS,
  BARN_ZONE,
  CHICKEN_SPAWN_POSITIONS,
  COW_SPAWN_POSITIONS,
  SHEEP_SPAWN_POSITIONS,
  FISHING_POSITIONS,
} from "@/phaser/positions";

export const Route = createFileRoute("/map-editor")({
  component: MapEditor,
  head: () => ({
    meta: [
      { title: "Map Editor | Lucky Frog Farm" },
      { name: "description", content: "Drag farm objects on the tile grid and copy the updated position JSON." },
      { property: "og:title", content: "Map Editor | Lucky Frog Farm" },
      { property: "og:description", content: "Drag farm objects on the tile grid and copy the updated position JSON." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TILE = 16;
const PX_BASE = TILE;

type Marker = {
  key: string;
  group: string;
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

function buildMarkers(): Marker[] {
  const out: Marker[] = [];
  TREE_POSITIONS.forEach((t) =>
    out.push({ key: `tree:${t.id}`, group: "trees", id: t.id, x: t.x, y: t.y, w: 1, h: 1, color: "#2f7d32", label: "T", sprite: "/assets/resources/tree_node.png" })
  );
  STONE_POSITIONS.forEach((s) =>
    out.push({ key: `stone:${s.id}`, group: "stones", id: s.id, x: s.x, y: s.y, w: 1, h: 1, color: "#6b7280", label: "S", sprite: "/assets/resources/stone_node.png" })
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
  CHICKEN_SPAWN_POSITIONS.forEach((a) =>
    out.push({ key: `chicken:${a.index}`, group: "chickens", id: String(a.index), x: a.x, y: a.y, w: 1, h: 1, color: "#f59e0b", label: "c", sprite: "/assets/animals/chicken.gif" })
  );
  COW_SPAWN_POSITIONS.forEach((a) =>
    out.push({ key: `cow:${a.index}`, group: "cows", id: String(a.index), x: a.x, y: a.y, w: 2, h: 2, color: "#f472b6", label: "w", sprite: "/assets/animals/cow.gif" })
  );
  SHEEP_SPAWN_POSITIONS.forEach((a) =>
    out.push({ key: `sheep:${a.index}`, group: "sheep", id: String(a.index), x: a.x, y: a.y, w: 2, h: 2, color: "#e5e7eb", label: "s", sprite: "/assets/animals/sheep.gif" })
  );
  FISHING_POSITIONS.forEach((f) =>
    out.push({ key: `fishing:${f.id}`, group: "fishingAnchors", id: f.id, x: f.anchorTile.x, y: f.anchorTile.y, w: 1, h: 1, color: "#0ea5e9", label: "F" })
  );
  out.push({
    key: "barnZone",
    group: "barnZone",
    id: "barn_zone",
    x: BARN_ZONE.x,
    y: BARN_ZONE.y,
    w: BARN_ZONE.width,
    h: BARN_ZONE.height,
    color: "#0f766e",
    label: "barn zone",
  });
  return out;
}

function MapEditor() {
  const [markers, setMarkers] = useState<Marker[]>(() => buildMarkers());
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [mapSize, setMapSize] = useState({ w: 40, h: 40 });
  const [zoom, setZoom] = useState(2);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragOff = useRef({ dx: 0, dy: 0 });

  const PX = PX_BASE * zoom;

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
          const tx = Math.min(Math.max(0, gx), Math.max(0, mapSize.w - m.w));
          const ty = Math.min(Math.max(0, gy), Math.max(0, mapSize.h - m.h));
          if (m.x !== tx || m.y !== ty) setMoved(true);
          return { ...m, x: tx, y: ty };
        })
      );
    },
    [dragKey, PX, mapSize]
  );

  // Arrow keys nudge the selected asset by one tile.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const d: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const move = d[e.key];
      if (!move) return;
      e.preventDefault();
      setMarkers((prev) =>
        prev.map((m) =>
          m.key === selected
            ? {
                ...m,
                x: Math.min(Math.max(0, m.x + move[0]), Math.max(0, mapSize.w - m.w)),
                y: Math.min(Math.max(0, m.y + move[1]), Math.max(0, mapSize.h - m.h)),
              }
            : m
        )
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, mapSize]);


  const groups = useMemo(() => Array.from(new Set(markers.map((m) => m.group))), [markers]);

  const json = useMemo(() => {
    const get = (g: string) => markers.filter((m) => m.group === g);
    const barn = markers.find((m) => m.group === "barnZone")!;
    return JSON.stringify(
      {
        trees: get("trees").map((m) => ({ id: m.id, x: m.x, y: m.y })),
        stones: get("stones").map((m) => ({ id: m.id, x: m.x, y: m.y })),
        plots: get("plots").map((m, i) => ({ id: m.id, fieldIndex: PLOT_POSITIONS[i]?.fieldIndex ?? i, x: m.x, y: m.y })),
        buildings: get("buildings").map((m) => ({ type: m.id, x: m.x, y: m.y, width: m.w, height: m.h })),
        npcs: get("npcs").map((m) => ({ id: m.id, x: m.x, y: m.y, width: m.w, height: m.h })),
        chickens: get("chickens").map((m) => ({ index: Number(m.id), x: m.x, y: m.y })),
        cows: get("cows").map((m) => ({ index: Number(m.id), x: m.x, y: m.y })),
        sheep: get("sheep").map((m) => ({ index: Number(m.id), x: m.x, y: m.y })),
        fishingAnchors: get("fishingAnchors").map((m) => ({ id: m.id, anchorTile: { x: m.x, y: m.y } })),
        barnZone: { x: barn.x, y: barn.y, width: barn.w, height: barn.h },
      },
      null,
      2
    );
  }, [markers]);

  const sel = markers.find((m) => m.key === selected) ?? null;

  const patch = useCallback((key: string, field: "x" | "y" | "w" | "h", value: number) => {
    setMarkers((prev) => prev.map((m) => (m.key === key ? { ...m, [field]: Math.max(field === "w" || field === "h" ? 1 : 0, value) } : m)));
  }, []);

  return (
    <main className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <h1 className="mr-2 text-sm font-bold">Map editor</h1>
          <div className="flex items-center gap-1 text-xs">
            <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 1))} className="rounded border border-border px-2">
              −
            </button>
            <span className="w-10 text-center">{zoom}×</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 1))} className="rounded border border-border px-2">
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            className={`rounded border border-border px-2 py-1 text-xs ${showGrid ? "" : "opacity-40"}`}
          >
            grid
          </button>
          <div className="flex flex-wrap gap-1">
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setHidden((h) => ({ ...h, [g]: !h[g] }))}
                className={`rounded border border-border px-2 py-1 text-xs ${hidden[g] ? "opacity-40" : ""}`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(json);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded border border-border px-3 py-1 text-xs"
            >
              {copied ? "Copied!" : "Copy JSON"}
            </button>
            <button type="button" onClick={() => setMarkers(buildMarkers())} className="rounded border border-border px-3 py-1 text-xs">
              Reset
            </button>
            <button type="button" onClick={() => setDrawerOpen((d) => !d)} className="rounded border border-border px-3 py-1 text-xs">
              {drawerOpen ? "Hide list" : "Show list"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div
            ref={wrapRef}
            className="relative"
            style={{ width: mapSize.w * PX, height: mapSize.h * PX }}
            onPointerMove={onPointerMove}
            onPointerUp={() => setDragKey(null)}
            onPointerLeave={() => setDragKey(null)}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget || e.target === canvasRef.current) setSelected(null);
            }}
          >
            <canvas
              ref={canvasRef}
              className="absolute left-0 top-0 origin-top-left"
              style={{ imageRendering: "pixelated", width: mapSize.w * PX, height: mapSize.h * PX }}
            />
            {showGrid ? (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(0,0,0,.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.15) 1px, transparent 1px)",
                  backgroundSize: `${PX}px ${PX}px`,
                }}
              />
            ) : null}

            {markers
              .filter((m) => !hidden[m.group])
              .map((m) => {
                const active = selected === m.key;
                return (
                  <div
                    key={m.key}
                    data-marker={m.key}
                    className="absolute"
                    style={{ left: m.x * PX, top: m.y * PX, width: m.w * PX, height: m.h * PX }}
                  >
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = wrapRef.current?.getBoundingClientRect();
                        if (rect) {
                          dragOff.current = {
                            dx: Math.floor((e.clientX - rect.left) / PX) - m.x,
                            dy: Math.floor((e.clientY - rect.top) / PX) - m.y,
                          };
                        } else {
                          dragOff.current = { dx: 0, dy: 0 };
                        }
                        setDragKey(m.key);
                        setMoved(false);
                        setSelected(m.key);
                      }}
                      onPointerUp={() => {
                        if (!moved) setSelected(m.key);
                      }}
                      title={`${m.group} · ${m.id} (${m.x}, ${m.y})`}
                      className="group absolute inset-0 flex items-center justify-center"
                      style={{ cursor: "grab", touchAction: "none" }}
                    >
                      {m.sprite ? (
                        <img
                          src={m.sprite}
                          alt={m.id}
                          draggable={false}
                          className="h-full w-full object-contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : null}
                      <span
                        className="absolute inset-0 transition-colors"
                        style={{
                          background: active ? `${m.color}55` : `${m.color}22`,
                          outline: active ? "2px solid #fff" : `1px dashed ${m.color}`,
                          boxShadow: active ? `0 0 0 2px ${m.color}` : undefined,
                        }}
                      />
                      {!m.sprite ? (
                        <span className="relative text-[10px] font-bold text-white drop-shadow">{m.label}</span>
                      ) : null}
                    </button>

                    {active ? (
                      <div
                        className="absolute z-20 w-56 rounded border border-border bg-popover p-2 text-xs text-popover-foreground shadow-lg"
                        style={{ left: m.w * PX + 8, top: 0 }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <div className="mb-2 font-semibold">
                          {m.group} · {m.id}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(["x", "y", "w", "h"] as const).map((f) => (
                            <div key={f} className="flex items-center gap-1">
                              <span className="w-3 uppercase">{f}</span>
                              <button type="button" className="rounded border border-border px-1" onClick={() => patch(m.key, f, m[f] - 1)}>
                                −
                              </button>
                              <input
                                type="number"
                                value={m[f]}
                                onChange={(e) => patch(m.key, f, Number(e.target.value))}
                                className="w-12 rounded border border-border bg-transparent px-1"
                              />
                              <button type="button" className="rounded border border-border px-1" onClick={() => patch(m.key, f, m[f] + 1)}>
                                +
                              </button>
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={() => setSelected(null)} className="mt-2 w-full rounded border border-border px-2 py-1">
                          Close
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <aside
        className={`h-full shrink-0 overflow-hidden border-l border-border bg-card transition-all duration-300 ${
          drawerOpen ? "w-96" : "w-0"
        }`}
      >
        <div className="flex h-full w-96 flex-col gap-2 p-3">
          <h2 className="text-sm font-bold">Assets</h2>
          <p className="text-xs text-muted-foreground">Click a row to select it on the map; drag markers or use the popover to adjust.</p>
          <div className="flex-1 overflow-auto rounded border border-border">
            {groups.map((g) => (
              <div key={g}>
                <div className="sticky top-0 bg-muted px-2 py-1 text-xs font-semibold uppercase">{g}</div>
                {markers
                  .filter((m) => m.group === g)
                  .map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelected(m.key)}
                      className={`flex w-full items-center gap-2 border-b border-border px-2 py-1 text-left text-[11px] ${
                        selected === m.key ? "bg-accent" : ""
                      }`}
                    >
                      <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: m.color }} />
                      <span className="flex-1 truncate font-mono">{m.id}</span>
                      <span className="font-mono text-muted-foreground">
                        x{m.x} y{m.y} w{m.w} h{m.h}
                      </span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
          <textarea readOnly value={json} className="h-40 shrink-0 rounded border border-border bg-transparent p-2 font-mono text-[10px]" />
        </div>
      </aside>
    </main>
  );
}
