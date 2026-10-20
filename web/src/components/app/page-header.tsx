import { ChevronLeft } from "lucide-react";
import Link from "next/link";

type Props = {
  title: string;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, back, actions }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text">
            <ChevronLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="text-xl break-words">{title}</h1>
        {description && <div className="mt-1 text-text-muted">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
