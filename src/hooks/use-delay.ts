'use client';

import { useEffect, useRef, useState } from 'react';

export function useFnDelay<T>(
    asyncFactory: (delay: (timeMs: number) => Promise<void>) => Promise<T>,
    deps: React.DependencyList,
) {
    const [value, setValue] = useState<T | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        // Abort previous async operation
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new abort controller for this operation
        abortControllerRef.current = new AbortController();
        const currentAbortController = abortControllerRef.current;

        // Create the delay function that returns a promise
        const delayFn = (timeMs: number): Promise<void> => {
            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    if (!currentAbortController.signal.aborted) {
                        resolve();
                    }
                }, timeMs);

                // Handle abortion
                currentAbortController.signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Delay aborted'));
                });
            });
        };

        // Execute the async factory function
        const executeFactory = async () => {
            try {
                const result = await asyncFactory(delayFn);

                // Only update if not aborted
                if (!currentAbortController.signal.aborted) {
                    setValue(result);
                }
            } catch (error) {
                // Ignore abortion errors, but log others
                if (error instanceof Error && error.message !== 'Delay aborted') {
                    console.error('Error in useFnDelay factory:', error);
                }
            }
        };

        executeFactory();

        // Cleanup function
        return () => {
            if (currentAbortController) {
                currentAbortController.abort();
            }
        };
    }, deps);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return value;
}

// Simpler hook built on top of useFnDelay
export function useDelay<T>(value: T, delayMs: number) {
    return useFnDelay(
        async (delay: (timeMs: number) => Promise<void>) => {
            if (delayMs > 0) {
                await delay(delayMs);
            }
            return value;
        },
        [value, delayMs],
    );
}
