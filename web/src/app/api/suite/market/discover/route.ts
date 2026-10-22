// GLB AI Suite v1.1 server function; logic and checks in src/lib/suite-api.mjs (tested in suite-tests/v11/api.test.mjs).
import { handleSuiteApi } from "@/lib/suite-api.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleSuiteApi(request, process.env);
}
