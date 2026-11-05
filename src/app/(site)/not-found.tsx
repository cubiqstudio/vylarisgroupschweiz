import { Container } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { getMessages } from "@/i18n/server";
import { shell } from "@/i18n/shell";

export default async function NotFound() {
  const m = (await getMessages(shell)).notFound;
  return (
    <Container className="py-32 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">
        {m.eyebrow}
      </p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
        {m.heading}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-zinc-400">{m.text}</p>
      <ButtonLink href="/" className="mt-8">
        {m.toHome}
      </ButtonLink>
    </Container>
  );
}
