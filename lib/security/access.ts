/**
 * Whether the app asks for the team passcode. Off by default: the app opens for anyone with the link, so a hackathon judge
 * can try it without a password. Set REQUIRE_PASSCODE=true to turn the passcode back on; nothing else changes.
 */
export const passcodeRequired = (): boolean => process.env.REQUIRE_PASSCODE === 'true';
