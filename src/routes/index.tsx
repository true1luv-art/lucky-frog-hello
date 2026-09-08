import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hello World" },
      { name: "description", content: "A simple Hello World app." },
      { property: "og:title", content: "Hello World" },
      { property: "og:description", content: "A simple Hello World app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-5xl font-bold tracking-tight text-foreground">
        Hello, World!
      </h1>
    </main>
  );
}
