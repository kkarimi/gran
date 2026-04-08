# gran-sdk

Node and TypeScript SDK for Gran 👵🏻.

Use it when you want Gran's local-first core without shelling out to the CLI.

## Install

```bash
npm install gran-sdk
```

## Use

```ts
import { createGranSdk } from "gran-sdk";

const { app } = await createGranSdk({
  apiKey: process.env.GRAN_API_KEY,
});

const meetings = await app.listMeetings({ limit: 10 });
console.log(meetings.meetings.map((meeting) => meeting.meeting.title));
```

You can also load config first:

```ts
import { createGranApp, loadGranConfig } from "gran-sdk";

const config = await loadGranConfig({ config: ".gran.json" });
const app = await createGranApp(config, { surface: "server" });
```

## Export An Archive

```ts
import { createGranSdk, exportGranArchive } from "gran-sdk";

const { app } = await createGranSdk({
  apiKey: process.env.GRAN_API_KEY,
});

await exportGranArchive(app, {
  folder: "Personal",
  outputRoot: "./gran-exports",
});
```

That writes:

- notes to `./gran-exports/notes`
- transcripts to `./gran-exports/transcripts`

## Connect To A Running Local Service

```ts
import { connectGranService } from "gran-sdk";

const client = await connectGranService("http://127.0.0.1:5051");
const state = client.getState();

console.log(state.sync.lastCompletedAt);
await client.close();
```

## Create Named Export Targets

```ts
import { createGranExportTarget, createGranSdk, saveGranExportTarget } from "gran-sdk";

const { app } = await createGranSdk({
  apiKey: process.env.GRAN_API_KEY,
});

await saveGranExportTarget(
  app,
  createGranExportTarget("obsidian-vault", {
    dailyNotesDir: "Daily",
    id: "obsidian",
    name: "My Obsidian Vault",
    outputDir: "/Users/you/Documents/Obsidian",
  }),
);
```
