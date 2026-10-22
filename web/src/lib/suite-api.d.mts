export function handleSuiteApi(request: Request, env?: Record<string, string | undefined>, fetchImpl?: typeof fetch): Promise<Response>;
export function verifySignature(raw: string, signature: string | null, secret: string): Promise<boolean>;
export function validateLine(line: unknown): string[];
export function sameOrigin(request: Request): boolean;
