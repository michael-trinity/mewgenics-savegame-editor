# Mewgenics Save Editor

A browser-based save editor for [Mewgenics](https://store.steampowered.com/app/1881600/Mewgenics/) `.sav` files. Everything runs 100% client-side — your save files never leave your computer.

Built with Nuxt 4, Nuxt UI, Tailwind CSS 4, sql.js (WASM SQLite), and lz4js.

## Features

### Cat Editor
- **Stats** — Edit base stats (STR, DEX, CON, INT, SPD, CHA, LUCK) and level-up bonuses with live effective-stat totals that factor in class, equipment, and mutations
- **HP & Mana** — Edit current HP directly; max HP/mana and mana regen are derived from effective stats
- **Combat Status** — View and reset status effects (poisoned, burned, bleeding, etc.)
- **Name** — Rename cats with automatic binary offset recalculation
- **Age & Birthday** — Set exact age in days; class recalculates based on birthday
- **Status Flags** — Toggle retired, dead, and donated flags
- **Abilities** — Searchable browser for 500+ active abilities (organized by class), 200+ passives, and 30+ disorders, all with names, descriptions, mana costs, damage, and effect details. Tier editing for passives and disorders
- **Equipment** — 5 slots (Weapon, Hat, Necklace, Glasses, Trinket/Consumable) with a filterable item browser scoped to each slot's valid item kind. Shows item name, rarity, stat bonuses, shield, durability, description, and cursed status
- **Mutations** — 14 body-part slots with searchable mutation browser per category. Paired slots (legs, eyes, ears, eyebrows) can be mirrored. Coat texture editing. Shows mutation names, stat modifiers, and descriptions

### Inventory
- Three containers: **Backpack**, **Storage**, **Trash** — each shown as a card grid
- **Add items** from a searchable browser with stat filters (STR, DEX, CON, INT, SPD, CHA, LCK, Shield)
- **Delete items** individually
- Items display name, rarity, stat bonuses, description, charges, cursed badge, and equipment flag

### Active Team
- Overview of cats currently on adventure
- Per-cat HP/max HP, mana/max mana, and active status effects at a glance

### Housing
- Read-only view of cat room placements and coordinates
- Furniture list organized by room with position data

### Game Properties
- Edit key values: current day, gold, food, blank collars, adventure coins, adventure food, save completion %, storage upgrades, furniture boxes, min strays
- Adventure status indicator
- Advanced raw property table for all 50+ database properties with search and inline editing

### Save Operations
- **Backup download** — original `.sav` saved as `.savbak` before any changes
- **Dirty tracking** — only modified cats, properties, and inventory containers are recompressed and written, leaving untouched data intact
- **Dark/light mode** toggle

## How It Works

Mewgenics save files are SQLite 3 databases containing LZ4-compressed binary blobs. The editor:

1. Opens the `.sav` with sql.js (WASM)
2. Decompresses cat blobs with lz4js (auto-detects LZ4A/LZ4B variants)
3. Parses binary structures: stats, abilities, equipment, mutations, combat state, flags, name, birthday
4. Parses inventory, furniture, house state, and game properties from other tables
5. Presents everything in an editable UI backed by 58 game data reference files
6. On save: patches only changed binary blobs, recompresses, writes back to SQLite, and exports

## Game Data

The `public/data/` directory ships 58 reference files extracted from the game:

- **Abilities** — 15 per-class ability files + passives catalog + disorders catalog
- **Items** — 11 item category files (weapons, armor sets, consumables, cursed items, parasites, etc.)
- **Mutations** — 500+ mutations organized by body part category
- **Classes** — Class definitions with stat modifiers
- **Furniture** — 138KB of furniture effect data
- **Misc** — Difficulties, injuries, house weather, house layout

## Setup

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Production Build

```bash
pnpm build
pnpm preview
```

### Type Checking

```bash
pnpm typecheck
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Nuxt 4 |
| UI | Nuxt UI 4.4.0 + Tailwind CSS 4 |
| SQLite | sql.js (WASM) |
| Compression | lz4js |
| Icons | Lucide (via @iconify-json/lucide) |
| Language | TypeScript 5.9 |

## License

[MIT](LICENSE)
