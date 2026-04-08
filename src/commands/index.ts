import { attachCommand } from "./attach.ts";
import { automationCommand } from "./automation.ts";
import { authCommand } from "./auth.ts";
import { exportCommand } from "./export.ts";
import { exportsCommand } from "./exports.ts";
import { folderCommand } from "./folder.ts";
import { initCommand } from "./init.ts";
import { intelligenceCommand } from "./intelligence.ts";
import { meetingCommand } from "./meeting.ts";
import { notesCommand } from "./notes.ts";
import { searchCommand } from "./search.ts";
import { serviceCommand } from "./service.ts";
import { serveCommand } from "./serve.ts";
import { syncCommand } from "./sync.ts";
import { targetsCommand } from "./targets.ts";
import { tuiCommand } from "./tui.ts";
import { transcriptsCommand } from "./transcripts.ts";
import { webCommand } from "./web.ts";

export const commands = [
  attachCommand,
  automationCommand,
  authCommand,
  exportCommand,
  exportsCommand,
  folderCommand,
  initCommand,
  intelligenceCommand,
  meetingCommand,
  notesCommand,
  searchCommand,
  serviceCommand,
  serveCommand,
  syncCommand,
  targetsCommand,
  tuiCommand,
  transcriptsCommand,
  webCommand,
];

export const commandMap = new Map(commands.map((command) => [command.name, command]));
