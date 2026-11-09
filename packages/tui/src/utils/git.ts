import { execFileSync } from "node:child_process";

export interface GitStatus {
  branch: string | null;
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
  isRepository: boolean;
}

/**
 * Read-only Git workspace status. Never performs destructive operations and
 * never attributes all workspace changes to the agent.
 */
export function getGitStatus(cwd: string): GitStatus {
  const empty: GitStatus = { branch: null, modified: 0, added: 0, deleted: 0, untracked: 0, isRepository: false };
  try {
    const branch = runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]).trim() || null;
    const porcelain = runGit(cwd, ["status", "--porcelain"]);
    const status = parsePorcelain(porcelain);
    return { branch, ...status, isRepository: true };
  } catch {
    return empty;
  }
}

export function parsePorcelain(porcelain: string): Pick<GitStatus, "modified" | "added" | "deleted" | "untracked"> {
  const result = { modified: 0, added: 0, deleted: 0, untracked: 0 };
  for (const line of porcelain.split("\n")) {
    if (!line.trim()) continue;
    const code = line.slice(0, 2);
    if (code === "??") result.untracked++;
    else {
      if (code[0] === "A" || code[1] === "A") result.added++;
      if (code[0] === "D" || code[1] === "D") result.deleted++;
      if (code[0] === "M" || code[1] === "M") result.modified++;
    }
  }
  return result;
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
    shell: false,
  });
}
