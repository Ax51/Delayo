import React, { useLayoutEffect, useRef, useState } from 'react';

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  contentTag?: 'div' | 'ul';
  fadeSize?: 'small' | 'large';
}

function ScrollArea({
  children,
  className = '',
  contentClassName,
  contentTag: Content = 'div',
  fadeSize = 'small',
}: ScrollAreaProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    const content = contentRef.current;

    if (!viewport || !content) {
      return;
    }

    const updateOverflow = (): void => {
      setHasMoreBelow(
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop > 1
      );
    };
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(viewport);
    observer.observe(content);
    viewport.addEventListener('scroll', updateOverflow, { passive: true });
    updateOverflow();

    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', updateOverflow);
    };
  }, []);

  return (
    <div className={`relative flex min-h-0 flex-col ${className}`}>
      <div
        ref={scrollRef}
        className='min-h-0 overflow-y-auto overflow-x-hidden'
      >
        <Content
          ref={(element: HTMLDivElement | HTMLUListElement | null) => {
            contentRef.current = element;
          }}
          className={contentClassName}
        >
          {children}
        </Content>
      </div>
      {hasMoreBelow && (
        <div
          aria-hidden='true'
          className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-base-300 to-transparent ${fadeSize === 'large' ? 'h-16' : 'h-6'}`}
        />
      )}
    </div>
  );
}

export default ScrollArea;
