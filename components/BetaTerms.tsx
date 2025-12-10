import React from 'react';

const BetaTerms: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 px-5 py-10">
      <main className="max-w-4xl mx-auto space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Legal</p>
          <h1 className="text-3xl font-bold text-white">Beta Terms and Privacy Policy</h1>
          <p className="text-sm text-gray-400">
            This page outlines the Beta Terms and the Privacy Policy for participants in the beta program.
          </p>
        </header>

        <section className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-semibold text-white">Beta Terms</h2>
          <div className="space-y-4 text-sm text-gray-200 leading-relaxed">
            <div>
              <h3 className="font-semibold text-white">1. Eligibility and Scope</h3>
              <p>
                Participation in the Beta Program ("Beta") is invite-only and intended solely for evaluation of
                pre-release features. The Beta is provided on a temporary basis, may change without notice, and may be
                discontinued at any time. The Beta is not intended for production use.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">2. License and Access</h3>
              <p>
                We grant you a limited, revocable, non-exclusive, non-transferable license to access and use the Beta
                solely for testing and providing feedback. You may not sublicense, resell, or share your access with
                others. Reverse engineering, competitive analysis, or benchmarking without prior written consent is
                prohibited.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">3. Confidentiality</h3>
              <p>
                All Beta features, documentation, and performance information constitute our confidential information.
                You agree not to disclose, publish, or share screenshots, feature details, or results with third parties
                without prior authorization.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">4. Feedback</h3>
              <p>
                Any suggestions, comments, or ideas you provide ("Feedback") may be used by us royalty-free, worldwide,
                irrevocably, to improve or develop the product. We are not obligated to implement your Feedback.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">5. Availability and Support</h3>
              <p>
                The Beta may experience interruptions, delays, errors, or data loss. Features may be added, changed, or
                removed at any time. No service-level agreements or guaranteed support obligations apply during the
                Beta.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">6. Updates and Telemetry</h3>
              <p>
                The Beta may update automatically. We may collect usage metrics, diagnostic information, and technical
                logs as described in the Privacy Policy.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">7. Security and Compliance</h3>
              <p>
                You must not input or store regulated, sensitive, or legally protected data (e.g., financial account
                numbers, health data, government-issued IDs). You are responsible for maintaining the confidentiality of
                your account and ensuring your inputs comply with applicable laws.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">8. Prohibited Use</h3>
              <p>
                You agree not to use the Beta for unlawful activities, automated scraping, abuse, harassment, spam
                generation, model-extraction attempts, or any effort to bypass rate limits, quotas, or security
                controls.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">9. Termination</h3>
              <p>
                We may suspend or revoke your access to the Beta at our discretion at any time. You may stop using the
                Beta at any time. Upon termination, your license to use the Beta ends immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">10. Disclaimers</h3>
              <p>
                The Beta is provided "AS IS" and "AS AVAILABLE," without warranties of any kind, whether express or
                implied. We are not liable for data loss, business interruption, or consequential damages arising from
                Beta use.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">11. Governing Law</h3>
              <p>
                These terms are governed by the laws of [Jurisdiction], without regard to conflict-of-law principles.
                Disputes shall be resolved through [arbitration / courts of jurisdiction].
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold text-white">Privacy Policy</h2>
            <p className="text-xs text-gray-400">Last Updated: [Date]</p>
          </div>
          <div className="space-y-4 text-sm text-gray-200 leading-relaxed">
            <div>
              <h3 className="font-semibold text-white">1. Information We Collect</h3>
              <p className="text-gray-200 font-semibold mt-2">1.1 Account Information</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>Email address</li>
                <li>Name (if provided through OAuth)</li>
                <li>Authentication identifiers</li>
                <li>Invite code or access status</li>
              </ul>
              <p className="text-gray-200 font-semibold mt-3">1.2 Product Usage Data</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>Actions performed in the product</li>
                <li>Device, browser, and operating system metadata</li>
                <li>Performance metrics, event logs, and crash diagnostics</li>
                <li>Rate-limit or quota-related events</li>
              </ul>
              <p className="text-gray-200 font-semibold mt-3">1.3 User Content</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>Text, prompts, and files you submit for processing</li>
                <li>Generated outputs produced for you</li>
              </ul>
              <p className="mt-2 text-gray-300">We do not use your content to train public models.</p>
            </div>

            <div>
              <h3 className="font-semibold text-white">2. How We Use Information</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>Deliver core product functionality</li>
                <li>Authenticate and secure user accounts</li>
                <li>Enforce usage limits and detect abuse</li>
                <li>Improve reliability, performance, and usability</li>
                <li>Provide diagnostics, analytics, and error investigation</li>
                <li>Communicate service-related notices</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white">3. Sharing of Information</h3>
              <p className="text-gray-200 font-semibold mt-2">3.1 Service Providers</p>
              <p className="text-gray-300">
                We may share information with infrastructure, authentication, logging, analytics, or email service
                providers under contractual confidentiality and data-protection obligations.
              </p>
              <p className="text-gray-200 font-semibold mt-3">3.2 Legal and Safety Requirements</p>
              <p className="text-gray-300">
                We may disclose information when required by law, legal process, or governmental request, or when
                necessary to protect the security or rights of the service or its users.
              </p>
              <p className="text-gray-200 font-semibold mt-3">3.3 No Sale of Personal Data</p>
              <p className="text-gray-300">We do not sell personal data or permit third-party marketing.</p>
            </div>

            <div>
              <h3 className="font-semibold text-white">4. Data Retention</h3>
              <p className="text-gray-300">
                We retain personal data only as long as necessary for the purposes described or to comply with legal
                obligations. User-submitted content may be stored temporarily for processing, unless deletion is
                requested.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">5. User Rights and Controls</h3>
              <p className="text-gray-300">Depending on your jurisdiction, you may have rights to:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>Access or export your personal data</li>
                <li>Request correction or deletion</li>
                <li>Request restrictions or object to processing</li>
                <li>Opt out of non-essential analytics where feasible</li>
              </ul>
              <p className="text-gray-300 mt-2">You may contact us at [contact email] to make a request.</p>
            </div>

            <div>
              <h3 className="font-semibold text-white">6. Security</h3>
              <p className="text-gray-300">
                We employ industry-standard technical and organizational measures, including encryption in transit,
                access controls, and audit logging. However, no system can guarantee absolute security.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">7. International Data Transfers</h3>
              <p className="text-gray-300">
                Data may be processed or stored in [regions such as US/EU]. When personal data is transferred across
                borders, we use appropriate safeguards as required by applicable law.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">8. AI/LLM Processing</h3>
              <p className="text-gray-300">
                Your inputs and outputs may be processed by large language model providers under our instructions and
                agreements. Your content is not used to train public models and is handled according to this Privacy
                Policy.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">9. Cookies and Tracking Technologies</h3>
              <p className="text-gray-300">We may use:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>Essential cookies for authentication, security, and session continuity</li>
                <li>Analytics cookies to understand product usage (opt-out available where required)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white">10. Changes to This Policy</h3>
              <p className="text-gray-300">
                We may update these Terms or this Privacy Policy periodically. Material changes will be communicated via
                email, banner notification, or in-product message. Continued use after changes constitutes acceptance.
              </p>
            </div>
          </div>
        </section>

        <footer className="text-xs text-gray-500">
          Placeholders such as [Jurisdiction], [arbitration / courts of jurisdiction], [Date], and [contact email] should
          be updated before publishing.
        </footer>
      </main>
    </div>
  );
};

export default BetaTerms;
