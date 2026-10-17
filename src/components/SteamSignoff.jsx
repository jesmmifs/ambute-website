export default function SteamSignoff() {
  return (
    <footer className="steam-signoff" aria-labelledby="steam-title">
      <div className="steam-signoff__inner">
        <p id="steam-title">Coming soon on</p>
        <img
          src="./assets/brand/steam-logo-white.png"
          width="300"
          height="105"
          alt="Steam"
        />
        <nav className="steam-signoff__social" aria-label="Follow Ambute">
          <p>Follow Ambute</p>
          <div>
            <a
              href="https://www.instagram.com/ambute_pet/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Ambute on Instagram"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4.15" />
                <circle className="social-icon__dot" cx="17.4" cy="6.7" r="0.9" />
              </svg>
              <span>Instagram</span>
            </a>
            <a
              href="https://www.tiktok.com/@ambute26"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Ambute on TikTok"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.7 3.2v11.1a4.55 4.55 0 1 1-3.65-4.46" />
                <path d="M14.7 3.2c.42 2.46 1.98 3.94 4.3 4.28" />
              </svg>
              <span>TikTok</span>
            </a>
          </div>
        </nav>
        <p className="steam-signoff__legal">
          ©2026 Valve Corporation. Steam and the Steam logo are trademarks
          and/or registered trademarks of Valve Corporation in the U.S. and/or
          other countries.
        </p>
      </div>
    </footer>
  );
}
