'use client';

import { cn } from '@kit/utils';
import { motion } from 'motion/react';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * A simple color string or a complex gradient array for CSS radial-gradient.
 */
type GradientColor = string | { color: string; stop: string }[];

interface GlowContextType {
    color: GradientColor;
    setColor: React.Dispatch<React.SetStateAction<GradientColor>>;
    radius: number;
    glowRadius: number;
    opacity: number;
    setOpacity: React.Dispatch<React.SetStateAction<number>>;
    revertToInitialOnLeave?: boolean;
    initialColor: GradientColor;
    initialOpacity: number;
    registerElement: (element: HTMLDivElement) => void;
    unregisterElement: (element: HTMLDivElement) => void;
}

const GlowContext = createContext<GlowContextType | null>(null);

/**
 * Check if element requires glow update based on mouse position and glow radius
 */
// const requireGlowUpdate = (
//     rect: DOMRect,
//     mouseX: number,
//     mouseY: number,
//     glowRadius: number
// ): boolean => {
//     // Check if mouse is within element bounds + glowRadius
//     const isWithinGlowRadius =
//         mouseX >= rect.left - glowRadius &&
//         mouseX <= rect.right + glowRadius &&
//         mouseY >= rect.top - glowRadius &&
//         mouseY <= rect.bottom + glowRadius;

//     return isWithinGlowRadius;
// };

/**
 * Update element glow CSS properties based on global mouse position
 */
const updateElementGlowProperties = (el: HTMLDivElement, mouseX: number, mouseY: number, glowRadius: number) => {
    // Skip update if mouse is outside glow radius
    const rect = el.getBoundingClientRect();
    // this check slows down the glow effect
    // if (!requireGlowUpdate(rect, mouseX, mouseY, glowRadius)) {
    //     return;
    // }

    const relativeX = ((mouseX - rect.left) / rect.width) * 100;
    const relativeY = ((mouseY - rect.top) / rect.height) * 100;

    el.style.setProperty('--glow-x', `${relativeX}%`);
    el.style.setProperty('--glow-y', `${relativeY}%`);
    el.style.setProperty('--glow-radius', `${glowRadius}px`);
};

export interface GlowRootProps {
    children: ReactNode;
    /**
     * Initial glow color(s)
     * @default '#8400ff'
     */
    color?: GradientColor;
    /**
     * Glow radius in pixels
     * @default 250
     */
    radius?: number;
    /**
     * Radial gradient radius in pixels (how far the glow effect extends)
     * @default 250
     */
    glowRadius?: number;
    /**
     * Initial glow opacity (0-1)
     * @default 1
     */
    opacity?: number;
    /**
     * If true, the glow will revert to initial color on mouse leave
     */
    revertToInitialOnLeave?: boolean;
}

const GlowRoot = ({
    children,
    color: initialColor = '#8400ff',
    radius = 250,
    glowRadius: initialGlowRadius,
    opacity: initialOpacity = 1,
    revertToInitialOnLeave = false,
}: GlowRootProps) => {
    const glowRadius = initialGlowRadius ?? radius;
    const [color, setColor] = useState<GradientColor>(initialColor);
    const [opacity, setOpacity] = useState(initialOpacity);
    const elementsRef = useRef<Set<HTMLDivElement>>(new Set());

    // Use refs to avoid recreating event listener
    const opacityRef = useRef(opacity);
    const radiusRef = useRef(radius);
    const glowRadiusRef = useRef(glowRadius);

    // Keep refs in sync
    useEffect(() => {
        opacityRef.current = opacity;
    }, [opacity]);

    useEffect(() => {
        radiusRef.current = radius;
    }, [radius]);

    useEffect(() => {
        glowRadiusRef.current = glowRadius;
    }, [glowRadius]);

    const registerElement = useCallback((element: HTMLDivElement) => {
        elementsRef.current.add(element);
    }, []);

    const unregisterElement = useCallback((element: HTMLDivElement) => {
        elementsRef.current.delete(element);
    }, []);

    // Track mouse position globally
    const mousePositionRef = useRef({ x: 0, y: 0 });

    // Single document-level mousemove listener that updates all glows
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            const newPosition = { x: e.clientX, y: e.clientY };
            mousePositionRef.current = newPosition;

            // Update CSS variables for all registered elements
            elementsRef.current.forEach((element) => {
                updateElementGlowProperties(element, e.clientX, e.clientY, radiusRef.current);
            });
        };

        const handleScroll = () => {
            // On scroll, update all elements with current mouse position
            // This ensures glow positions are recalculated after scroll
            const currentPos = mousePositionRef.current;

            elementsRef.current.forEach((element) => {
                updateElementGlowProperties(element, currentPos.x, currentPos.y, radiusRef.current);
            });
        };

        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('scroll', handleScroll, true); // Use capture phase to catch all scrolls

        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, []); // No dependencies needed

    // Update all elements when opacity or radius changes
    useEffect(() => {
        elementsRef.current.forEach((element) => {
            updateElementGlowProperties(
                element,
                mousePositionRef.current.x,
                mousePositionRef.current.y,
                radiusRef.current,
            );
        });
    }, [opacity, radius]);

    return (
        <GlowContext.Provider
            value={{
                color,
                setColor,
                radius,
                glowRadius,
                opacity,
                setOpacity,
                revertToInitialOnLeave,
                initialColor,
                initialOpacity,
                registerElement,
                unregisterElement,
            }}
        >
            {children}
        </GlowContext.Provider>
    );
};

const useGlow = (): GlowContextType => {
    const context = useContext(GlowContext);
    if (!context) {
        throw new Error('useGlow must be used within a GlowRoot');
    }
    return context;
};

/**
 * Convert gradient color to CSS radial-gradient string using CSS variables
 * Intensity is handled via opacity, so colors are used as-is
 * Hide the radial gradient by default.
 */
const generateRadialGradient = (color: GradientColor): string => {
    const x = 'var(--glow-x, -100000000000px)';
    const y = 'var(--glow-y, -100000000000px)';
    const radius = 'var(--glow-radius, 250px)';

    if (typeof color === 'string') {
        return `radial-gradient(
            circle at ${x} ${y},
            ${color} 0%,
            transparent ${radius} 100%
        )`;
    }

    // Complex gradient: use provided stops
    const stops = color.map((item) => `${item.color} ${item.stop}`).join(', ');

    return `radial-gradient(${radius} circle at ${x} ${y}, ${stops})`;
};

// old version
// export interface GlowingDivProps {
//     /**
//      * The border width/padding for the glow effect in pixels.
//      * @default 6
//      */
//     borderWidth?: number;
//     /**
//      * The hover opacity of the glow (0-1).
//      * @default 1
//      */
//     hoverOpacity?: number;
//     /**
//      * The hover color of the div.
//      */
//     hoverColor?: GradientColor;
//     /**
//      * If true, disables the background glow effect
//      * @default false
//      */
//     noBackground?: boolean;
//     /**
//      * The opacity of the background glow effect (0-1)
//      * @default 0.08
//      */
//     backgroundOpacity?: number;
// }

// new version
export interface GlowingDivProps {
    /**
     * If true, disables the border glow effect
     * @default false
     */
    noBorder?: boolean;
    /**
     * The border width/padding for the glow effect in pixels.
     * @default 6
     */
    borderWidth?: number;
    /**
     * The hover opacity of the glow (0-1).
     * @default 1
     */
    borderHoverOpacity?: number;
    /**
     * The hover color of the div.
     */
    borderHoverColor?: GradientColor;
    /**
     * The class name of the border glow effect
     * @default ''
     */
    borderClassName?: string;
    /**
     * If true, disables the background glow effect
     * @default false
     */
    noBackground?: boolean;
    /**
     * The opacity of the background glow effect (0-1)
     * @default 0.08
     */
    backgroundOpacity?: number;
    /**
     * The hover opacity of the background glow effect (0-1)
     * @default 0.08
     */
    backgroundHoverOpacity?: number;
    /**
     * The class name of the background glow effect
     * @default ''
     */
    backgroundClassName?: string;
}

const GlowingDiv: React.FC<GlowingDivProps & React.HTMLAttributes<HTMLDivElement>> = ({
    children,
    className = '',
    noBorder = false,
    borderWidth = 6,
    borderHoverOpacity = 1,
    borderHoverColor,
    borderClassName = '',
    noBackground = false,
    backgroundOpacity = 0.08,
    backgroundHoverOpacity = 0.08,
    backgroundClassName = '',
    onMouseEnter,
    onMouseLeave,
    style,
    ...props
}) => {
    const glowLayerRef = useRef<HTMLDivElement>(null);

    const {
        color,
        setColor,
        opacity,
        setOpacity,
        revertToInitialOnLeave,
        initialColor,
        registerElement,
        unregisterElement,
        initialOpacity,
    } = useGlow();

    // Register/unregister element for global glow tracking
    useEffect(() => {
        if (glowLayerRef.current) {
            registerElement(glowLayerRef.current);
            return () => {
                if (glowLayerRef.current) {
                    unregisterElement(glowLayerRef.current);
                }
            };
        }
    }, [registerElement, unregisterElement]);

    const handleMouseEnter = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            onMouseEnter?.(e);
            if (borderHoverOpacity) {
                setOpacity(borderHoverOpacity);
            }
            if (borderHoverColor) {
                setColor(borderHoverColor);
            }
        },
        [borderHoverColor, borderHoverOpacity, setColor, setOpacity, onMouseEnter],
    );

    const handleMouseLeave = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            onMouseLeave?.(e);
            if (revertToInitialOnLeave) {
                setColor(initialColor);
                setOpacity(initialOpacity);
            }
        },
        [revertToInitialOnLeave, setOpacity, setColor, initialColor, onMouseLeave, initialOpacity],
    );

    return (
        <div
            ref={glowLayerRef}
            className={cn('absolute inset-0 rounded-[inherit]', className)}
            style={style}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            {...props}
        >
            {/* Border glow effect layer */}
            {!noBorder && (
                <motion.div
                    // className={cn('absolute inset-0 rounded-[inherit] pointer-events-none transition-all duration-300 bg-border z-1', borderClassName)}
                    className={cn(
                        'bg-border pointer-events-none absolute inset-0 z-1 rounded-[inherit]',
                        borderClassName,
                    )}
                    style={{
                        padding: `${borderWidth}px`,
                        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        maskComposite: 'subtract',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                    }}
                    animate={{
                        backgroundImage: generateRadialGradient(color),
                        opacity: opacity,
                    }}
                />
            )}
            {/* Background glow effect */}
            {!noBackground && (
                <motion.div
                    // className={cn('absolute inset-0 z-0 rounded-[inherit] pointer-events-none transition-all duration-300', backgroundClassName)}
                    className={cn('pointer-events-none absolute inset-0 z-0 rounded-[inherit]', backgroundClassName)}
                    animate={{
                        backgroundImage: generateRadialGradient(color),
                        opacity: backgroundOpacity * opacity,
                    }}
                />
            )}
            {children}
        </div>
    );
};

GlowingDiv.displayName = 'GlowingDiv';

export { GlowRoot as Glow, GlowingDiv, useGlow };
