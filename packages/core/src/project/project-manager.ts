import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { EventManager } from "../event/event-manager.js";
import { ProjectError } from "../errors/core-errors.js";
import type { ProjectRepository } from "../storage/repositories.js";
import type { StateManager } from "../state/state-manager.js";
import { createId } from "../utils/id.js";
import { normalizePath, pathsEqual, toAbsolutePath } from "../utils/path.js";
import { nowMs } from "../utils/time.js";
import type { ProjectInfo } from "./project-types.js";

export class ProjectManager {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly stateManager: StateManager,
    private readonly eventManager: EventManager,
  ) {}

  open(path: string): ProjectInfo {
    const absolute = toAbsolutePath(path);
    if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
      throw new ProjectError("PROJECT_INVALID", `not a directory: ${path}`);
    }

    const existing = this.findExisting(absolute);
    const gitRoot = detectGitRoot(absolute);
    const now = nowMs();

    const project: ProjectInfo = existing
      ? { ...existing, gitRoot, isGitRepository: gitRoot !== null, lastOpenedAt: now }
      : {
          id: createId("project"),
          name: basename(absolute),
          path: absolute,
          gitRoot,
          isGitRepository: gitRoot !== null,
          createdAt: now,
          lastOpenedAt: now,
          metadata: {},
        };

    this.projectRepo.upsert(project);
    this.stateManager.update((s) => {
      const idx = s.project.projects.findIndex((p) => p.id === project.id);
      if (idx >= 0) s.project.projects[idx] = project;
      else s.project.projects.push(project);
      s.project.currentProjectId = project.id;
    });
    this.eventManager.emit("project.opened", { payload: project });
    return project;
  }

  getCurrent(): ProjectInfo | null {
    const id = this.stateManager.getState().project.currentProjectId;
    return id ? this.projectRepo.findByPath(this.stateManager.getState().project.projects.find((p) => p.id === id)?.path ?? "") : null;
  }

  list(): ProjectInfo[] {
    return this.projectRepo.list();
  }

  private findExisting(path: string): ProjectInfo | null {
    const byPath = this.projectRepo.findByPath(path);
    if (byPath) return byPath;
    // Case/separator-insensitive fallback for Windows.
    return this.projectRepo.list().find((p) => pathsEqual(p.path, path)) ?? null;
  }
}

function detectGitRoot(cwd: string): string | null {
  try {
    const out = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      shell: false,
    }).trim();
    return out ? normalizePath(resolve(out)) : null;
  } catch {
    return null;
  }
}
