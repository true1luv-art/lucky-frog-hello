import { useContext, useState } from "react";
import Decimal from "decimal.js-light";

import { Context } from "@/context/GameContext";
import { AvatarMenuPanel } from "@/features/game-components/hud/components/AvatarMenu";
import { InventoryItems } from "@/features/game-components/hud/components/InventoryItems";
import { getShortcuts } from "@/features/game-components/hud/lib/shortcuts";
import { MarketplaceModal } from "@/features/game-components/marketplace/MarketplaceModal";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { useTutorialStore } from "@/features/game-stores/useTutorialStore";
import { getMaxHp } from "@/features/game/hp";
import { STAMINA_CONSTANTS } from "@/features/game/stamina";
import type { ToolInstance } from "@/features/types/gameplay/tools";
import { ITEM_DETAILS } from "@/features/types/item-details";

const basket = "/assets/icons/basket.png";
const button = "/assets/ui/button/round_button.png";
const darkBorder = "/assets/ui/panel/dark_border.png";
const heart = "/assets/icons/heart.png";
const lightning = "/assets/icons/lightning.png";
const menu = "/assets/icons/hamburger_menu.png";
const token = "/assets/icons/luckyfrog_token.png";

function shortcutImage(item: string, tools: ToolInstance[]) {
  const detail = ITEM_DETAILS[item as keyof typeof ITEM_DETAILS];
  if (detail?.image) return detail.image;
  const tool = tools.find((entry) => entry.name === item);
  return tool
    ? `/assets/tools/${tool.tier.toLowerCase()}_${tool.name.toLowerCase().replace(/ /g, "_")}.png`
    : undefined;
}

const slotBorder: React.CSSProperties = {
  borderStyle: "solid",
  borderWidth: 6,
  borderImage: `url(${darkBorder}) 25% repeat`,
  imageRendering: "pixelated",
};

export function GameHudDock({ wallet }: { wallet?: string }) {
  const state = useGameStore((store) => store.state);
  const reset = useGameStore((store) => store.reset);
  const { selectedItem, shortcutItem } = useContext(Context);
  const { openTutorial } = useTutorialStore();
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState(() => getShortcuts());

  const maxStamina = STAMINA_CONSTANTS.DEFAULT_MAX_STAMINA;
  const stamina = Math.max(0, Math.min(maxStamina, state.stamina ?? maxStamina));
  const staminaPct = (stamina / maxStamina) * 100;
  const maxHealth = getMaxHp(state.farmLevel);
  const tools = (state.tools ?? []) as ToolInstance[];
  const actionSlots = shortcuts.slice(0, 3);
  const coins = new Decimal(state.coins ?? 0).toDecimalPlaces(3, Decimal.ROUND_DOWN).toString();

  const closeInventory = () => {
    setInventoryOpen(false);
    setShortcuts(getShortcuts());
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] z-40 flex justify-center px-1 select-none">
        <div className="grid grid-cols-[3rem_minmax(0,14rem)_3rem] items-end gap-1 sm:grid-cols-[4rem_minmax(0,18rem)_4rem] sm:gap-2">
          <div className="relative flex flex-col items-center">
            <div className="absolute -top-6 flex items-center gap-1 whitespace-nowrap font-pixel text-[7px] text-gold text-outline sm:text-[8px]">
              <img src={token} alt="" className="h-3.5 w-3.5 pixelated" />
              {coins}
            </div>
            <div
              className="relative grid h-12 w-12 place-items-center sm:h-16 sm:w-16"
              title={`Health: ${maxHealth}/${maxHealth}`}
              aria-label={`Health ${maxHealth} of ${maxHealth}`}
            >
              <img src={button} alt="" className="absolute inset-0 h-full w-full pixelated" />
              <img src={heart} alt="" className="relative h-5 w-5 pixelated sm:h-7 sm:w-7" />
              <span className="absolute -bottom-1 font-pixel text-[6px] text-primary-foreground text-outline sm:text-[7px]">
                {maxHealth}
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-1">
            <div className="flex w-full items-center gap-1 px-1">
              <img src={lightning} alt="" className="h-3.5 w-3.5 shrink-0 pixelated sm:h-4 sm:w-4" />
              <div className="h-3 min-w-0 flex-1 overflow-hidden border-2 border-brown-700 bg-foreground/60 p-0.5 sm:h-4">
                <div
                  className="h-full bg-neon transition-[width] duration-500"
                  style={{ width: `${staminaPct}%` }}
                />
              </div>
              <span className="shrink-0 font-pixel text-[6px] text-primary-foreground text-outline sm:text-[7px]">
                {stamina}/{maxStamina}
              </span>
            </div>

            <div className="grid w-full grid-cols-4 gap-1">
              <button
                type="button"
                aria-label="Open player menu"
                title="Menu"
                onClick={() => setSettingsOpen(true)}
                className="pointer-events-auto grid aspect-square min-w-0 place-items-center bg-brown-600 active:translate-y-px"
                style={slotBorder}
              >
                <img src={menu} alt="" className="h-1/2 w-1/2 object-contain pixelated" />
              </button>

              {Array.from({ length: 3 }, (_, index) => {
                const item = actionSlots[index];
                const image = item ? shortcutImage(item, tools) : undefined;
                return (
                  <button
                    type="button"
                    key={item ?? `empty-${index}`}
                    aria-label={item ? `Equip ${item}` : `Empty shortcut ${index + 1}`}
                    title={item ?? "Empty shortcut"}
                    disabled={!item}
                    onClick={() => item && shortcutItem(item)}
                    className={`pointer-events-auto relative grid aspect-square min-w-0 place-items-center bg-brown-600 active:translate-y-px ${
                      item === selectedItem ? "bg-brown-200" : ""
                    }`}
                    style={slotBorder}
                  >
                    {image && <img src={image} alt="" className="h-4/5 w-4/5 object-contain pixelated" />}
                    <span className="absolute bottom-0.5 right-0.5 font-pixel text-[6px] text-primary-foreground text-outline">
                      {index + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            aria-label="Open inventory"
            title="Inventory"
            onClick={() => setInventoryOpen(true)}
            className="pointer-events-auto relative grid h-12 w-12 place-items-center active:translate-y-px sm:h-16 sm:w-16"
          >
            <img src={button} alt="" className="absolute inset-0 h-full w-full pixelated" />
            <img src={basket} alt="" className="relative h-5 w-5 pixelated sm:h-8 sm:w-8" />
          </button>
        </div>
      </div>

      <InventoryItems show={inventoryOpen} onClose={closeInventory} wallet={wallet} />

      {settingsOpen && (
        <AvatarMenuPanel
          show={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          name={state.username ?? "Hero"}
          onMarketplace={() => {
            setMarketplaceOpen(true);
            setSettingsOpen(false);
          }}
          onHowToPlay={() => {
            openTutorial();
            setSettingsOpen(false);
          }}
          onLogout={() => {
            if (confirm("Are you sure you want to logout?")) {
              reset();
              setSettingsOpen(false);
            }
          }}
        />
      )}

      <MarketplaceModal show={marketplaceOpen} onHide={() => setMarketplaceOpen(false)} />
    </>
  );
}