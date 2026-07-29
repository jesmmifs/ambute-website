import { useCallback, useEffect, useRef, useState } from "react";
import EvolutionStage from "./components/EvolutionStage";
import ScrollCue from "./components/ScrollCue";
import WhatIsAmbuteSection from "./components/WhatIsAmbuteSection";

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [whiteOutOpacity, setWhiteOutOpacity] = useState(0);
  const [stagePositionX, setStagePositionX] = useState(-0.65);
  const [mindSlideX, setMindSlideX] = useState(0);

  const experienceRef = useRef(null);
  const openingRef = useRef(null);
  const handleReady = useCallback(() => setIsReady(true), []);

  useEffect(() => {
    const experience = experienceRef.current;
    const opening = openingRef.current;
    if (!experience || !opening) return undefined;

    const updateStage = () => {
      const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalHeight > 0 ? clamp(window.scrollY / totalHeight) : 0;
      setScrollProgress(progress);

      const pageProgress = -opening.getBoundingClientRect().top / window.innerHeight;
      const heroProgress = clamp(pageProgress);
      const worldTransition = clamp(pageProgress - 1);
      const prenatalFade = clamp(worldTransition / 0.48);
      const isCompact = window.innerWidth < 760;
      const maxLift = isCompact ? -window.innerHeight * 0.1 : -44;
      const copyFade = clamp((heroProgress - 0.07) / 0.16);

      opening.style.setProperty(
        "--story-lift",
        `${heroProgress * maxLift}px`
      );
      opening.style.setProperty(
        "--hero-copy-opacity",
        isCompact ? `${1 - copyFade}` : "1"
      );
      opening.style.setProperty(
        "--prenatal-exit-opacity",
        `${1 - prenatalFade}`
      );

      // CINEMATIC TRANSITION PHASES:
      // Phase 1 (0.00 to 0.25): Hero & "What is Ambute?" section. Blob on left (-0.65), mindSlideX = 0
      // Phase 2 (0.25 to 0.45): "What is Ambute?" slides off right to 100vw, Blob moves to center (0.0)
      // Phase 3 (0.45 to 0.65): Blob centered, gentle spin & white glow & sparkles trigger
      // Phase 4 (0.65 to 0.80): Screen white-out flash (0 -> 1 -> 0), Biped character (scaled to match blob) descends with eyes closed -> open
      // Phase 5 (0.80 to 1.00): Biped landed on floor glow, pure black background

      let slideX = 0;
      if (progress < 0.25) {
        slideX = 0;
        setStagePositionX(-0.65);
        setWhiteOutOpacity(0);
      } else if (progress >= 0.25 && progress < 0.45) {
        const t = (progress - 0.25) / 0.20;
        slideX = t * 100; // slides right off-screen 0 -> 100vw
        setStagePositionX(-0.65 + t * 0.65); // blob moves -0.65 -> 0.0 (center)
        setWhiteOutOpacity(0);
      } else if (progress >= 0.45 && progress < 0.65) {
        slideX = 100;
        setStagePositionX(0); // blob stays centered
        setWhiteOutOpacity(0);
      } else if (progress >= 0.65 && progress < 0.80) {
        slideX = 100;
        setStagePositionX(0);
        const t = (progress - 0.65) / 0.15;
        // White out flash rises to 1 then drops back to 0
        const flash = t <= 0.5 ? t * 2 : (1 - t) * 2;
        setWhiteOutOpacity(clamp(flash));
      } else {
        slideX = 100;
        setStagePositionX(0);
        setWhiteOutOpacity(0);
      }
      setMindSlideX(slideX);
    };

    updateStage();
    window.addEventListener("scroll", updateStage, { passive: true });
    window.addEventListener("resize", updateStage);

    return () => {
      window.removeEventListener("scroll", updateStage);
      window.removeEventListener("resize", updateStage);
    };
  }, []);

  return (
    <main ref={experienceRef} className="experience">
      {/* FULL SCREEN WHITE TRANSITION OVERLAY */}
      <div
        className="white-transition-overlay"
        style={{ opacity: whiteOutOpacity }}
        aria-hidden="true"
      />

      <ScrollCue targetId="about-section" isReady={isReady} />

      <div
        ref={openingRef}
        className={`opening${isReady ? " opening--ready" : ""}`}
      >
        <div className="opening__stage">
          <div className="hero__light" aria-hidden="true" />

          <div
            className="hero__visual"
            role="img"
            aria-label="Ambute evolution and emergence sequence"
          >
            <EvolutionStage
              onReady={handleReady}
              scrollProgress={scrollProgress}
              stagePositionX={stagePositionX}
            />
          </div>
        </div>

        <section className="hero" aria-labelledby="ambute-title">
          <div className="hero__copy">
            <h1 id="ambute-title">Ambute</h1>
            <p>Adopt a tiny artificial life form.</p>
          </div>

          <div className="hero__veil" aria-hidden="true" />
        </section>

        <WhatIsAmbuteSection slideX={mindSlideX} />
      </div>

      {/* Extended scroll track container so user can comfortably scroll through the evolution sequence */}
      <div style={{ height: "250vh" }} aria-hidden="true" />
    </main>
  );
}
