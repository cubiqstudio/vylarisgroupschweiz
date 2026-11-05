import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui/section";
import { ContactForm } from "@/components/contact/contact-form";
import { ContactAside } from "@/components/contact/contact-aside";
import { BrandMark } from "@/components/contact/brand-mark";
import { TICKET_CATEGORIES, type TicketCategory } from "@/lib/constants";
import { getMessages } from "@/i18n/server";
import { contact } from "@/i18n/contact";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(contact);
  return {
    title: m.meta.title,
    description: m.meta.description,
    alternates: { canonical: "/contact" },
  };
}

function parseCategory(value: string | string[] | undefined): TicketCategory {
  const v = Array.isArray(value) ? value[0] : value;
  return (TICKET_CATEGORIES as readonly string[]).includes(v ?? "")
    ? (v as TicketCategory)
    : "GENERAL";
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const m = await getMessages(contact);
  const sp = await searchParams;
  const initialCategory = parseCategory(sp.category);

  return (
    <>
      <PageHeader
        eyebrow={m.hero.eyebrow}
        title={m.hero.title}
        description={m.hero.description}
      />
      <Container className="py-12 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
          <ContactForm
            initialCategory={initialCategory}
            mark={<BrandMark tone="onDark" className="size-12" />}
          />
          <ContactAside />
        </div>
      </Container>
    </>
  );
}
