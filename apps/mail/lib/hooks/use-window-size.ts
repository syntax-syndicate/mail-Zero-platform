import { useEffect, useState } from 'react';

interface WindowSize {
  width: number;
  height: number;
}

/**
 * A custom hook that returns the current window dimensions
 * 
 * @returns An object containing the width and height of the window
 */
export function useWindowSize(): WindowSize {
  // Initialize with default values for SSR
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    // Only run client-side
    if (typeof window === 'undefined') {
      return;
    }

    // Handler to call on window resize
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Call handler right away so state gets updated with initial window size
    handleResize();
    
    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Empty array ensures effect runs only on mount and unmount

  return windowSize;
} 