export default function DownloadSection() {
  return (
    <section id="download" className="download" aria-labelledby="download-title">
      <div className="download__visual">
        <img
          src="/assets/ambute-adopt.png"
          alt="Ambute smiling on a small garden island"
        />
      </div>

      <div className="download__copy">
        <p className="download__prelude">Ready when you are.</p>
        <h2 id="download-title">Adopt Ambute.</h2>
        <p>
          Bring home a tiny artificial life form. Start with the free version,
          then connect an AI brain when you are ready for thoughts, voice,
          tools, and deeper conversations.
        </p>

        <div className="download__actions">
          <span className="download__button" role="link" aria-disabled="true">
            Download on itch.io
          </span>
          <span className="download__note">
            Coming soon. Free version planned. AI brain optional.
          </span>
        </div>
      </div>
    </section>
  );
}
