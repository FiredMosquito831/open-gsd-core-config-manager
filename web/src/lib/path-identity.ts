/**
 * Shared helpers for turning an absolute config path into a project-first
 * identity. Used by both the sidebar rows and the persistent context header
 * so the two never disagree about what a project is called.
 *
 * A tracked config lives at `<project>/.planning/config.json`, so the project
 * folder is the grandparent of the file. We never guess — everything derives
 * from the path the server gave us.
 */

/** Split an absolute path into segments, ignoring the drive letter noise. */
export function splitPath(path: string): string[] {
  return path
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0)
    .filter((segment, index, parts) => {
      // Drop a leading "C:" style drive token so it never becomes a label.
      if (index === 0 && /^[a-z]:$/i.test(parts[0])) return false;
      return true;
    });
}

/** The separator this path actually uses — so shortened paths look native. */
export function detectSeparator(path: string): string {
  return path.includes('\\') ? '\\' : '/';
}

/**
 * Project folder name: the directory that contains `.planning`. For
 * `…/proxy_custom_endpoint/.planning/config.json` this is `proxy_custom_endpoint`.
 */
export function projectName(path: string): string {
  const segments = splitPath(path);
  // […, project, ".planning", "config.json"]
  if (segments.length >= 3) return segments[segments.length - 3];
  if (segments.length >= 2) return segments[segments.length - 2];
  return segments[segments.length - 1] || 'config';
}

/**
 * Shortened middle path for the secondary line, e.g.
 * `…\TranscriptionAppRelease\AppTraduceri V2\.planning\config.json`.
 * Keeps the trailing segments that actually distinguish the project.
 */
export function shortMiddlePath(path: string, keep = 4): string {
  const sep = detectSeparator(path);
  const segments = splitPath(path);
  if (segments.length <= keep) return segments.join(sep);
  return '…' + sep + segments.slice(-keep).join(sep);
}

export interface ProjectIdentity {
  /** Primary label — project folder, disambiguated when names collide. */
  name: string;
  /** Secondary muted mono line — shortened distinguishing path. */
  shortPath: string;
  /** Full absolute path (title tooltip). */
  fullPath: string;
}

/**
 * Build a per-config identity map. When two projects share a folder name we
 * prepend the distinguishing parent segment so every row stays unique without
 * forcing the user to read a full path.
 */
export function buildProjectIdentities(
  configs: Array<{ id: string; path: string }>,
): Map<string, ProjectIdentity> {
  const nameCount = new Map<string, number>();
  for (const config of configs) {
    const name = projectName(config.path);
    nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
  }

  const identities = new Map<string, ProjectIdentity>();
  for (const config of configs) {
    const base = projectName(config.path);
    const dupes = (nameCount.get(base) ?? 0) > 1;
    let name = base;
    if (dupes) {
      const segments = splitPath(config.path);
      // […, parent, project, ".planning", "config.json"] → parent segment
      const parent = segments.length >= 4 ? segments[segments.length - 4] : '';
      name = parent ? `${parent} / ${base}` : base;
    }
    identities.set(config.id, {
      name,
      shortPath: shortMiddlePath(config.path),
      fullPath: config.path,
    });
  }
  return identities;
}
