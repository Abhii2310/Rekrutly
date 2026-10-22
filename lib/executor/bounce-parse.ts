export type Bounce = { email: string; notFound: boolean };

/** Pure. Pulls the failed recipient out of a delivery-failure notice. `notFound` is true when the address does not exist. */
export function parseBounce(source: string): Bounce | null {
  const recipient = /Final-Recipient:\s*rfc822;\s*([^\s<>]+@[^\s<>]+)/i.exec(source)?.[1] ?? /wasn't delivered to\s+([^\s<>]+@[^\s<>]+)/i.exec(source)?.[1];
  if (!recipient) return null;
  const notFound = /Status:\s*5\.1\.1/i.test(source) || /NoSuchUser|mailbox not found|does not exist|user unknown/i.test(source);
  return { email: recipient.toLowerCase(), notFound };
}
