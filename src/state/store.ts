import { useSyncExternalStore } from "react";
import { Repo } from "../data/repo";

export const repo = new Repo();

let initPromise: Promise<void> | null = null;

/** StrictMode 下 effect 会跑两次，这里保证只初始化一次。 */
export function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = repo.init();
  return initPromise;
}

export function useSnapshot() {
  return useSyncExternalStore(repo.subscribe, repo.getSnapshot);
}

export function useRepoReady() {
  return useSyncExternalStore(
    repo.subscribe,
    () => repo.ready
  );
}
