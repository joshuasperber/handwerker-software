import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "jomaster" });

export function isInngestEnabled(): boolean {
  return Boolean(
    process.env.INNGEST_EVENT_KEY ||
      process.env.INNGEST_SIGNING_KEY ||
      process.env.INNGEST_DEV === "1"
  );
}
