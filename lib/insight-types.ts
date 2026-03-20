export type VeeroInsightInput = {
  amount: string;
  note?: string;
  recipient: `0x${string}`;
  recipientName?: string;
  timestamp: string;
  token: "USDC";
};

export type VeeroInsightsRequest = {
  payments: VeeroInsightInput[];
};

export type VeeroInsightLabelSuggestion = {
  originalNote: string;
  suggestedLabel: string;
};

export type VeeroInsightsTopContact = {
  address: `0x${string}` | null;
  name: string | null;
  reason: string;
};

export type VeeroInsightsTopCategory = {
  label: string | null;
  reason: string;
};

export type VeeroInsightsResponse = {
  summary: string;
  topContact: VeeroInsightsTopContact;
  topCategory: VeeroInsightsTopCategory;
  labelSuggestions: VeeroInsightLabelSuggestion[];
};
