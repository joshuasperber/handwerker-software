import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  assignmentNotificationFn,
  staffRequestCreatedFn,
  staffRequestRespondedFn,
} from "@/inngest/functions/notifications";
import { manualDailyJobsFn } from "@/inngest/functions/daily-jobs";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    assignmentNotificationFn,
    staffRequestCreatedFn,
    staffRequestRespondedFn,
    manualDailyJobsFn,
  ],
});
