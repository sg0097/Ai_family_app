/** For logs: enough to tell numbers apart, not enough to identify someone. */
export const maskPhone = (phone: string) => (phone.length > 4 ? `…${phone.slice(-4)}` : '…');

/** Normalise to WhatsApp's id format: digits only, with country code. Bare 10-digit numbers are treated as Indian. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}
