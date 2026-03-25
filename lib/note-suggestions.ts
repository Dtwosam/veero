type NoteSuggestionInput = {
  amount: string;
  note: string;
  recipient: string;
};

const NOTE_RULES: Array<{ match: RegExp; label: string }> = [
  { match: /coffee|cafe|latte/i, label: "Coffee" },
  { match: /food|lunch|dinner|grocer|grocery/i, label: "Food" },
  { match: /rent|lease/i, label: "Rent" },
  { match: /subscr|renew|monthly/i, label: "Subscription" },
  { match: /tool|tools|software|api|infra|hosting|domain|plugin/i, label: "Tools" },
  { match: /utilit|power|data|internet|airtime/i, label: "Utility" },
  { match: /travel|uber|taxi|transport|flight/i, label: "Travel" },
];

function normalizeSuggestion(value: string) {
  return value.trim().toLowerCase();
}

export async function getNoteSuggestion(
  note: string,
  recipient: string,
  amount: string,
) {
  const input: NoteSuggestionInput = {
    amount,
    note: note.trim(),
    recipient,
  };

  if (!input.note || input.note.length < 2) {
    return null;
  }

  await new Promise((resolve) => {
    window.setTimeout(resolve, 120);
  });

  const matchedRule = NOTE_RULES.find((rule) => rule.match.test(input.note));
  if (matchedRule) {
    return normalizeSuggestion(matchedRule.label) === normalizeSuggestion(input.note)
      ? null
      : matchedRule.label;
  }

  if (/^[a-z\s-]{2,24}$/i.test(input.note)) {
    const compactLabel = input.note
      .replace(/[^a-z0-9\s-]/gi, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");

    return compactLabel && normalizeSuggestion(compactLabel) !== normalizeSuggestion(input.note)
      ? compactLabel
      : null;
  }

  return null;
}
