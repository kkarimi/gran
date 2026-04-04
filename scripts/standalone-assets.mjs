export const standaloneCommandName = "granola";

export const supportedStandaloneTargets = [
  {
    archiveExtension: "tar.gz",
    arch: "arm64",
    id: "darwin-arm64",
    platform: "darwin",
  },
  {
    archiveExtension: "tar.gz",
    arch: "x64",
    id: "linux-x64",
    platform: "linux",
  },
  {
    archiveExtension: "zip",
    arch: "x64",
    id: "win32-x64",
    platform: "win32",
  },
];

export function parseStandaloneTarget(targetId) {
  const target = supportedStandaloneTargets.find((candidate) => candidate.id === targetId);
  if (!target) {
    throw new Error(
      `Unsupported standalone target: ${targetId}. Supported targets: ${supportedStandaloneTargets
        .map((candidate) => candidate.id)
        .join(", ")}`,
    );
  }

  return target;
}

export function detectStandaloneTarget(platform = process.platform, arch = process.arch) {
  const target = supportedStandaloneTargets.find(
    (candidate) => candidate.platform === platform && candidate.arch === arch,
  );
  if (!target) {
    throw new Error(
      `Unsupported standalone host platform ${platform}-${arch}. Supported targets: ${supportedStandaloneTargets
        .map((candidate) => candidate.id)
        .join(", ")}`,
    );
  }

  return target;
}

export function standaloneExecutableName(commandName, target) {
  return target.platform === "win32" ? `${commandName}.exe` : commandName;
}

export function standaloneAssetBaseName(packageName, version, target) {
  return `${packageName}-v${version}-${target.id}`;
}

export function standaloneArchiveName(packageName, version, target) {
  return `${standaloneAssetBaseName(packageName, version, target)}.${target.archiveExtension}`;
}
