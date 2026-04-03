function formatScalar(value: unknown): string {
  if (value == null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function renderYaml(value: unknown, depth = 0): string[] {
  const indent = "  ".repeat(depth);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${indent}[]`];
    }

    return value.flatMap((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const nested = renderYaml(item, depth + 1);
        const first = nested[0] ?? `${"  ".repeat(depth + 1)}{}`;
        return [`${indent}- ${first.trimStart()}`, ...nested.slice(1)];
      }

      return [`${indent}- ${formatScalar(item)}`];
    });
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return [`${indent}{}`];
    }

    return entries.flatMap(([key, entryValue]) => {
      if (Array.isArray(entryValue) || (entryValue && typeof entryValue === "object")) {
        return [`${indent}${key}:`, ...renderYaml(entryValue, depth + 1)];
      }

      return [`${indent}${key}: ${formatScalar(entryValue)}`];
    });
  }

  return [`${indent}${formatScalar(value)}`];
}

export function toYaml(value: unknown): string {
  return `${renderYaml(value).join("\n").trimEnd()}\n`;
}

export function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
