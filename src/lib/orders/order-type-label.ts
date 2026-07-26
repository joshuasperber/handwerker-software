import { ORDER_TYPE_LABELS } from "@/lib/inventory/formulas";

export function formatOrderTypeLabel(input: {
  orderTypeLabel?: string | null;
  orderTypeCustom?: string | null;
  orderType?: string | null;
  orderTypeDefinition?: { name: string; isOther: boolean } | null;
}): string {
  const custom = input.orderTypeCustom?.trim();
  if (custom) return custom;

  if (input.orderTypeLabel?.trim()) return input.orderTypeLabel.trim();
  if (input.orderTypeDefinition?.name) return input.orderTypeDefinition.name;
  if (input.orderType && ORDER_TYPE_LABELS[input.orderType]) {
    return ORDER_TYPE_LABELS[input.orderType];
  }
  return "—";
}
