import { useSyncExternalStore } from "react";
import { router } from "../router";

export class Omleiding extends Error {
  constructor(public naar: string) {
    super("omleiding");
  }
}
export class NietGevonden extends Error {
  constructor() {
    super("niet gevonden");
  }
}

export function redirect(naar: string): never {
  throw new Omleiding(naar);
}
export function notFound(): never {
  throw new NietGevonden();
}
export function usePathname() {
  return useSyncExternalStore(router.abonneer, () => router.pad().split("?")[0]);
}
export function useRouter() {
  return { push: (p: string) => router.ga(p), replace: (p: string) => router.ga(p), refresh: () => router.ververs(), back: () => {} };
}
