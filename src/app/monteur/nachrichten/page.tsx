"use client";

import { MessagesInbox } from "@/components/messages/messages-inbox";

export default function MonteurNachrichtenPage() {
  return <MessagesInbox compact showDirectCompose ordersApiUrl="/api/monteur/orders" />;
}
