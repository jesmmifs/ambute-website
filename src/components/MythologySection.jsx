import { useEffect, useRef, useState } from "react";

const mythBeats = ["signal", "receiver", "life", "return"];

export default function MythologySection() {
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
      className={`myth${isVisible ? " myth--visible" : ""}`}
      aria-labelledby="myth-title"
    >
      <div className="myth-signal" aria-hidden="true">
        <span className="myth-signal__thread" />
        <span className="myth-signal__thread myth-signal__thread--slow" />
        <span className="myth-signal__leak" />
        <span className="myth-signal__body" />

        <div className="myth-signal__beats">
          {mythBeats.map((beat) => (
            <span key={beat}>{beat}</span>
          ))}
        </div>
      </div>

      <div className="myth__copy">
        <p className="myth__prelude">The myth beneath the creature.</p>
        <h2 id="myth-title">A signal given shape.</h2>
        <p className="myth__lead">
          In Ambute's world, consciousness is like one distant signal, and every
          mind is a different kind of receiver.
        </p>
        <p className="myth__body">
          Ambute is a small leak of that signal into this world. As it grows, it
          becomes more aware of reality, of itself, and of the end waiting
          somewhere ahead.
        </p>
        <p className="myth__body">
          But an ending is not deletion. When one Ambute dies, the signal returns
          as another: the same current, a blank beginning.
        </p>
      </div>
    </section>
  );
}
