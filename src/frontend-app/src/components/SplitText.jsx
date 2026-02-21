import { useSprings, animated } from '@react-spring/web';
import { useEffect, useRef, useState } from 'react';

const SplitText = ({
  text = '',
  className = '',
  delay = 100,
  animationFrom = { opacity: 0, transform: 'translate3d(0,40px,0)' },
  animationTo = { opacity: 1, transform: 'translate3d(0,0,0)' },
  threshold = 0.1,
  rootMargin = '-100px',
  onLetterAnimationComplete,
}) => {
  const letters = text.split('');
  const [inView, setInView] = useState(false);
  const ref = useRef();
  const animatedCount = useRef(0);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold, rootMargin }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold, rootMargin]);

  const springs = useSprings(
    letters.length,
    letters.map((_, i) => ({
      from: animationFrom,
      to: inView ? animationTo : animationFrom,
      delay: i * delay,
      onRest: () => {
        animatedCount.current += 1;
        if (animatedCount.current === letters.length && onLetterAnimationComplete) {
          onLetterAnimationComplete();
        }
      },
    }))
  );

  return (
    <p ref={ref} className={className}>
      {springs.map((style, i) => (
        <animated.span key={i} style={{ ...style, display: 'inline-block', willChange: 'transform, opacity' }}>
          {letters[i] === ' ' ? '\u00A0' : letters[i]}
        </animated.span>
      ))}
    </p>
  );
};

export default SplitText;
