// "waitlist" before accounts and payments are set up: every call to action leads to the inquiry form.
// "open" once sign-up works: the trial is the main call to action, the inquiry form stays for larger groups.
export const LAUNCH_MODE: "waitlist" | "open" = process.env.NEXT_PUBLIC_LAUNCH_MODE === "waitlist" ? "waitlist" : "open";
