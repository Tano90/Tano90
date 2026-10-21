import { ArrowRight, Check, Info, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewBeacon } from "@/components/landing/lead-form";
import { Reveal } from "@/components/landing/motion";
import { Scene } from "@/components/landing/scenes";
import { SiteFooter, SiteHeader } from "@/components/landing/site-chrome";
import { APP_NAME } from "@/lib/brand";
import { INDUSTRIES, industry } from "@/lib/industries";
import { LAUNCH_MODE } from "@/lib/launch";
import { PRICING } from "@/lib/pricing";

export const dynamicParams = false;
export const generateStaticParams = () => INDUSTRIES.map((i) => ({ slug: i.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const i = industry((await params).slug);
  return i ? { title: `${APP_NAME} für ${i.name}`, description: i.lead } : {};
}

const waitlist = LAUNCH_MODE === "waitlist";
const cta = waitlist ? { href: "/#anfrage", label: "Vorführung anfragen" } : { href: "/signup", label: `${PRICING.trialDays} Tage kostenlos testen` };

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const i = industry((await params).slug);
  if (!i) notFound();
  return (
    <div className="bg-bg">
      <ViewBeacon />
      <div className="relative overflow-hidden bg-cream">
        <SiteHeader />
        <section aria-labelledby="hero" className="relative mx-auto grid max-w-(--size-content-max) items-center gap-10 px-4 pt-6 pb-16 lg:grid-cols-2 lg:px-8 lg:pt-10 lg:pb-24">
          <div className="min-w-0 animate-rise">
            <p className="mb-4 inline-flex items-center gap-2 rounded-pill bg-bg px-3 py-1 text-xs text-text-muted shadow-card">
              <span aria-hidden className="size-2 rounded-pill bg-saffron" /> {APP_NAME} für {i.name}
            </p>
            <h1 id="hero" className="text-display hyphens-auto break-words">{i.title}</h1>
            <p className="mt-5 max-w-xl text-base text-text-muted lg:text-lg lg:font-normal">{i.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={cta.href} className="inline-flex h-(--size-control-lg) items-center gap-2 rounded-pill bg-accent px-6 text-base font-bold text-on-accent shadow-glow hover:bg-accent-hover">{cta.label} <ArrowRight aria-hidden className="size-4" /></Link>
              <Link href="/#ausprobieren" className="inline-flex h-(--size-control-lg) items-center rounded-pill border border-border-input bg-bg px-6 text-base font-semibold hover:bg-row-hover">Live ausprobieren</Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl animate-rise [animation-delay:150ms]">
            <Scene industry={i.slug} className="h-auto w-full" />
            {i.cards.map((c, n) => (
              <div key={c.title} className={`absolute w-52 animate-float rounded-md border border-border bg-bg/95 p-3 shadow-pop ${n === 0 ? "top-[4%] left-0" : "right-0 bottom-[2%] [animation-delay:2s]"}`}>
                <p className="flex items-center gap-2 text-sm font-semibold"><Check aria-hidden className="size-4 text-success" />{c.title}</p>
                <p className="mt-1 text-xs text-text-muted">{c.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <main>
        <section aria-labelledby="pains" className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-wide text-accent">Kennst du das?</p>
            <h2 id="pains" className="mt-2 text-xl lg:text-display">Was im Alltag Geld kostet</h2>
          </Reveal>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {i.pains.map((p, n) => (
              <li key={p}><Reveal delay={n * 120} className="h-full">
                <div className="flex h-full gap-3 rounded-lg border border-border bg-surface p-6">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-danger-subtle text-danger"><X aria-hidden className="size-4" /></span>
                  <p className="text-base">{p}</p>
                </div>
              </Reveal></li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="helps" className="bg-cream">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-wide text-accent">So hilft {APP_NAME}</p>
              <h2 id="helps" className="mt-2 text-xl lg:text-display">Für {i.name === "Kantine" ? "Kantinen" : i.name === "Catering" ? "Caterer" : `${i.name}s`} gebaut</h2>
            </Reveal>
            <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {i.features.map(({ icon: Icon, title, body }, n) => (
                <li key={title}><Reveal delay={(n % 3) * 120} className="h-full">
                  <div className="h-full rounded-lg bg-bg p-6 shadow-card transition-transform duration-base hover:-translate-y-1">
                    <span className={`inline-flex size-11 items-center justify-center rounded-md ${["bg-accent text-on-accent", "bg-carrot text-on-saffron", "bg-celery text-on-saffron"][n % 3]}`}><Icon aria-hidden className="size-5" /></span>
                    <h3 className="mt-4 text-lg">{title}</h3>
                    <p className="mt-1 text-text-muted">{body}</p>
                  </div>
                </Reveal></li>
              ))}
            </ul>
            {i.note && (
              <p className="mt-8 flex max-w-3xl gap-2 rounded-md border border-border bg-bg p-4 text-sm text-text-muted">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />{i.note}
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="others" className="mx-auto max-w-(--size-content-max) px-4 py-16 lg:px-8">
          <h2 id="others" className="text-lg">Andere Branchen</h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {INDUSTRIES.filter((x) => x.slug !== i.slug).map((x) => (
              <li key={x.slug}><Link href={`/branchen/${x.slug}`} className="inline-flex items-center gap-2 rounded-pill border border-border-input px-4 py-2 font-semibold hover:bg-row-hover">{APP_NAME} für {x.name} <ArrowRight aria-hidden className="size-4" /></Link></li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="final" className="relative overflow-hidden bg-ink text-on-ink">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_120%,var(--color-accent)_0%,transparent_70%)]" />
          <div className="relative mx-auto max-w-(--size-content-max) px-4 py-20 text-center lg:px-8">
            <h2 id="final" className="mx-auto max-w-3xl text-xl lg:text-display">30 Minuten, deine eigenen Zahlen, unverbindlich.</h2>
            <div className="mt-8 flex justify-center"><Link href={cta.href} className="inline-flex h-(--size-control-lg) items-center gap-2 rounded-pill bg-saffron px-6 text-base font-bold text-on-saffron">{cta.label} <ArrowRight aria-hidden className="size-4" /></Link></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
