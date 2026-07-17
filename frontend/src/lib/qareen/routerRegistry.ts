export interface QareenRouter {
  push: (href: string) => void;
}

/**
 * Same pattern as motion/engineRegistry.ts — the executor is a plain
 * module (not a component), but needs to trigger client-side navigation
 * for worker moves whose target lives on another /qareen/* route.
 */
let router: QareenRouter | null = null;

export function setQareenRouter(instance: QareenRouter | null): void {
  router = instance;
}

export function getQareenRouter(): QareenRouter | null {
  return router;
}
