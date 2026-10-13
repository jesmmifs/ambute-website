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
        <p className="steam-signoff__legal">
          ©2026 Valve Corporation. Steam and the Steam logo are trademarks
          and/or registered trademarks of Valve Corporation in the U.S. and/or
          other countries.
        </p>
      </div>
    </footer>
  );
}
