import { useEffect, useState } from 'react';

export function useCountUp(targetNumber = 0, duration = 1200) {
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    const target = Number(targetNumber) || 0;
    let frame;
    let start;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setCurrentValue(Math.round(target * easeOut(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, targetNumber]);

  return currentValue;
}
