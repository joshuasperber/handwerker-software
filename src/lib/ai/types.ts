export type AiIntentType =
  | "person_lookup"
  | "list_employees"
  | "list_customers"
  | "employee_orders"
  | "employee_materials"
  | "order_search"
  | "open_invoices"
  | "missing_receipts"
  | "profit_analysis"
  | "material_shortage"
  | "machine_usage"
  | "team_schedule"
  | "disambiguation"
  | "help"
  | "unknown";

export interface AiIntent {
  type: AiIntentType;
  personName?: string;
  searchTerm?: string;
  teamName?: string;
  date?: Date;
  dateEnd?: Date;
  disambiguationChoice?: "employee" | "customer";
  rawMessage: string;
}

export interface PersonMatch {
  type: "employee" | "customer";
  id: string;
  firstName: string;
  lastName: string;
  label: string;
  role?: string;
  email?: string;
  phone?: string | null;
}

export interface AiDataSource {
  type: string;
  count: number;
  label: string;
}

export interface AiChatResult {
  content: string;
  intent: AiIntentType;
  dataSources: AiDataSource[];
  confidence: "high" | "medium" | "low";
  missingData?: string[];
  disambiguationOptions?: PersonMatch[];
}

export interface AiMessageMetadata {
  intent?: AiIntentType;
  dataSources?: AiDataSource[];
  confidence?: "high" | "medium" | "low";
  missingData?: string[];
  disambiguationOptions?: PersonMatch[];
}
