import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export interface ServerConfig {
  host: string;
  port: number;
  username: string;
  auth: 'microsoft' | 'offline';
  version?: string;
}

export function parseConfig(): ServerConfig {
  return yargs(hideBin(process.argv))
    .option('host', {
      type: 'string',
      description: 'Minecraft server host (or Realm address)',
      default: 'localhost'
    })
    .option('port', {
      type: 'number',
      description: 'Minecraft server port',
      default: 25565
    })
    .option('username', {
      type: 'string',
      description: 'Bot username (ignored for Microsoft auth)',
      default: 'danniCRAFT'
    })
    .option('auth', {
      type: 'string',
      description: 'Authentication type: "microsoft" for Realms/online, "offline" for LAN',
      default: 'offline',
      choices: ['microsoft', 'offline'] as const
    })
    .option('version', {
      type: 'string',
      description: 'Minecraft version (e.g., "1.21.4"). Auto-detected if not specified.',
      default: undefined
    })
    .help()
    .alias('help', 'h')
    .parseSync() as ServerConfig;
}
