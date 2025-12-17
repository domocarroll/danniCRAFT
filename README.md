# danniCRAFT

> *"I sense something intriguing about this world..."*

An AI companion for Minecraft, powered by Claude. danniCRAFT is a fork of [minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server) with added features for **Realm support**, **fishing automation**, and a unique personality layer.

## Features

### Core (inherited)
- Movement and navigation
- Block placement and digging
- Inventory management
- Entity detection
- In-game chat

### New in danniCRAFT
- **Microsoft/Realm Authentication** - Connect to Realms and online servers
- **Fishing Automation** - AFK fishing with treasure tracking
- **Personality Layer** - danniCRAFT speaks with character

## Prerequisites

- Node.js >= 20.10.0
- Minecraft Java Edition (tested with 1.21.4)
- An MCP-compatible client (Claude Desktop, Claude Code, etc.)
- For Realms: A Microsoft/Minecraft account

## Quick Start

### For LAN Worlds (Offline)

1. Open your singleplayer world to LAN (ESC → Open to LAN)
2. Note the port number shown in chat
3. Configure Claude Desktop:

```json
{
  "mcpServers": {
    "dannicraft": {
      "command": "npx",
      "args": [
        "-y",
        "github:domocarroll/danniCRAFT",
        "--host", "localhost",
        "--port", "25565",
        "--auth", "offline"
      ]
    }
  }
}
```

### For Realms (Microsoft Auth)

```json
{
  "mcpServers": {
    "dannicraft": {
      "command": "npx",
      "args": [
        "-y",
        "github:domocarroll/danniCRAFT",
        "--host", "YOUR_REALM_ADDRESS",
        "--port", "25565",
        "--auth", "microsoft"
      ]
    }
  }
}
```

On first run with `--auth microsoft`, you'll be prompted to complete Microsoft login in your browser. The token is cached for future sessions.

## Available Commands

### Movement
| Command | Description |
|---------|-------------|
| `get-position` | Get current coordinates |
| `move-to-position` | Navigate to coordinates |
| `look-at` | Face specific coordinates |
| `jump` | Jump |
| `fly-to` | Fly to coordinates (creative) |

### Fishing *(New)*
| Command | Description |
|---------|-------------|
| `fish-start` | Begin AFK fishing session |
| `fish-stop` | Stop fishing and get summary |
| `fish-status` | Check current fishing progress |

### Inventory
| Command | Description |
|---------|-------------|
| `list-inventory` | Show all items |
| `find-item` | Search for specific item |
| `equip-item` | Equip item to hand/armor |

### Blocks
| Command | Description |
|---------|-------------|
| `place-block` | Place block at coordinates |
| `dig-block` | Break block at coordinates |
| `get-block-info` | Info about block at position |
| `find-block` | Find nearest block type |

### Communication
| Command | Description |
|---------|-------------|
| `send-chat` | Send message in-game |
| `read-chat` | Get recent chat messages |

## Fishing Guide

danniCRAFT can fish autonomously while you do other things.

### Setup
1. Give danniCRAFT a fishing rod (ideally enchanted with Luck of the Sea III)
2. Position near water with open sky above for treasure loot
3. Run `fish-start`

### Commands

**Start fishing:**
```
"Hey danniCRAFT, start fishing"
→ Calls fish-start
```

**Check progress:**
```
"How's the fishing going?"
→ Calls fish-status
```

**Stop and get summary:**
```
"Stop fishing and tell me what you caught"
→ Calls fish-stop
```

### Treasure Tracking

danniCRAFT tracks:
- Total catches
- Session duration
- Catch rate per minute
- Treasure items (enchanted books, nautilus shells, etc.)

Example output:
```
Fishing session complete.

Duration: 47m 23s
Total catches: 89
Treasures found: 7

Catch breakdown:
  cod: 34
  salmon: 28
  enchanted_book: 4 ★
  nautilus_shell: 2 ★
  pufferfish: 8
  name_tag: 1 ★
  ...
```

## Configuration Options

| Flag | Description | Default |
|------|-------------|---------|
| `--host` | Server hostname or Realm address | `localhost` |
| `--port` | Server port | `25565` |
| `--username` | Bot name (offline mode only) | `danniCRAFT` |
| `--auth` | `microsoft` or `offline` | `offline` |
| `--version` | Minecraft version | auto-detect |

## Development

### Local Setup

```bash
git clone https://github.com/domocarroll/danniCRAFT.git
cd danniCRAFT
npm install
npm run build
```

### Run Locally

```bash
npm run dev -- --host localhost --port 25565 --auth offline
```

### Adding New Tools

Create a new file in `src/tools/`:

```typescript
import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';

export function registerMyTools(factory: ToolFactory, getBot: () => mineflayer.Bot): void {
  factory.registerTool(
    "my-tool",
    "Description of what this tool does",
    {
      param: z.string().describe("Parameter description")
    },
    async ({ param }) => {
      const bot = getBot();
      // ... implementation
      return factory.createResponse("Result message");
    }
  );
}
```

Then register in `src/main.ts`.

## Roadmap

- [ ] Chest/container interaction
- [ ] Crafting
- [ ] Combat/mob grinding
- [ ] Crop farming automation
- [ ] Mining patterns
- [ ] Following/companion mode
- [ ] Building from blueprints

## Credits

- Original [minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server) by Yuniko Software
- [Mineflayer](https://github.com/PrismarineJS/mineflayer) for Minecraft bot framework
- [MCP SDK](https://github.com/modelcontextprotocol) by Anthropic

## License

Apache-2.0 (same as upstream)
