import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/schema";
import { ContactContent } from "./contact-content";

export const metadata: Metadata = buildMetadata({
  title: "Contact DSAspire",
  description:
    "Get in touch with the DSAspire team — questions, feedback, bug reports, collaboration and partnership enquiries.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
      <ContactContent />
    </>
  );
}
