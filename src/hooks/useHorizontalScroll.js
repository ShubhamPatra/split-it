import { useEffect, useRef } from 'react';

/**
 * Custom hook for horizontal scroll keyboard navigation
 * Enables arrow key navigation for horizontal scroll containers
 * 
 * @param {boolean} enabled - Whether keyboard navigation is enabled
 * @returns {Object} - Ref to attach to the scrollable container
 */
export const useHorizontalScroll = (enabled = true) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!enabled || !scrollRef.current) return;

    const handleKeyDown = (e) => {
      const container = scrollRef.current;
      if (!container) return;

      // Only handle arrow keys when the container or its children are focused
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        
        // Calculate scroll amount (one card width)
        const cardWidth = container.firstElementChild?.offsetWidth || 200;
        const gap = 12; // Default gap between cards
        const scrollAmount = cardWidth + gap;

        if (e.key === 'ArrowLeft') {
          container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        } else if (e.key === 'ArrowRight') {
          container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
      }
    };

    const container = scrollRef.current;
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);

  return scrollRef;
};
