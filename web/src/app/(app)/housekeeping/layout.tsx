import { AddonLocked, AddonTrialHint, addonState } from "@/components/app/addon-gate";
import { PageHeader } from "@/components/app/page-header";
import { canEditLibrary, requireSession } from "@/data/session";
import { HkTabs } from "./tabs";

// Housekeeping is a paid add-on: every page under it is gated here.
export default async function HousekeepingLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const addon = await addonState(s, "housekeeping");
  if (!addon.open) return (<><PageHeader title="Housekeeping" /><AddonLocked addon="housekeeping" s={s} /></>);
  return (
    <>
      <PageHeader title="Housekeeping" />
      {addon.trial && <AddonTrialHint addon="housekeeping" />}
      <HkTabs manager={canEditLibrary(s.role)} />
      {children}
    </>
  );
}
