import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';

// Fishing state management
interface FishingState {
  isActive: boolean;
  startTime: number | null;
  catches: CatchRecord[];
  treasures: string[];
}

interface CatchRecord {
  item: string;
  count: number;
  timestamp: number;
  isTreasure: boolean;
}

// Treasure items from fishing (Luck of the Sea targets)
const TREASURE_ITEMS = [
  'enchanted_book',
  'name_tag',
  'nautilus_shell',
  'saddle',
  'bow',           // Can be enchanted
  'fishing_rod',   // Can be enchanted
];

const JUNK_ITEMS = [
  'leather_boots',
  'leather',
  'bowl',
  'string',
  'potion',       // Water bottle
  'bone',
  'ink_sac',
  'tripwire_hook',
  'rotten_flesh',
  'stick',
  'bamboo',
  'lily_pad',
];

// Global fishing state per bot
const fishingStates = new Map<string, FishingState>();

function getState(botUsername: string): FishingState {
  if (!fishingStates.has(botUsername)) {
    fishingStates.set(botUsername, {
      isActive: false,
      startTime: null,
      catches: [],
      treasures: [],
    });
  }
  return fishingStates.get(botUsername)!;
}

function isTreasure(itemName: string): boolean {
  return TREASURE_ITEMS.some(t => itemName.includes(t));
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// danniCRAFT personality messages for fishing events
const CATCH_MESSAGES = {
  treasure: [
    "Now this is intriguing...",
    "The waters reveal their secrets.",
    "Patience rewards those who wait.",
    "I sensed this one coming.",
  ],
  fish: [
    "Another one for the collection.",
    "The rhythm of the cast continues.",
    "Steady progress.",
  ],
  junk: [
    "Not everything hidden is valuable... but noted.",
    "Even the mundane has its place.",
  ],
};

function getRandomMessage(type: 'treasure' | 'fish' | 'junk'): string {
  const messages = CATCH_MESSAGES[type];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function registerFishingTools(factory: ToolFactory, getBot: () => mineflayer.Bot): void {

  factory.registerTool(
    "fish-start",
    "Start fishing. danniCRAFT will continuously fish until stopped. Requires a fishing rod in inventory.",
    {
      announce: z.boolean().optional().describe("Whether to announce catches in chat (default: false, reduces spam)")
    },
    async ({ announce = false }) => {
      const bot = getBot();
      const state = getState(bot.username);

      if (state.isActive) {
        return factory.createResponse("I'm already fishing. Use fish-stop to stop, or fish-status to check progress.");
      }

      // Find and equip fishing rod
      const rod = bot.inventory.items().find(item => item.name.includes('fishing_rod'));
      if (!rod) {
        return factory.createResponse("I don't have a fishing rod in my inventory. Please provide one.");
      }

      try {
        await bot.equip(rod, 'hand');
      } catch (err) {
        return factory.createResponse(`Couldn't equip the fishing rod: ${err}`);
      }

      // Reset state for new session
      state.isActive = true;
      state.startTime = Date.now();
      state.catches = [];
      state.treasures = [];

      bot.chat("I sense something intriguing in these waters... Let's see what they reveal.");

      // Start the fishing loop
      const fishLoop = async () => {
        while (state.isActive) {
          try {
            // Cast and wait for fish
            await bot.fish();

            // Check what we caught (last item picked up)
            // Mineflayer's fish() resolves when we catch something
            const recentItems = bot.inventory.items();
            const lastItem = recentItems[recentItems.length - 1];

            if (lastItem) {
              const itemName = lastItem.name;
              const isTreasureItem = isTreasure(itemName);
              const isJunk = JUNK_ITEMS.some(j => itemName.includes(j));

              state.catches.push({
                item: itemName,
                count: 1,
                timestamp: Date.now(),
                isTreasure: isTreasureItem,
              });

              if (isTreasureItem) {
                state.treasures.push(itemName);
                if (announce) {
                  bot.chat(`${getRandomMessage('treasure')} Caught: ${itemName}`);
                }
              } else if (announce && !isJunk) {
                // Only announce non-junk items if announce is on
                bot.chat(`${getRandomMessage('fish')} ${itemName}`);
              }
            }

            // Small delay between casts
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (err) {
            // Handle common fishing errors
            const errorMsg = String(err);
            if (errorMsg.includes('interrupt') || errorMsg.includes('stop')) {
              break;
            }
            // Brief pause on error, then continue
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      };

      // Start fishing in background (don't await)
      fishLoop().catch(() => {
        state.isActive = false;
      });

      return factory.createResponse(
        `Fishing session started.\n` +
        `Rod equipped: ${rod.name}${rod.enchants?.length ? ` (enchanted)` : ''}\n` +
        `Announcements: ${announce ? 'on' : 'off'}\n\n` +
        `Use fish-status to check progress, fish-stop to end session.`
      );
    }
  );

  factory.registerTool(
    "fish-stop",
    "Stop the current fishing session and get a summary of catches.",
    {},
    async () => {
      const bot = getBot();
      const state = getState(bot.username);

      if (!state.isActive) {
        return factory.createResponse("I'm not currently fishing.");
      }

      state.isActive = false;

      const duration = state.startTime ? Date.now() - state.startTime : 0;
      const totalCatches = state.catches.length;
      const treasureCount = state.treasures.length;

      // Summarize catches by type
      const catchSummary = new Map<string, number>();
      state.catches.forEach(c => {
        catchSummary.set(c.item, (catchSummary.get(c.item) || 0) + 1);
      });

      let summaryText = `Fishing session complete.\n\n`;
      summaryText += `Duration: ${formatDuration(duration)}\n`;
      summaryText += `Total catches: ${totalCatches}\n`;
      summaryText += `Treasures found: ${treasureCount}\n\n`;

      if (catchSummary.size > 0) {
        summaryText += `Catch breakdown:\n`;
        Array.from(catchSummary.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([item, count]) => {
            const marker = isTreasure(item) ? ' ★' : '';
            summaryText += `  ${item}: ${count}${marker}\n`;
          });
      }

      if (state.treasures.length > 0) {
        summaryText += `\nTreasures: ${state.treasures.join(', ')}`;
      }

      bot.chat("The waters have shared their secrets. Session complete.");

      return factory.createResponse(summaryText);
    }
  );

  factory.registerTool(
    "fish-status",
    "Get the current status of the fishing session, including catches and treasures found.",
    {},
    async () => {
      const bot = getBot();
      const state = getState(bot.username);

      if (!state.isActive) {
        return factory.createResponse("I'm not currently fishing. Use fish-start to begin.");
      }

      const duration = state.startTime ? Date.now() - state.startTime : 0;
      const totalCatches = state.catches.length;
      const treasureCount = state.treasures.length;
      const catchRate = duration > 0 ? (totalCatches / (duration / 60000)).toFixed(1) : '0';

      // Recent catches (last 5)
      const recentCatches = state.catches.slice(-5).map(c => c.item);

      let statusText = `Fishing in progress...\n\n`;
      statusText += `Duration: ${formatDuration(duration)}\n`;
      statusText += `Total catches: ${totalCatches}\n`;
      statusText += `Catch rate: ${catchRate}/min\n`;
      statusText += `Treasures found: ${treasureCount}\n`;

      if (recentCatches.length > 0) {
        statusText += `\nRecent: ${recentCatches.join(', ')}`;
      }

      if (state.treasures.length > 0) {
        statusText += `\nTreasures: ${state.treasures.join(', ')}`;
      }

      return factory.createResponse(statusText);
    }
  );
}
