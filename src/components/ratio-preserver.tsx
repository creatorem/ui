'use client';

import { Slot } from '@kit/ui/slot';
import { cn } from '@kit/utils';
import * as React from 'react';

/* -------------------------------------------------------------------------------------------------
 * RatioPreserver Context
 * -----------------------------------------------------------------------------------------------*/

interface RatioPreserverContextValue {
    scale: number;
    contentWidth: number;
    contentHeight: number;
}

const RatioPreserverContext = React.createContext<RatioPreserverContextValue | undefined>(undefined);

const useRatioPreserverContext = () => {
    const context = React.useContext(RatioPreserverContext);
    if (!context) {
        throw new Error('useRatioPreserverContext must be used within RatioPreserver');
    }
    return context;
};

/* -------------------------------------------------------------------------------------------------
 * RatioPreserver Root
 * -----------------------------------------------------------------------------------------------*/

export interface RatioPreserverProps {
    width: number;
    height: number;
    children: React.ReactNode;
    className?: string;
    asChild?: boolean;
}

export function RatioPreserver({ width, height, children, className, asChild = false }: RatioPreserverProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(1);
    const Comp = asChild ? Slot : 'div';

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateScale = () => {
            const containerHeight = container.clientHeight;
            const containerWidth = container.clientWidth;

            // Guard against zero-sized container
            if (containerWidth === 0 || width === 0 || height === 0) {
                setScale(1);
                return;
            }

            // Calculate scale based on available width only
            // Container height will be set to match scaled content height
            const widthScale = containerWidth / width;
            const heightScale = containerHeight / height;

            setScale(Math.min(widthScale, heightScale));
        };

        // Use requestAnimationFrame to ensure layout is complete
        const rafId = requestAnimationFrame(() => {
            updateScale();
        });

        // Add window resize listener as backup
        const handleWindowResize = () => {
            requestAnimationFrame(updateScale);
        };
        window.addEventListener('resize', handleWindowResize);

        updateScale();

        // Observe container size changes
        // const resizeObserver = new ResizeObserver(() => {
        //     requestAnimationFrame(updateScale);
        // });
        // resizeObserver.observe(container);

        return () => {
            // resizeObserver.disconnect();
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', handleWindowResize);
        };
    }, [width, height]);

    const value = React.useMemo(
        () => ({
            scale,
            contentWidth: width,
            contentHeight: height,
        }),
        [scale, width, height],
    );

    return (
        <RatioPreserverContext.Provider value={value}>
            <Comp
                ref={containerRef}
                className={cn('relative', className)}
                data-slot="ratio-preserver-container"
                style={{
                    paddingTop: `${(height / width) * 100}%`,
                }}
            >
                {children}
            </Comp>
        </RatioPreserverContext.Provider>
    );
}

/* -------------------------------------------------------------------------------------------------
 * RatioPreserverContent
 * -----------------------------------------------------------------------------------------------*/

export interface RatioPreserverContentProps {
    children: React.ReactNode;
    className?: string;
}

export const RatioPreserverContent = React.forwardRef<HTMLDivElement, RatioPreserverContentProps>(
    ({ children, className }, ref) => {
        const { scale, contentWidth, contentHeight } = useRatioPreserverContext();

        return (
            <div
                ref={ref}
                className={cn('absolute', className)}
                data-slot="ratio-preserver-content"
                style={{
                    width: contentWidth,
                    height: contentHeight,
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) scale(${scale})`,
                    transformOrigin: 'center center',
                }}
            >
                {children}
            </div>
        );
    },
);

RatioPreserverContent.displayName = 'RatioPreserverContent';
