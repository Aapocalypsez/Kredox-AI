import { useEffect, useState } from 'react';

export function useCountUp(targetNumber, duration = 1200) {
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    const target = Number(targetNumber) || 0;
    let animationFrame;
    let startTime;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCurrentValue(Math.round(target * progress));
      if (progress < 1) animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [duration, targetNumber]);

  return currentValue;
}
