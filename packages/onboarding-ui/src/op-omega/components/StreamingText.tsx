/** Simulated character-by-character text reveal. The imprint comes back as
 *  a whole string from /finalize; we stream it for theater effect. */

import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  charsPerSec?: number;
  onComplete?: () => void;
  style?: React.CSSProperties;
}

export function StreamingText({ text, charsPerSec = 60, onComplete, style }: Props) {
  const [shown, setShown] = useState(0);
  // Keep onComplete in a ref so prop-reference changes don't trip the
  // animation effect — otherwise inline arrows from parent renders
  // restart the stream mid-flight (the bug the operator saw).
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setShown(0);
    if (!text) return;
    let completed = false;
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = (now - startedAt) / 1000;
      const next = Math.min(text.length, Math.floor(elapsed * charsPerSec));
      setShown(next);
      if (next < text.length) {
        raf = requestAnimationFrame(tick);
      } else if (!completed) {
        completed = true;
        onCompleteRef.current?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Deliberately omit onComplete from deps — it's read via ref so stale
    // closures aren't a problem and parent re-renders don't restart the
    // stream. text + charsPerSec are the only inputs that should reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, charsPerSec]);

  return (
    <span style={{ whiteSpace: "pre-wrap", ...style }}>
      {text.slice(0, shown)}
      {shown < text.length && <span style={{ opacity: 0.4 }}>▌</span>}
    </span>
  );
}
