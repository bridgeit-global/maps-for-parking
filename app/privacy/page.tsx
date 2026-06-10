import type { Metadata } from "next";
import LegalPageLayout from "../components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | Maps for Parking",
  description:
    "How Maps for Parking collects, uses, and protects your information.",
};

const LAST_UPDATED = "June 10, 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <section>
        <h2 className="text-lg font-semibold text-white">1. Introduction</h2>
        <p className="mt-2">
          Maps for Parking (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is
          operated by Bridgeit. This Privacy Policy explains how we handle
          information when you use our website and interactive parking map for
          Mumbai (the &quot;Service&quot;).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          2. Information we collect
        </h2>
        <p className="mt-2">We may collect the following types of information:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong className="text-white/90">Location data:</strong> If you
            enable location services in your browser, we use your device&apos;s
            approximate or precise location to show your position on the map and
            help you find nearby parking zones. Location access is optional and
            controlled by your browser.
          </li>
          <li>
            <strong className="text-white/90">Usage data:</strong> We may
            collect standard technical information such as browser type, device
            type, pages viewed, and interactions with the map (for example,
            zoom level or features tapped).
          </li>
          <li>
            <strong className="text-white/90">Communications:</strong> If you
            contact us for support, we collect the information you provide
            (such as your name, email, and message content).
          </li>
        </ul>
        <p className="mt-2">
          We do not require you to create an account to use the Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          3. How we use your information
        </h2>
        <p className="mt-2">We use collected information to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Provide, operate, and improve the Service</li>
          <li>Display parking zones and related information on the map</li>
          <li>Respond to support requests</li>
          <li>Monitor performance, fix errors, and prevent abuse</li>
          <li>Comply with applicable legal obligations</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          4. Third-party services
        </h2>
        <p className="mt-2">
          The Service relies on third-party providers to deliver map tiles and
          parking data, including Mapbox, MapLibre GL, CARTO basemaps, and
          OpenStreetMap contributors. When you use the map, your browser may
          send requests (including IP address and approximate location) to these
          providers according to their own privacy policies.
        </p>
        <p className="mt-2">
          The Service may link to external websites (for example, government
          challan payment portals). We are not responsible for the privacy
          practices of those third-party sites.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          5. Cookies and local storage
        </h2>
        <p className="mt-2">
          We may use essential cookies or browser local storage to remember
          preferences (such as language settings) and to keep the Service
          functioning. We do not use cookies for targeted advertising.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">6. Data retention</h2>
        <p className="mt-2">
          We retain information only as long as necessary to provide the
          Service, resolve disputes, enforce our agreements, and meet legal
          requirements. Location data processed in your browser is not stored
          on our servers unless you explicitly submit it to us (for example, in
          a support message).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">7. Data security</h2>
        <p className="mt-2">
          We implement reasonable technical and organisational measures to
          protect information. However, no method of transmission over the
          internet or electronic storage is completely secure.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">8. Your rights</h2>
        <p className="mt-2">
          Depending on applicable law, you may have the right to access,
          correct, delete, or restrict processing of your personal information,
          or to withdraw consent where processing is consent-based. You can
          disable location access at any time through your browser or device
          settings.
        </p>
        <p className="mt-2">
          To exercise your rights or ask questions about this policy, contact us
          at{" "}
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

      <section>
        <h2 className="text-lg font-semibold text-white">
          9. Children&apos;s privacy
        </h2>
        <p className="mt-2">
          The Service is not directed at children under 13. We do not knowingly
          collect personal information from children.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          10. Changes to this policy
        </h2>
        <p className="mt-2">
          We may update this Privacy Policy from time to time. The &quot;Last
          updated&quot; date at the top of this page indicates when changes were
          last made. Continued use of the Service after changes constitutes
          acceptance of the updated policy.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">11. Contact</h2>
        <p className="mt-2">
          For privacy-related questions, reach us through{" "}
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
