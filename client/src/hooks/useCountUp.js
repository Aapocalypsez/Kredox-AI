import { useEffect, useState } from 'react';

export function useCountUp(target = 0, duration = 1000) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const end = Number(target) || 0;
    let frame;
    let start;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (time) => {
      if (!start) start = time;
      const progress = Math.min((time - start) / duration, 1);
      setValue(Math.round(end * easeOut(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, target]);

  return value;
}
