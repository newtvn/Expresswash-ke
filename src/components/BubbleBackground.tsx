import { useEffect } from 'react';

const BubbleBackground = () => {
  useEffect(() => {
    const createBubble = () => {
      const bubble = document.createElement('div');
      bubble.className = 'bubble-effect';

      // Randomize size
      const size = Math.random() * 60 + 20;
      bubble.style.width = size + 'px';
      bubble.style.height = size + 'px';

      // Randomize horizontal position
      bubble.style.left = Math.random() * 100 + 'vw';

      // Randomize animation duration (speed)
      const duration = Math.random() * 4 + 4;
      bubble.style.animationDuration = duration + 's';

      // Randomize opacity
      bubble.style.opacity = String(Math.random() * 0.5);

      document.body.appendChild(bubble);

      // Remove bubble from DOM after animation finishes
      setTimeout(() => {
        bubble.remove();
      }, 8000);
    };

    // Generate bubbles every 300ms
    const interval = setInterval(createBubble, 300);

    return () => {
      clearInterval(interval);
      // Clean up any remaining bubbles
      const bubbles = document.querySelectorAll('.bubble-effect');
      bubbles.forEach(bubble => bubble.remove());
    };
  }, []);

  return null;
};

export default BubbleBackground;
