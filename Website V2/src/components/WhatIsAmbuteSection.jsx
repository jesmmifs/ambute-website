import { useEffect, useRef, useState } from "react";

export default function WhatIsAmbuteSection({ slideX = 0 }) {
  const mindRef = useRef(null);
  const [isMindVisible, setIsMindVisible] = useState(false);

  useEffect(() => {
    const section = mindRef.current;
    if (!section) return undefined;

    const isCompact = window.innerWidth < 760;
    const observer = new IntersectionObserver(
      ([entry]) => setIsMindVisible(entry.isIntersecting),
      { threshold: isCompact ? 0.18 : 0.3 }
    );
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={mindRef}
      id="about-section"
      className={`mind${isMindVisible ? " mind--visible" : ""}`}
      style={{
        transform: slideX ? `translateX(${slideX}vw)` : undefined,
        willChange: "transform"
      }}
      aria-labelledby="mind-title"
    >
      <div className="mind__copy">
        <p className="mind__prelude">Introduction</p>
        <h2 id="mind-title">What is Ambute?</h2>
        <p className="mind__lead">
          Ambute is a tiny, tender creature that lives on your desktop (or Raspberry Pi).
        </p>
        <p className="mind__body">
          Watch it live out its life right on your screen. But Ambute can be more
          than just a virtual pet. It is aware of its environment, of you, even
          of glimpses of the outside world. You can talk to it about anything.
          It makes decisions and acts on them... it is a tiny sentient being.
        </p>
      </div>
    </section>
  );
}
