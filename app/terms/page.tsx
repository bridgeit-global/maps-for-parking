import type { Metadata } from "next";
import LegalPageLayout from "../components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms & Conditions | Maps for Parking",
  description:
    "Terms and conditions for using the Maps for Parking service in Mumbai.",
};

const LAST_UPDATED = "June 10, 2026";

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms & Conditions" lastUpdated={LAST_UPDATED}>
      <section>
        <h2 className="text-lg font-semibold text-white">1. Agreement</h2>
        <p className="mt-2">
          By accessing or using Maps for Parking (the &quot;Service&quot;),
          operated by Bridgeit, you agree to these Terms &amp; Conditions. If
          you do not agree, please do not use the Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          2. Description of the Service
        </h2>
        <p className="mt-2">
          Maps for Parking provides an interactive map and informational content
          about parking zones, regulations, and related guidance in Mumbai. The
          Service is intended to help users make informed parking decisions.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          3. Not legal or official advice
        </h2>
        <p className="mt-2">
          Parking rules, fines, zone boundaries, and availability shown on the
          Service are provided for general informational purposes only. They may
          be incomplete, outdated, or inaccurate. Official rules are set by
          Mumbai Traffic Police, municipal authorities, and other government
          bodies.
        </p>
        <p className="mt-2">
          You are solely responsible for complying with all applicable traffic,
          parking, and local laws. Always follow on-site signage and official
          instructions. We do not guarantee that parking in a displayed zone
          is permitted at any given time.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          4. Acceptable use
        </h2>
        <p className="mt-2">You agree not to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Use the Service for any unlawful purpose</li>
          <li>
            Attempt to reverse engineer, scrape, or overload the Service or its
            data sources
          </li>
          <li>Interfere with the security or proper functioning of the Service</li>
          <li>
            Misrepresent the Service as an official government or traffic
            authority product
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          5. Third-party links and services
        </h2>
        <p className="mt-2">
          The Service may include links to third-party websites (such as
          government challan payment portals) and uses third-party map and data
          providers. We do not control and are not responsible for third-party
          content, availability, or practices. Your use of third-party services
          is at your own risk and subject to their terms.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          6. Intellectual property
        </h2>
        <p className="mt-2">
          The Service, including its design, branding, and original content, is
          owned by Bridgeit or its licensors and protected by applicable
          intellectual property laws. Map data, tiles, and open-source
          components remain subject to their respective licences. You may not
          copy, modify, or redistribute the Service except as permitted by law or
          with our written consent.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          7. Disclaimer of warranties
        </h2>
        <p className="mt-2">
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
          WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING
          BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR
          A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
          SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL
          COMPONENTS.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          8. Limitation of liability
        </h2>
        <p className="mt-2">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, BRIDGEIT AND ITS AFFILIATES,
          OFFICERS, EMPLOYEES, AND PARTNERS SHALL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
          ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE
          SERVICE — INCLUDING WITHOUT LIMITATION PARKING FINES, TOWING, VEHICLE
          DAMAGE, OR OTHER LOSSES RELATED TO PARKING DECISIONS.
        </p>
        <p className="mt-2">
          Our total liability for any claim relating to the Service shall not
          exceed the amount you paid us to use the Service in the twelve (12)
          months before the claim (or INR 1,000 if the Service was provided free
          of charge), unless a higher limit is required by applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">9. Indemnification</h2>
        <p className="mt-2">
          You agree to indemnify and hold harmless Bridgeit from any claims,
          damages, losses, or expenses (including reasonable legal fees) arising
          from your use of the Service, your violation of these Terms, or your
          violation of any rights of a third party.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          10. Changes to the Service and Terms
        </h2>
        <p className="mt-2">
          We may modify, suspend, or discontinue the Service at any time. We may
          also update these Terms. Material changes will be reflected by updating
          the &quot;Last updated&quot; date. Continued use after changes
          constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          11. Governing law and disputes
        </h2>
        <p className="mt-2">
          These Terms are governed by the laws of India. Any disputes shall be
          subject to the exclusive jurisdiction of the courts in Mumbai,
          Maharashtra, unless applicable law requires otherwise.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">12. Contact</h2>
        <p className="mt-2">
          Questions about these Terms can be directed to{" "}
          <a
            href="https://bridgeit.in"
            target="_blank"
            rel="noreferrer"
            className="text-[#6fb1ff] underline-offset-2 hover:underline"
          >
            bridgeit.in
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
