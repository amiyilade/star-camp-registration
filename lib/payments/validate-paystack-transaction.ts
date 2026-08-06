type PaystackTransaction = {
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
};

export function validatePaystackTransaction({
  transaction,
  expectedReference,
  expectedAmountNgn
}: {
  transaction: PaystackTransaction;
  expectedReference: string;
  expectedAmountNgn: number;
}) {
  if (transaction.reference !== expectedReference) {
    throw new Error(
      "Paystack transaction reference mismatch."
    );
  }

  if (transaction.status !== "success") {
    throw new Error(
      "Paystack transaction was not successful."
    );
  }

  if (transaction.currency !== "NGN") {
    throw new Error(
      "Paystack transaction currency mismatch."
    );
  }

  const expectedAmountKobo = expectedAmountNgn * 100;

  if (transaction.amount !== expectedAmountKobo) {
    throw new Error(
      "Paystack transaction amount mismatch."
    );
  }
}