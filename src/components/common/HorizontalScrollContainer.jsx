import React, { useState, useEffect } from 'react';
import { useHorizontalScroll } from '../../hooks/useHorizontalScroll';
import { cn } from '../../lib/utils';

/**
 * Accessible horizontal scroll container with:
 * - Keyboard navigation (arrow keys)
 * - Visual scroll indicators
 * - Pagination dots
 * - ARIA attributes for screen readers
 */
const HorizontalScrollContainer = ({
  children,
  ariaLabel = 'Scrollable content',
  className = '',
  showIndicators = true,
  showDots = true,
}) => {
  const scrollRef = useHorizontalScroll(true);
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);
  const [showRightIndicator, setShowRightIndicator] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Check scroll position and update indicators
  useEffect(() => {
    const checkScroll = () => {
      const container = scrollRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      
      // Show left indicator if scrolled right
      setShowLeftIndicator(scrollLeft > 10);
      
      // Show right indicator if can scroll more
      setShowRightIndicator(scrollLeft < scrollWidth - clientWidth - 10);

      // Calculate current page
      if (clientWidth > 0) {
        const page = Math.round(scrollLeft / clientWidth);
        setCurrentPage(page);
        setTotalPages(Math.ceil(scrollWidth / clientWidth));
      }
    };

    const container = scrollRef.current;
    if (!container) return;

    // Initial check
    checkScroll();

    // Add scroll listener
    container.addEventListener('scroll', checkScroll);
    
    // Add resize observer to handle window resizing
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [scrollRef]);

  const scrollToPage = (pageIndex) => {
    const container = scrollRef.current;
    if (!container) return;

    const { clientWidth } = container;
    container.scrollTo({
      left: pageIndex * clientWidth,
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative">
      {/* Scroll Container */}
      <div
        ref={scrollRef}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        className={cn(
          'flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 rounded',
          className
        )}
      >
        {children}
      </div>

      {/* Visual Scroll Indicators */}
      {showIndicators && (
        <>
          {showLeftIndicator && (
            <div className="absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
          )}
          {showRightIndicator && (
            <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
          )}
        </>
      )}

      {/* Pagination Dots */}
      {showDots && totalPages > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToPage(index)}
              aria-label={`Go to page ${index + 1}`}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-all',
                currentPage === index
                  ? 'bg-primary w-4'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HorizontalScrollContainer;
