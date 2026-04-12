export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <section className="panel privacy-page">
        <p className="eyebrow">Trust & Safety</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          Privacy & Data Usage
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This app is designed to feel simple, safe, and transparent.
        </p>

        <div className="privacy-points">
          <div className="privacy-point">
            <strong>Your data is used only to generate results for this workflow.</strong>
            <p>The app is designed to keep processing focused on the current session.</p>
          </div>
          <div className="privacy-point">
            <strong>No hidden data selling or profiling.</strong>
            <p>Your conversation is not used for advertising or marketing.</p>
          </div>
          <div className="privacy-point">
            <strong>Refreshing clears the active workspace view.</strong>
            <p>Some recent session details may remain in your browser for convenience until you clear them.</p>
          </div>
          <div className="privacy-point">
            <strong>Share links are optional.</strong>
            <p>Data is shared only when you explicitly create a share link.</p>
          </div>
        </div>

        <div className="privacy-note">
          Avoid sharing highly sensitive information such as Aadhaar, PAN, bank details, or other confidential identifiers.
        </div>
      </section>
    </div>
  );
}
