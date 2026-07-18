import { useEffect, useRef, useState } from "react";

const thoughts = [
  {
    label: "Need",
    text: "I feel a little hungry. I should find food soon."
  },
  {
    label: "Weather",
    text: "The rain outside makes the garden feel softer today."
  },
  {
    label: "Mood",
    text: "They spoke to me. I think I liked that."
  },
  {
    label: "Age",
    text: "I am older than yesterday. I wonder what I will become."
  }
];

const contextChips = ["needs", "weather", "mood", "age", "time", "personality"];

export default function ThoughtStreamSection() {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.24 }
    );
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`thoughts${isVisible ? " thoughts--visible" : ""}`}
      aria-labelledby="thoughts-title"
    >
      <div className="thoughts__copy">
        <p className="thoughts__prelude">Thoughts, needs, tiny plans.</p>
        <h2 id="thoughts-title">Peek inside its mind.</h2>
        <p className="thoughts__lead">
          Connect an AI model and Ambute can keep a visible stream of thought.
        </p>
        <p className="thoughts__body">
          Needs, weather, mood, age, time of day, and personality all become part
          of the little decisions you watch unfold.
        </p>

        <div className="thoughts__chips" aria-label="Thought stream context">
          {contextChips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </div>

      <div className="thought-stream" aria-label="Example Ambute thought stream">
        <div className="thought-stream__header">
          <span className="thought-stream__signal" aria-hidden="true" />
          <span>stream of thought</span>
          <span>live</span>
        </div>

        <div className="thought-stream__body">
          {thoughts.map((thought, index) => (
            <div
              key={thought.label}
              className="thought-stream__line"
              style={{ "--line-index": index }}
            >
              <span>{thought.label}</span>
              <p>{thought.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
