const formEndpoint = "https://formsubmit.co/mifsud.jesmond@gmail.com";

export default function SupportPage() {
  const submitted = new URLSearchParams(window.location.search).get("sent") === "1";

  return (
    <main className="support-page">
      <div className="support-cloud support-cloud--one" aria-hidden="true" />
      <div className="support-cloud support-cloud--two" aria-hidden="true" />
      <header className="support-header">
        <a href="./" aria-label="Return to the Ambute home page">
          <span>Ambute</span>
          <small>Back home</small>
        </a>
      </header>

      <section className="support-card" aria-labelledby="support-title">
        <p className="support-card__eyebrow">Ambute support</p>
        <h1 id="support-title">
          {submitted ? "Your message is on its way." : "How can we help?"}
        </h1>

        {submitted ? (
          <div className="support-success" role="status">
            <div aria-hidden="true">✓</div>
            <p>
              Thank you for getting in touch. We’ll read your message and reply
              to the email address you provided.
            </p>
            <a href="./support.html">Send another message</a>
          </div>
        ) : (
          <>
            <p className="support-card__intro">
              Tell us what happened or what you’re wondering about. Include any
              details that may help us understand the problem.
            </p>

            <form
              className="support-form"
              action={formEndpoint}
              method="POST"
              acceptCharset="UTF-8"
            >
              <input type="hidden" name="_subject" value="New Ambute support request" />
              <input type="hidden" name="_template" value="table" />
              <input type="hidden" name="_next" value="https://ambute.com/support.html?sent=1" />
              <input type="hidden" name="_url" value="https://ambute.com/support.html" />
              <input
                className="support-form__honey"
                type="text"
                name="_honey"
                tabIndex="-1"
                autoComplete="off"
                aria-hidden="true"
              />

              <div className="support-form__row">
                <label>
                  <span>Your name</span>
                  <input name="name" type="text" autoComplete="name" required />
                </label>
                <label>
                  <span>Email address</span>
                  <input name="email" type="email" autoComplete="email" required />
                </label>
              </div>

              <label>
                <span>What can we help with?</span>
                <select name="topic" defaultValue="Technical problem" required>
                  <option>Technical problem</option>
                  <option>Bug report</option>
                  <option>Gameplay question</option>
                  <option>Feedback</option>
                  <option>Something else</option>
                </select>
              </label>

              <label>
                <span>Message</span>
                <textarea name="message" rows="7" maxLength="5000" required />
              </label>

              <button type="submit">Send message</button>
              <p className="support-form__privacy">
                This form uses FormSubmit to deliver your message by email. Your
                details help us respond to your request. Please don’t include
                passwords or other sensitive information.
              </p>
            </form>
          </>
        )}
      </section>

      <footer className="support-footer">
        <p>© 2026 Ambute</p>
      </footer>
    </main>
  );
}
