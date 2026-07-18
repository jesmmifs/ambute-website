import { useCallback, useEffect, useRef, useState } from "react";
import BrainSection from "./components/BrainSection";
import DownloadSection from "./components/DownloadSection";
import EmergenceSection from "./components/EmergenceSection";
import MythologySection from "./components/MythologySection";
import PrenatalAmbute from "./components/PrenatalAmbute";
import ThoughtStreamSection from "./components/ThoughtStreamSection";

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [isMindVisible, setIsMindVisible] = useState(false);
  const [isDownloadVisible, setIsDownloadVisible] = useState(false);
  const [isPastHero, setIsPastHero] = useState(false);
  const [isEmergenceIntroPlaying, setIsEmergenceIntroPlaying] =
    useState(false);
  const experienceRef = useRef(null);
  const openingRef = useRef(null);
  const mindRef = useRef(null);
  const handleReady = useCallback(() => setIsReady(true), []);

  useEffect(() => {
    const updateScrollCue = () => {
      setIsPastHero(window.scrollY > window.innerHeight * 0.9);
    };

    updateScrollCue();
    window.addEventListener("scroll", updateScrollCue, { passive: true });
    window.addEventListener("resize", updateScrollCue);

    return () => {
      window.removeEventListener("scroll", updateScrollCue);
      window.removeEventListener("resize", updateScrollCue);
    };
  }, []);

  useEffect(() => {
    const section = document.getElementById("download");
    if (!section) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsDownloadVisible(entry.isIntersecting),
      { threshold: 0.22 }
    );
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

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

  useEffect(() => {
    const experience = experienceRef.current;
    const opening = openingRef.current;
    if (!experience || !opening) return undefined;

    const updateStage = () => {
      const clamp = (value) => Math.min(1, Math.max(0, value));
      const smoothstep = (start, end, value) => {
        const progress = clamp((value - start) / (end - start));
        return progress * progress * (3 - 2 * progress);
      };
      const pageProgress =
        -opening.getBoundingClientRect().top / window.innerHeight;
      const heroProgress = clamp(pageProgress);
      const worldTransition = clamp(pageProgress - 1);
      const prenatalFade = clamp(worldTransition / 0.48);
      const isCompact = window.innerWidth < 760;
      const maxLift = isCompact ? -window.innerHeight * 0.1 : -44;
      const mobileMindAvoidance = smoothstep(0.28, 1.14, pageProgress);
      const mindAvoidanceLift = isCompact
        ? -window.innerHeight * 0.58 * mobileMindAvoidance
        : 0;
      const copyFade = clamp((heroProgress - 0.07) / 0.16);
      const mobilePrenatalClear = isCompact
        ? 1 - smoothstep(0.7, 1.06, pageProgress)
        : 1;
      const mix = (start, end) =>
        Math.round(start + (end - start) * worldTransition);

      opening.style.setProperty(
        "--story-lift",
        `${heroProgress * maxLift + mindAvoidanceLift}px`
      );
      opening.style.setProperty(
        "--hero-copy-opacity",
        isCompact ? `${1 - copyFade}` : "1"
      );
      opening.style.setProperty(
        "--prenatal-exit-opacity",
        `${(1 - prenatalFade) * mobilePrenatalClear}`
      );
      experience.style.setProperty(
        "--world-background",
        `rgb(${mix(5, 227)}, ${mix(5, 231)}, ${mix(4, 225)})`
      );
    };

    updateStage();
    window.addEventListener("scroll", updateStage, { passive: true });
    window.addEventListener("resize", updateStage);

    return () => {
      window.removeEventListener("scroll", updateStage);
      window.removeEventListener("resize", updateStage);
    };
  }, []);

  const isScrollHelperHidden =
    !isPastHero || isDownloadVisible || isEmergenceIntroPlaying;

  return (
    <main ref={experienceRef} className="experience">
      <div
        className={`scroll-helper${
          isScrollHelperHidden ? " scroll-helper--hidden" : ""
        }`}
        aria-hidden="true"
      >
        <span>Scroll</span>
        <span className="scroll-helper__arrow" />
      </div>

      <div
        ref={openingRef}
        className={`opening${isReady ? " opening--ready" : ""}`}
      >
        <div className="opening__stage">
          <div className="hero__light" aria-hidden="true" />

          <div
            className="hero__visual"
            role="img"
            aria-label="Ambute's prenatal form floating gently in a pool of light"
          >
            <PrenatalAmbute onReady={handleReady} />
          </div>
        </div>

        <section className="hero" aria-labelledby="ambute-title">
          <div className="hero__copy">
            <h1 id="ambute-title">Ambute</h1>
            <p>Adopt a tiny artificial life form.</p>
          </div>

          <div className="hero__veil" aria-hidden="true" />
        </section>

        <section
          ref={mindRef}
          className={`mind${isMindVisible ? " mind--visible" : ""}`}
          aria-labelledby="mind-title"
        >
          <div className="mind__copy">
            <p className="mind__prelude">Every Ambute begins like this.</p>
            <h2 id="mind-title">A mind of its own.</h2>
            <p className="mind__lead">
              Inside this shapeless form is a functioning AI brain.
            </p>
            <p className="mind__body">
              Ambute perceives its world, thinks, talks with you, and decides
              for itself what to do next. Its needs, personality, age, and
              surroundings shape the life form you get to know.
            </p>

            <div className="mind__traits" aria-label="Ambute can">
              <span>Perceive</span>
              <span>Think</span>
              <span>Speak</span>
              <span>Choose</span>
            </div>
          </div>
        </section>
      </div>

      <EmergenceSection
        onDescentActiveChange={setIsEmergenceIntroPlaying}
      />
      <BrainSection />
      <ThoughtStreamSection />
      <MythologySection />
      <DownloadSection />
    </main>
  );
}
