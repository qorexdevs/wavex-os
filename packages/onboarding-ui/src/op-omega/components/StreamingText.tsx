/** Simulated character-by-character text reveal. The imprint comes back as
 *  a whole string from /finalize; we stream it for theater effect. */

import { useEffect, useState } from "react";

interface Props {
  text: string;
  charsPerSec?: number;
  onComplete?: () => void;
  style?: React.CSSProperties;
}

export function StreamingText({ text, charsPerSec = 60, onComplete, style }: Props) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    if (!text) return;
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = (now - startedAt) / 1000;
      const next = Math.min(text.length, Math.floor(elapsed * charsPerSec));
      setShown(next);
      if (next < text.length) raf = requestAnimationFrame(tick);
      else onComplete?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, charsPerSec, onComplete]);

  return (
    <span style={{ whiteSpace: "pre-wrap", ...style }}>
      {text.slice(0, shown)}
      {shown < text.length && <span style={{ opacity: 0.4 }}>▌</span>}
    </span>
  );
}
