export type TxStage = "preparing" | "wallet" | "confirming" | "success" | null;

export type SendPaymentInput = {
  amount: string;
  note?: string;
  recipient: `0x${string}`;
  recipientName?: string;
};

export type PendingPayment = SendPaymentInput | null;

export type SavedContact = {
  emoji?: string;
  id: string;
  name: string;
  address: `0x${string}`;
};

export type PaymentHistoryEntry = {
  id: string;
  timestamp: string;
  amount: string;
  token: "USDC";
  recipient: `0x${string}`;
  recipientName?: string;
  note?: string;
  transactionHash: `0x${string}`;
  status: "success";
};
