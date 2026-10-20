import Link from "next/link";

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-xl">Kitchen Ledger</h1>
      <p className="mt-2 text-text-muted">
        Noch keine Screens. Das Designsystem liegt unter{" "}
        <Link className="text-accent underline" href="/design">
          /design
        </Link>
        .
      </p>
    </main>
  );
}
