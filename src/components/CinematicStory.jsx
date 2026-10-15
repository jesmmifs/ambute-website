import { useEffect, useRef, useState } from "react";
import { createAmbuteExperience } from "../scene/ambuteExperience";

const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (start, end, value) => {
  const progress = clamp((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
};

const islandPoster = `url("${import.meta.env.BASE_URL}assets/scene/ambute-island-poster.webp")`;

export default function CinematicStory() {
  const storyRef = useRef(null);
  const canvasRef = useRef(null);
  const scrollCueTextRef = useRef(null);
  const experienceRef = useRef(null);
  const idleHandleRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const story = storyRef.current;
    const canvasMount = canvasRef.current;
    if (!story || !canvasMount) return undefined;

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    let reducedMotion = reducedMotionQuery.matches;
    let scrollFrame = 0;
    let disposed = false;

    const experience = createAmbuteExperience(canvasMount, {
      reducedMotion,
      onReady: () => {
        if (!disposed) setStatus("ready");
      },
      onWorldReady: ({ clips = [] } = {}) => {
        if (!disposed) {
          story.dataset.worldReady = "true";
          story.dataset.animationClips = clips.join(",");
        }
      },
      onError: () => {
        if (!disposed) setStatus("fallback");
      }
    });
    experienceRef.current = experience;

    const loadWorld = () => {
      idleHandleRef.current = null;
      experience.loadWorld();
    };

    if ("requestIdleCallback" in window) {
      idleHandleRef.current = window.requestIdleCallback(loadWorld, {
        timeout: 1600
      });
    } else {
      idleHandleRef.current = window.setTimeout(loadWorld, 650);
    }

    const updateStory = () => {
      scrollFrame = 0;
      const bounds = story.getBoundingClientRect();
      const range = Math.max(1, story.offsetHeight - window.innerHeight);
      const progress = clamp(-bounds.top / range);
      const visualProgress = reducedMotion
        ? progress < 0.48
          ? 0
          : 1
        : progress;

      const heroExit = reducedMotion
        ? visualProgress
        : smoothstep(0.08, 0.38, progress);
      const worldEntrance = reducedMotion
        ? visualProgress
        : smoothstep(0.36, 0.66, progress);

      story.style.setProperty("--hero-presence", `${1 - heroExit}`);
      story.style.setProperty("--hero-copy-y", `${heroExit * -3.4}rem`);
      story.style.setProperty("--world-presence", `${worldEntrance}`);
      story.style.setProperty(
        "--world-copy-y",
        `${(1 - worldEntrance) * 2.8}rem`
      );
      story.style.setProperty(
        "--scroll-cue-presence",
        `${1 - smoothstep(0.86, 0.97, progress)}`
      );
      story.style.setProperty("--story-progress", `${progress}`);
      story.dataset.phase =
        progress < 0.18
          ? "prenatal"
          : progress < 0.66
            ? "transition"
            : "world";
      if (scrollCueTextRef.current) {
        scrollCueTextRef.current.textContent =
          progress < 0.22 ? "Scroll to meet him" : "Keep scrolling";
      }
      experience.setProgress(visualProgress);

      if (progress > 0.03) experience.loadWorld();
    };

    const scheduleStoryUpdate = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(updateStory);
    };

    const resizeObserver = new ResizeObserver(() => {
      experience.resize();
      scheduleStoryUpdate();
    });
    resizeObserver.observe(story);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => experience.setActive(entry.isIntersecting),
      { rootMargin: "35% 0px" }
    );
    visibilityObserver.observe(story);

    const handleMotionPreference = (event) => {
      reducedMotion = event.matches;
      experience.setReducedMotion(reducedMotion);
      scheduleStoryUpdate();
    };

    reducedMotionQuery.addEventListener("change", handleMotionPreference);
    window.addEventListener("scroll", scheduleStoryUpdate, { passive: true });
    window.addEventListener("resize", scheduleStoryUpdate);
    updateStory();

    return () => {
      disposed = true;
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      if (idleHandleRef.current !== null) {
        if ("cancelIdleCallback" in window) {
          window.cancelIdleCallback(idleHandleRef.current);
        } else {
          window.clearTimeout(idleHandleRef.current);
        }
      }
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      reducedMotionQuery.removeEventListener("change", handleMotionPreference);
      window.removeEventListener("scroll", scheduleStoryUpdate);
      window.removeEventListener("resize", scheduleStoryUpdate);
      experience.dispose();
      experienceRef.current = null;
    };
  }, []);

  return (
    <div
      ref={storyRef}
      className={`story story--${status}`}
      data-phase="prenatal"
      style={{ "--island-poster": islandPoster }}
    >
      <div className="story__sticky">
        <div
          ref={canvasRef}
          className="story__canvas"
          aria-hidden="true"
        >
          <div className="story__fallback-blob" />
        </div>

        <section className="hero-copy" aria-labelledby="ambute-title">
          <h1 id="ambute-title">Ambute</h1>
        </section>

        <section className="world-copy" aria-labelledby="world-title">
          <p className="world-copy__eyebrow">A living world on your desktop</p>
          <h2 id="world-title">A small life beside yours.</h2>
          <p>
            Ambute is a gentle creature who lives beside you on your desktop
            while you work. His world follows your seasons, time, and
            weather—when it rains outside, it rains for Ambute too.
          </p>
          <p>
            Unwind with natural soundscapes, unlock new characters through the
            way you care for him, and uncover the ancient mystery at the heart
            of his world.
          </p>
        </section>

        <div className="scroll-cue" aria-hidden="true">
          <span ref={scrollCueTextRef}>Scroll to meet him</span>
          <b />
          <i />
        </div>

        <p className="story__fallback-note" role="status">
          The living scene could not be rendered, but Ambute is still here.
        </p>
      </div>
    </div>
  );
}
