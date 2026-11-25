import { router } from "../router";

export function revalidatePath(..._args: unknown[]) {
  queueMicrotask(() => router.ververs());
}
