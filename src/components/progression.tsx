'use client';

import { cn } from '@kit/utils';
import { Slot } from '@radix-ui/react-slot';
import React, { createContext, SVGAttributes, useContext, useEffect, useRef, useState } from 'react';

interface ProgressionContextType {
    progress: number; // 0-100
    progressRef: React.RefObject<number>;
    isReady: boolean;
    scrollToProgress: (progress: number) => void;
    updateProgress: (progress: number) => void;
    setReady: (ready: boolean) => void;
    setScrollToProgressFn: (fn: (progress: number) => void) => void;
}

const ProgressionContext = createContext<ProgressionContextType>({
    progress: 0,
    progressRef: { current: 0 },
    isReady: false,
    scrollToProgress: () => {},
    updateProgress: () => {},
    setReady: () => {},
    setScrollToProgressFn: () => {},
});

function useProgression() {
    const context = useContext(ProgressionContext);
    if (!context) {
        throw new Error('Progression must be used within a ProgressionProvider');
    }
    return context;
}

/**
 * Root component that provides the progression context
 */
function ProgressionRoot({ children }: { children: React.ReactNode }) {
    const [progress, setProgress] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [scrollToProgressFn, setScrollToProgressFn] = useState<((progress: number) => void) | null>(null);
    const progressRef = useRef<number>(0);
    // Function to scroll to a specific progress percentage
    const scrollToProgress = React.useCallback(
        (targetProgress: number) => {
            if (scrollToProgressFn) {
                scrollToProgressFn(targetProgress);
            } else {
                console.warn('scrollToProgress called but no content measured yet');
            }
        },
        [scrollToProgressFn],
    );

    const updateProgress = React.useCallback((newProgress: number) => {
        progressRef.current = newProgress;
        setProgress(newProgress);
    }, []);

    const contextValue: ProgressionContextType = {
        progress,
        progressRef: progressRef,
        isReady,
        scrollToProgress,
        updateProgress,
        setReady: setIsReady,
        setScrollToProgressFn,
    };

    return <ProgressionContext.Provider value={contextValue}>{children}</ProgressionContext.Provider>;
}

export interface ProgressionContentProps {
    children: React.ReactNode;
    /**
     * @default false
     */
    asChild?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Component that wraps the content to measure scroll progression
 */
function ProgressionContent({ children, asChild = false, className, style }: ProgressionContentProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const { updateProgress, setReady, setScrollToProgressFn, progressRef } = useProgression();
    const Comp = asChild ? Slot : 'div';

    // Measure content and update progress
    const measureProgress = React.useCallback(() => {
        if (!contentRef.current) return;

        const element = contentRef.current;
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;

        // Calculate total scrollable height
        const totalHeight = rect.height;
        const startPosition = rect.top + scrollTop;

        // Calculate current scroll position relative to content
        const currentPosition = Math.max(
            0,
            Math.min(scrollTop - startPosition + (progressRef.current / 100) * windowHeight),
        );

        // Calculate progress as percentage
        const newProgress = totalHeight > 0 ? Math.min(100, Math.max(0, (currentPosition / totalHeight) * 100)) : 0;

        updateProgress(newProgress);

        // Mark as ready once we have measurements
        if (totalHeight > 0) {
            setReady(true);
        }
    }, [updateProgress, setReady]);

    // Function to scroll to a specific progress percentage
    const scrollToProgress = React.useCallback((targetProgress: number) => {
        if (!contentRef.current) return;

        const element = contentRef.current;
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const startPosition = rect.top + scrollTop;

        // Calculate target scroll position
        const targetScrollTop = startPosition + (rect.height * targetProgress) / 100 - window.innerHeight / 2;

        window.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
        });
    }, []);

    // Set the scroll function in context
    useEffect(() => {
        setScrollToProgressFn(() => scrollToProgress);
    }, [scrollToProgress, setScrollToProgressFn]);

    // Handle scroll events
    useEffect(() => {
        let rafId: number | null = null;

        const handleScroll = () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            rafId = requestAnimationFrame(measureProgress);
        };

        const handleResize = () => {
            measureProgress();
        };

        // Initial measurement
        measureProgress();

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
        };
    }, [measureProgress]);

    return (
        <Comp ref={contentRef} className={className} style={style}>
            {children}
        </Comp>
    );
}

export interface ProgressionCircleProps {
    /**
     * Size of the circle
     * @default 40
     */
    size?: number;
    /**
     * Width of the stroke
     * @default 2
     */
    strokeWidth?: number;
    /**
     * Line cap of the stroke
     * @default 'round'
     */
    strokeLinecap?: SVGAttributes<SVGCircleElement>['strokeLinecap'];
    /**
     * Class name for the circle
     */
    className?: string;
    textClassName?: string;
}

/**
 * Component that show progression in the circle and the percentage in the middle
 */
function ProgressionCircle({
    size = 40,
    strokeWidth = 2,
    strokeLinecap = 'butt',
    className,
    textClassName,
}: ProgressionCircleProps) {
    const { progress, isReady } = useProgression();

    if (!isReady) return null;

    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`}>
            <svg width={size} height={size} className="-rotate-90 transform">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    className="text-muted-foreground/20"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap={strokeLinecap}
                    className="text-primary transition-all duration-300 ease-out"
                />
            </svg>
            {/* Percentage text in the center */}
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-foreground text-xs font-medium', textClassName)}>
                    {Math.round(progress)}%
                </span>
            </div>
        </div>
    );
}

export interface ProgressionBarProps {
    /**
     * Thickness of the bar
     * @default 2
     */
    thickness?: number;
    /**
     * Applied to the wrapper
     */
    className?: string;
    /**
     * Applied to the percentage bar
     */
    barClassName?: string;
    /**
     * Direction of the bar
     * @default 'horizontal'
     */
    direction?: 'horizontal' | 'vertical';
}

/**
 * Component that show progression in the bar
 */
function ProgressionBar({ thickness = 2, className, direction = 'horizontal', barClassName }: ProgressionBarProps) {
    const { progress, isReady } = useProgression();

    if (!isReady) return null;

    return (
        <div
            className={cn(
                direction === 'horizontal' ? 'w-full' : 'h-full',
                'bg-muted-foreground/20 overflow-hidden rounded-full',
                className,
            )}
            style={direction === 'horizontal' ? { height: thickness } : { width: thickness }}
        >
            <div
                className={cn(
                    direction === 'horizontal' ? 'h-full' : 'w-full',
                    'bg-primary rounded-full transition-all duration-300 ease-out',
                    barClassName,
                )}
                style={direction === 'horizontal' ? { width: `${progress}%` } : { height: `${progress}%` }}
            />
        </div>
    );
}

export { ProgressionRoot as Progression, ProgressionBar, ProgressionCircle, ProgressionContent, useProgression };
