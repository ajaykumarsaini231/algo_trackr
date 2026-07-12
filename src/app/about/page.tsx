import type { Metadata } from "next";
import { buildMetadata, SITE } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/schema";
import { AboutContent } from "./about-content";

export const metadata: Metadata = buildMetadata({
  title: "About DSAspire — Built by Ajay Kumar Saini",
  description:
    "DSAspire is built by Ajay Kumar Saini, a Full-Stack Developer at IIT Patna who has solved 650+ DSA problems. Learn about the creator, the mission, and the methodology behind the platform.",
  path: "/about",
  keywords: ["Ajay Kumar Saini", "DSAspire creator", "full stack developer", "IIT Patna"],
});

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Ajay Kumar Saini",
  jobTitle: "Full-Stack Developer",
  url: new URL("/about", SITE.url).toString(),
  email: "mailto:nabalsaini231@gmail.com",
  alumniOf: {
    "@type": "CollegeOrUniversity",
    name: "Indian Institute of Technology Patna",
  },
  knowsAbout: [
    "Data Structures and Algorithms",
    "Next.js",
    "React",
    "TypeScript",
    "Node.js",
    "System Design",
  ],
  sameAs: [
    "https://github.com/ajaykumarsaini231",
    "https://www.linkedin.com/in/ajay-kumar-saini",
  ],
  worksFor: { "@type": "Organization", name: "DSAspire", "@id": new URL("/#organization", SITE.url).toString() },
};

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={[
          personSchema,
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />
      <AboutContent />
    </>
  );
}
