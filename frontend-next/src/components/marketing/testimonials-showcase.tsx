"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LeftOutlined, RightOutlined, StarFilled, SafetyCertificateFilled } from "@ant-design/icons";

const GREEN = "#14784a";
const ORANGE = "#e8650f";
const INK = "#15201a";
const AUTOPLAY_MS = 7000;

type Testimonial = {
  id: string;
  quote: string;
  name: string;
  photo: string;
  focus: string;
  role: "donor" | "campaigner";
  location: string;
  rating: number;
};

const TESTIMONIALS: Testimonial[] = [
  { id: "t1", quote: "I sent money through Wave in under a minute, and I could actually see photos of the borehole being built. That's the part that got me — most fundraisers, you never know what happened with your money.", name: "Amadou Tijani Jallow", photo: "/testimonials/Amadou_Tijani_jallow.jpeg", focus: "30% 20%", role: "donor", location: "Serrekunda", rating: 5 },
  { id: "t2", quote: "My brother is in the UK and wanted to support a campaign here but didn't have Wave. He used his card and it just worked. Donating felt as easy as it should be.", name: "Burry Jobe", photo: "/testimonials/Burry_Jobe.jpeg", focus: "center 22%", role: "donor", location: "Bakau", rating: 5 },
  { id: "t3", quote: "What convinced me to donate was seeing the campaigner was KYC verified. In a small country like ours, that reassurance matters more than people think.", name: "Jariatou Camara", photo: "/testimonials/Jariatou_Camara.jpeg", focus: "center 22%", role: "donor", location: "Banjul", rating: 5 },
  { id: "t4", quote: "We raised more for the school's library in three weeks on Kambeng than we did in three months asking around. Posting receipts each week kept donors coming back.", name: "Momodou Salieu Jallow", photo: "/testimonials/Momodou_Salieu_Jallow.jpeg", focus: "center 20%", role: "campaigner", location: "Brikama", rating: 5 },
  { id: "t5", quote: "I was nervous putting my ID up for verification, but it's what made donors trust the campaign. We hit our goal for the borehole faster than I expected.", name: "Omar Keita", photo: "/testimonials/Omar_Keita.jpeg", focus: "58% 22%", role: "campaigner", location: "Farafenni", rating: 4 },
  { id: "t6", quote: "Being able to show exactly what we spent — cement, labor, transport — meant nobody asked 'where did the money go?' It was all right there.", name: "Penda Sowe", photo: "/testimonials/Penda_Sowe.jpeg", focus: "center 22%", role: "campaigner", location: "Gunjur", rating: 5 },
];

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export default function TestimonialsShowcase() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const count = TESTIMONIALS.length;
  const t = TESTIMONIALS[index];

  const go = useCallback((next: number, dir?: number) => {
    setDirection(dir ?? (next > index ? 1 : -1));
    setIndex(((next % count) + count) % count);
  }, [index, count]);

  const autoplay = !paused && !reduceMotion;

  useEffect(() => {
    if (!autoplay) return;
    const id = window.setTimeout(() => go(index + 1, 1), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [autoplay, index, go]);

  return (
    <div
      className="tm-root"
      role="region"
      aria-roledescription="carousel"
      aria-label="What donors and campaigners say"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1, 1);
        if (e.key === "ArrowLeft") go(index - 1, -1);
      }}
    >
      <div className="tm-stage">
        {/* Photo */}
        <motion.div
          className="tm-photo"
          drag={reduceMotion ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60) go(index + 1, 1);
            else if (info.offset.x > 60) go(index - 1, -1);
          }}
        >
          <AnimatePresence initial={false} custom={direction}>
            <motion.img
              key={t.id}
              src={t.photo}
              alt={t.name}
              draggable={false}
              custom={direction}
              initial={reduceMotion ? { opacity: 0 } : { clipPath: direction > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)", scale: 1.08 }}
              animate={reduceMotion ? { opacity: 1 } : { clipPath: "inset(0 0 0 0%)", scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0.4, scale: 1.02 }}
              transition={{ duration: 0.9, ease: EASE_OUT }}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: t.focus, zIndex: 1 }}
            />
          </AnimatePresence>
          <div className="tm-photo-tag">
            <SafetyCertificateFilled style={{ color: GREEN, fontSize: 14 }} />
            {t.role === "donor" ? "Verified donor" : "KYC-verified campaigner"}
          </div>
        </motion.div>

        {/* Quote */}
        <div className="tm-copy">
          <svg className="tm-mark" width="56" height="44" viewBox="0 0 56 44" aria-hidden="true">
            <path d="M0 44V26C0 11 8 2 22 0l3 6c-8 3-12 8-12 16h11v22H0Zm31 0V26C31 11 39 2 53 0l3 6c-8 3-12 8-12 16h11v22H31Z" fill={ORANGE} />
          </svg>

          <div aria-live={autoplay ? "off" : "polite"} className="tm-live">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 18, filter: reduceMotion ? "none" : "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -10, filter: reduceMotion ? "none" : "blur(4px)" }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
              >
                <div style={{ display: "flex", gap: 3, marginBottom: 18 }} aria-label={`${t.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <StarFilled key={i} style={{ fontSize: 16, color: i < t.rating ? ORANGE : "rgba(21,32,26,0.15)" }} />
                  ))}
                </div>
                <blockquote className="tm-quote">{t.quote}</blockquote>
                <div style={{ marginTop: 26 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: INK, letterSpacing: "-0.02em" }}>{t.name}</div>
                  <div style={{ fontSize: 14, color: "#56625b", marginTop: 2 }}>
                    {t.role === "donor" ? "Donor" : "Campaign organizer"} · {t.location}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="tm-controls">
            <div className="tm-thumbs" role="tablist" aria-label="Choose a testimonial">
              {TESTIMONIALS.map((item, i) => {
                const active = i === index;
                return (
                  <button
                    key={item.id}
                    role="tab"
                    aria-selected={active}
                    aria-label={`${item.name}, ${item.location}`}
                    onClick={() => go(i)}
                    className="tm-thumb"
                    style={{ outline: active ? `2px solid ${GREEN}` : "none", opacity: active ? 1 : 0.62 }}
                  >
                    <img src={item.photo} alt="" style={{ objectPosition: item.focus }} />
                    {active && autoplay && (
                      <motion.span
                        key={`${item.id}-${index}`}
                        className="tm-thumb-progress"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: AUTOPLAY_MS / 1000, ease: "linear" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button className="tm-arrow" aria-label="Previous testimonial" onClick={() => go(index - 1, -1)}><LeftOutlined /></button>
              <button className="tm-arrow" aria-label="Next testimonial" onClick={() => go(index + 1, 1)}><RightOutlined /></button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .tm-root { outline: none; }
        .tm-stage {
          display: grid;
          grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
          gap: clamp(28px, 5vw, 72px);
          align-items: center;
          background: #fff;
          border: 1px solid rgba(21,32,26,0.08);
          border-radius: 28px;
          padding: clamp(14px, 1.6vw, 20px);
          padding-right: clamp(20px, 4vw, 56px);
          box-shadow: 0 1px 2px rgba(21,32,26,0.05), 0 30px 60px -30px rgba(21,32,26,0.25);
        }
        .tm-photo {
          position: relative;
          aspect-ratio: 4 / 5;
          border-radius: 20px;
          overflow: hidden;
          background: #e6f4ec;
          cursor: grab;
          touch-action: pan-y;
        }
        .tm-photo:active { cursor: grabbing; }
        .tm-photo-tag {
          position: absolute; left: 14px; bottom: 14px; z-index: 2;
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 12px; border-radius: 999px;
          background: rgba(255,255,255,0.94);
          box-shadow: 0 6px 16px -8px rgba(21,32,26,0.4);
          font-size: 12px; font-weight: 700; color: ${INK};
        }
        .tm-copy { display: flex; flex-direction: column; align-self: stretch; padding: 32px 0 12px; min-width: 0; }
        .tm-live { margin-bottom: 32px; }
        .tm-mark { margin-bottom: 22px; }
        .tm-quote {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(20px, 2.1vw, 28px);
          line-height: 1.38;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: ${INK};
          text-wrap: pretty;
          max-width: 34ch;
        }
        .tm-controls {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          margin-top: auto; padding-top: 24px;
          border-top: 1px solid rgba(21,32,26,0.08);
        }
        .tm-thumbs { display: flex; gap: 10px; overflow-x: auto; padding: 4px; scrollbar-width: none; }
        .tm-thumbs::-webkit-scrollbar { display: none; }
        .tm-thumb {
          position: relative; flex-shrink: 0;
          width: 56px; height: 56px; padding: 0; border: none; cursor: pointer;
          border-radius: 14px; overflow: hidden; background: #e6f4ec;
          outline-offset: 2px;
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .tm-thumb:hover { opacity: 1 !important; transform: translateY(-2px); }
        .tm-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .tm-thumb-progress {
          position: absolute; left: 0; right: 0; bottom: 0; height: 4px;
          background: ${ORANGE}; transform-origin: left center;
        }
        .tm-arrow {
          width: 46px; height: 46px; border-radius: 50%;
          border: 1px solid rgba(21,32,26,0.14); background: #fff; color: ${INK};
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 14px;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        .tm-arrow:hover { background: ${GREEN}; border-color: ${GREEN}; color: #fff; }
        @media (max-width: 860px) {
          .tm-stage { grid-template-columns: 1fr; padding: 12px; gap: 8px; }
          .tm-photo { aspect-ratio: 1 / 1; }
          .tm-copy { padding: 16px 10px 12px; }
          .tm-live { min-height: 340px; margin-bottom: 20px; }
          .tm-mark { width: 40px; height: 32px; margin-bottom: 16px; }
          .tm-controls { flex-direction: column; align-items: stretch; }
          .tm-controls > div:last-child { justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}
