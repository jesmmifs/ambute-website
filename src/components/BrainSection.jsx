import { useEffect, useRef, useState } from "react";

const brainOptions = [
  {
    title: "Cloud API",
    text: "Connect an online AI provider when you want Ambute's mind to reach outward."
  },
  {
    title: "Local LLM",
    text: "Run a model on your own computer and let Ambute think close to home."
  },
  {
    title: "Free mode",
    text: "Download and meet Ambute without setting up AI first."
  },
  {
    title: "Tools & context",
    text: "Give Ambute weather, headlines, or your own APIs so it can react to the world."
  }
];

export default function BrainSection() {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.22 }
    );
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`brain${isVisible ? " brain--visible" : ""}`}
      aria-labelledby="brain-title"
    >
      <div className="brain__copy">
        <p className="brain__prelude">The mind is optional. The creature is not.</p>
        <h2 id="brain-title">Choose its brain.</h2>
        <p className="brain__lead">
          Ambute can think through the AI model you connect. Use a cloud API, a
          local LLM, or start with the free version before connecting a brain at
          all.
        </p>
        <p className="brain__body">
          Add tools like weather, headlines, or any other API, and Ambute can use
          that context when it thinks, speaks, and chooses what to do.
        </p>
      </div>

      <div className="brain-map" aria-label="Ways to connect Ambute's brain">
        <svg
          className="brain-map__paths"
          viewBox="0 0 640 520"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M320 260 C 250 190, 185 138, 110 108" />
          <path d="M320 260 C 405 178, 488 132, 542 104" />
          <path d="M320 260 C 218 322, 156 372, 96 430" />
          <path d="M320 260 C 418 320, 500 380, 556 438" />
        </svg>

        <div className="brain-map__core" aria-label="Ambute's first form" />

        {brainOptions.map((option, index) => (
          <div
            key={option.title}
            className={`brain-map__node brain-map__node--${index + 1}`}
          >
            <span>{option.title}</span>
            <p>{option.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
