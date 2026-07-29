import { useEffect, useState } from "react";

export default function ScrollCue({ targetId = "about-section", isReady }) {
  const [isDelayedVisible, setIsDelayedVisible] = useState(false);

  useEffect(() => {
    if (!isReady) return undefined;

    // Show 2 seconds AFTER blob + title/subtitle finish easing in
    // Subtitle finishes ease-in at ~8.25s -> + 2.0s delay = 10.25s (10250ms)
    const timer = setTimeout(() => {
      setIsDelayedVisible(true);
    }, 10250);

    return () => clearTimeout(timer);
  }, [isReady]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        setIsDelayedVisible(false);
      } else if (window.scrollY === 0 && isReady) {
        setIsDelayedVisible(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isReady]);

  const handleScrollClick = () => {
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({
        top: window.innerHeight * 0.9,
        behavior: "smooth"
      });
    }
  };

  return (
    <div
      className={`scroll-helper ${
        isDelayedVisible ? "" : "scroll-helper--hidden"
      }`}
      onClick={handleScrollClick}
      role="button"
      tabIndex={0}
      aria-label="Scroll to explore"
      onKeyDown={(e) => e.key === "Enter" && handleScrollClick()}
    >
      <span>Scroll</span>
      <span className="scroll-helper__arrow" />
    </div>
  );
}
