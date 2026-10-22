// Tells the suite whether the operator configured the optional AI classification (yes/no only, no key material).
import { handleSuiteApi } from "@/lib/suite-api.mjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleSuiteApi(request, process.env);
}
