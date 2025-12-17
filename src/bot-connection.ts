import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { pathfinder, Movements } = pathfinderPkg;
import minecraftData from 'minecraft-data';

const SUPPORTED_MINECRAFT_VERSION = '1.21.4';

type ConnectionState = 'connected' | 'connecting' | 'disconnected';

interface BotConfig {
  host: string;
  port: number;
  username: string;
  auth: 'microsoft' | 'offline';
  version?: string;
  realm?: string;
}

interface ConnectionCallbacks {
  onLog: (level: string, message: string) => void;
  onChatMessage: (username: string, message: string) => void;
}

export class BotConnection {
  private bot: mineflayer.Bot | null = null;
  private state: ConnectionState = 'disconnected';
  private config: BotConfig;
  private callbacks: ConnectionCallbacks;
  private isReconnecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly reconnectDelayMs: number;

  constructor(config: BotConfig, callbacks: ConnectionCallbacks, reconnectDelayMs = 2000) {
    this.config = config;
    this.callbacks = callbacks;
    this.reconnectDelayMs = reconnectDelayMs;
  }

  getBot(): mineflayer.Bot | null {
    return this.bot;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getConfig(): BotConfig {
    return this.config;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  connect(): void {
    const botOptions: mineflayer.BotOptions = {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      auth: this.config.auth,
      plugins: { pathfinder },
    };

    // Add version if specified
    if (this.config.version) {
      botOptions.version = this.config.version;
    }

    // Handle Realm connection
    if (this.config.realm) {
      if (this.config.auth !== 'microsoft') {
        this.callbacks.onLog('error', 'Realm connection requires --auth microsoft');
        return;
      }

      const realmName = this.config.realm.toLowerCase();
      this.callbacks.onLog('info', `Looking for Realm matching "${this.config.realm}"...`);

      // Use mineflayer's built-in Realm support with pickRealm callback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      botOptions.realms = {
        pickRealm: (realms: any[]) => {
          this.callbacks.onLog('info', `Found ${realms.length} Realm(s) on your account:`);

          realms.forEach((r: any, i: number) => {
            this.callbacks.onLog('info', `  ${i + 1}. ${r.name}`);
          });

          // Find realm by partial name match (case-insensitive)
          const matchedRealm = realms.find((r: any) =>
            r.name.toLowerCase().includes(realmName)
          );

          if (matchedRealm) {
            this.callbacks.onLog('info', `Connecting to Realm: ${matchedRealm.name}`);
            return matchedRealm;
          } else {
            this.callbacks.onLog('error', `No Realm found matching "${this.config.realm}"`);
            this.callbacks.onLog('info', 'Available Realms: ' + realms.map((r: any) => r.name).join(', '));
            // Return first realm as fallback or throw
            throw new Error(`Realm "${this.config.realm}" not found`);
          }
        }
      };

      this.callbacks.onLog('info', 'Microsoft auth enabled for Realm connection. Browser login may be required on first run.');
    } else {
      this.callbacks.onLog('info', `Connecting to ${this.config.host}:${this.config.port} with ${this.config.auth} auth...`);

      if (this.config.auth === 'microsoft') {
        this.callbacks.onLog('info', 'Microsoft auth enabled. You may need to complete login in your browser on first run.');
      }
    }

    this.bot = mineflayer.createBot(botOptions);
    this.state = 'connecting';
    this.isReconnecting = false;

    this.registerEventHandlers(this.bot);
  }

  private registerEventHandlers(bot: mineflayer.Bot): void {
    bot.once('spawn', async () => {
      this.state = 'connected';
      this.callbacks.onLog('info', 'Bot spawned in world');

      const mcData = minecraftData(bot.version);
      const defaultMove = new Movements(bot, mcData);
      bot.pathfinder.setMovements(defaultMove);

      // danniCRAFT personality on spawn
      bot.chat("I sense something intriguing about this world... danniCRAFT, ready to assist.");
      this.callbacks.onLog('info', `danniCRAFT connected successfully. Username: ${bot.username}, Server: ${this.config.realm || this.config.host}`);
    });

    bot.on('chat', (username, message) => {
      if (username === bot.username) return;
      this.callbacks.onChatMessage(username, message);
    });

    bot.on('kicked', (reason) => {
      this.callbacks.onLog('error', `Bot was kicked from server: ${this.formatError(reason)}`);
      this.state = 'disconnected';
      bot.quit();
    });

    bot.on('error', (err) => {
      const errorCode = (err as { code?: string }).code || 'Unknown error';
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.callbacks.onLog('error', `Bot error [${errorCode}]: ${errorMsg}`);

      if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT') {
        this.state = 'disconnected';
      }
    });

    bot.on('login', () => {
      this.callbacks.onLog('info', 'Bot logged in successfully');
    });

    bot.on('end', (reason) => {
      this.callbacks.onLog('info', `Bot disconnected: ${this.formatError(reason)}`);

      if (this.state === 'connected') {
        this.state = 'disconnected';
      }

      if (this.bot === bot) {
        try {
          bot.removeAllListeners();
          this.bot = null;
          this.callbacks.onLog('info', 'Bot instance cleaned up after disconnect');
        } catch (err) {
          this.callbacks.onLog('warn', `Error cleaning up bot on end event: ${this.formatError(err)}`);
        }
      }
    });
  }

  attemptReconnect(): void {
    if (this.isReconnecting || this.state === 'connecting') {
      return;
    }

    this.isReconnecting = true;
    this.state = 'connecting';
    this.callbacks.onLog('info', `Attempting to reconnect to Minecraft server in ${this.reconnectDelayMs}ms...`);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      if (this.bot) {
        try {
          this.bot.removeAllListeners();
          this.bot.quit('Reconnecting...');
          this.callbacks.onLog('info', 'Old bot instance cleaned up');
        } catch (err) {
          this.callbacks.onLog('warn', `Error while cleaning up old bot: ${this.formatError(err)}`);
        }
      }

      this.callbacks.onLog('info', 'Creating new bot instance...');
      this.connect();
    }, this.reconnectDelayMs);
  }

  async checkConnectionAndReconnect(): Promise<{ connected: boolean; message?: string }> {
    const currentState = this.state;

    if (currentState === 'disconnected') {
      this.attemptReconnect();

      const maxWaitTime = this.reconnectDelayMs + 5000;
      const pollInterval = 100;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        if (this.state === 'connected') {
          return { connected: true };
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      const errorMessage =
        `Cannot connect to Minecraft server.\n\n` +
        `Please ensure:\n` +
        `1. Minecraft server/Realm is accessible\n` +
        `2. Server version is compatible (tested with: ${SUPPORTED_MINECRAFT_VERSION})\n` +
        `3. For Realms: Use --auth microsoft --realm "RealmName"\n` +
        `4. Complete browser login if prompted\n\n` +
        `For setup instructions, visit: https://github.com/domocarroll/danniCRAFT`;

      return { connected: false, message: errorMessage };
    }

    if (currentState === 'connecting') {
      return { connected: false, message: 'danniCRAFT is connecting to the Minecraft server. Please wait a moment and try again.' };
    }

    return { connected: true };
  }

  cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.bot) {
      try {
        this.bot.quit('danniCRAFT signing off...');
      } catch (err) {
        this.callbacks.onLog('warn', `Error during cleanup: ${this.formatError(err)}`);
      }
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
