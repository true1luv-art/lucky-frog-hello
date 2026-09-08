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
const SCALE = 2;
const PX = TILE * SCALE;

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
};

function buildMarkers(): Marker[] {
  const out: Marker[] = [];
  TREE_POSITIONS.forEach((t) =>
    out.push({ key: `tree:${t.id}`, group: "trees", id: t.id, x: t.x, y: t.y, w: 1, h: 1, color: "#2f7d32", label: "T" })
  );
  STONE_POSITIONS.forEach((s) =>
    out.push({ key: `stone:${s.id}`, group: "stones", id: s.id, x: s.x, y: s.y, w: 1, h: 1, color: "#6b7280", label: "S" })
  );
  PLOT_POSITIONS.forEach((p) =>
    out.push({ key: `plot:${p.id}`, group: "plots", id: p.id, x: p.x, y: p.y, w: 1, h: 1, color: "#a16207", label: "P" })
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
      label: b.type.slice(0, 3),
    })
  );
  NPC_POSITIONS.forEach((n) =>
    out.push({ key: `npc:${n.id}`, group: "npcs", id: n.id, x: n.x, y: n.y, w: n.width, h: n.height, color: "#dc2626", label: "N" })
  );
  CHICKEN_SPAWN_POSITIONS.forEach((a) =>
    out.push({ key: `chicken:${a.index}`, group: "chickens", id: String(a.index), x: a.x, y: a.y, w: 1, h: 1, color: "#f59e0b", label: "c" })
  );
  COW_SPAWN_POSITIONS.forEach((a) =>
    out.push({ key: `cow:${a.index}`, group: "cows", id: String(a.index), x: a.x, y: a.y, w: 1, h: 1, color: "#f472b6", label: "w" })
  );
  SHEEP_SPAWN_POSITIONS.forEach((a) =>
    out.push({ key: `sheep:${a.index}`, group: "sheep", id: String(a.index), x: a.x, y: a.y, w: 1, h: 1, color: "#e5e7eb", label: "s" })
  );
  FISHING_POSITIONS.forEach((f) =>
    out.push({
      key: `fishing:${f.id}`,
      group: "fishingAnchors",
      id: f.id,
      x: f.anchorTile.x,
      y: f.anchorTile.y,
      w: 1,
      h: 1,
      color: "#0ea5e9",
      label: "F",
    })
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
    label: "barn",
  });
  return out;
}

function MapEditor() {
  const [markers, setMarkers] = useState<Marker[]>(() => buildMarkers());
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [mapSize, setMapSize] = useState({ w: 40, h: 40 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

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
      canvas.width = map.width * PX;
      canvas.height = map.height * PX;
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
          const dx = (i % map.width) * PX;
          const dy = Math.floor(i / map.width) * PX;
          ctx.drawImage(img, sx, sy, TILE, TILE, dx, dy, PX, PX);
        }
      }
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= map.width; x += 1) {
        ctx.beginPath();
        ctx.moveTo(x * PX + 0.5, 0);
        ctx.lineTo(x * PX + 0.5, map.height * PX);
        ctx.stroke();
      }
      for (let y = 0; y <= map.height; y += 1) {
        ctx.beginPath();
        ctx.moveTo(0, y * PX + 0.5);
        ctx.lineTo(map.width * PX, y * PX + 0.5);
        ctx.stroke();
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
      const tx = Math.max(0, Math.floor((e.clientX - rect.left) / PX));
      const ty = Math.max(0, Math.floor((e.clientY - rect.top) / PX));
      setMarkers((prev) => prev.map((m) => (m.key === dragKey ? { ...m, x: tx, y: ty } : m)));
    },
    [dragKey]
  );

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

  return (
    <main className="flex h-screen w-full flex-col gap-2 bg-background p-3 text-foreground lg:flex-row">
      <div className="flex-1 overflow-auto rounded border border-border">
        <div
          ref={wrapRef}
          className="relative"
          style={{ width: mapSize.w * PX, height: mapSize.h * PX }}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDragKey(null)}
          onPointerLeave={() => setDragKey(null)}
        >
          <canvas ref={canvasRef} className="absolute left-0 top-0" />
          {markers
            .filter((m) => !hidden[m.group])
            .map((m) => (
              <button
                key={m.key}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDragKey(m.key);
                  setSelected(m.key);
                }}
                title={`${m.group} ${m.id} (${m.x}, ${m.y})`}
                className="absolute flex items-center justify-center text-[10px] font-bold text-white"
                style={{
                  left: m.x * PX,
                  top: m.y * PX,
                  width: m.w * PX,
                  height: m.h * PX,
                  background: `${m.color}aa`,
                  outline: selected === m.key ? "2px solid #fff" : "1px solid rgba(0,0,0,.5)",
                  cursor: "grab",
                  touchAction: "none",
                }}
              >
                {m.label}
              </button>
            ))}
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-96">
        <h1 className="text-lg font-bold">Map editor</h1>
        <p className="text-xs text-muted-foreground">
          Drag any marker to a new tile, then copy the JSON below and paste it in chat.
        </p>
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

        {sel ? (
          <div className="rounded border border-border p-2 text-xs">
            <div className="mb-1 font-semibold">
              {sel.group} · {sel.id}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["x", "y", "w", "h"] as const).map((f) => (
                <label key={f} className="flex items-center gap-1">
                  {f}
                  <input
                    type="number"
                    value={sel[f]}
                    onChange={(e) =>
                      setMarkers((prev) =>
                        prev.map((m) => (m.key === sel.key ? { ...m, [f]: Math.max(0, Number(e.target.value)) } : m))
                      )
                    }
                    className="w-16 rounded border border-border bg-transparent px-1"
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(json)}
            className="rounded border border-border px-3 py-1 text-sm"
          >
            Copy JSON
          </button>
          <button type="button" onClick={() => setMarkers(buildMarkers())} className="rounded border border-border px-3 py-1 text-sm">
            Reset
          </button>
        </div>

        <textarea readOnly value={json} className="h-full min-h-64 flex-1 rounded border border-border bg-transparent p-2 font-mono text-[11px]" />
      </aside>
    </main>
  );
}
