'use client';

import { cn } from '@kit/utils';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';

const DEFAULT_GRADIENT_ID = 'cursorGradient';

const DEFAULT_GLOW_PROPS: Required<GlowState> = {
    color: '#ff6b6b',
    radius: 250,
    local: false,
    id: DEFAULT_GRADIENT_ID,
};

/**
 * A simple color string or a complex gradient array.
 *
 * ([color, offset] | [color,offset,opacity] | color)[]
 */
type GradientColor = string | ([string, number] | [string, number, number] | string)[];

interface GlowContextType {
    color: GradientColor;
    setColor: React.Dispatch<React.SetStateAction<GradientColor>>;
    isInitialized: boolean;
    gradientIdURL: string;
    initialGlow: Required<GlowState>;
    local: boolean;
    goBackToInitialColorOnMouseLeave?: boolean;
}

const GlowContext = createContext<GlowContextType | null>(null);

export interface GlowRootProps {
    children: ReactNode;
    initialGlow?: GlowState;
    /**
     * If true, the glow won't fit the page document boundaries but the shape of the closest relative parent.
     */
    local?: boolean;
    goBackToInitialColorOnMouseLeave?: boolean;
}

const GlowRoot = ({
    children,
    initialGlow: initialGlowProp,
    goBackToInitialColorOnMouseLeave = false,
    local = false,
}: GlowRootProps) => {
    const id = useId();
    const initialGlow = { ...DEFAULT_GLOW_PROPS, ...initialGlowProp };
    const [color, setColor] = useState(initialGlow.color!);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const initialize = () => {
            setIsInitialized(true);
        };

        window.addEventListener('load', initialize);

        if (document.readyState === 'complete') {
            initialize();
        }

        return () => {
            window.removeEventListener('load', initialize);
        };
    }, []);

    const gradientId = `${initialGlow.id ?? DEFAULT_GRADIENT_ID}-${id}`;

    return (
        <GlowContext.Provider
            value={{
                color,
                setColor,
                isInitialized,
                gradientIdURL: `url(#${gradientId})`,
                initialGlow,
                local,
                goBackToInitialColorOnMouseLeave,
            }}
        >
            {isInitialized && <GlowEffect local={local} radius={initialGlow.radius} id={gradientId} color={color} />}
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

export interface GlowState {
    radius?: number;
    id?: string;
    /**
     * A simple color string or a complex gradient array.
     *
     * ([color, offset] | [color,offset,opacity] | color)[]
     */
    color?: GradientColor;
    local?: boolean;
}

const GradientStop = ({
    item,
    index,
    totalItems,
}: {
    item: string | [string, number] | [string, number, number];
    index: number;
    totalItems: number;
}) => {
    const color = typeof item === 'string' ? item : item[0];
    const definedOffset = typeof item === 'string' ? undefined : item[1];
    const definedOpacity = typeof item === 'string' ? undefined : item[2];

    const offset = definedOffset ?? (index === 0 ? 0 : index === totalItems - 1 ? 1 : index / (totalItems - 1));

    const opacity = definedOpacity ?? (index === 0 ? 1 : index === totalItems - 1 ? 0 : 1 - index / (totalItems - 1));

    return (
        <stop
            key={`${color}-${index}`}
            stopColor={color}
            offset={offset}
            stopOpacity={opacity}
            className="transition-all duration-400"
        />
    );
};

const GradientStops = React.memo(({ gradientColor }: { gradientColor: GradientColor }) => {
    if (typeof gradientColor === 'string') {
        return (
            <>
                <stop offset={0} stopColor={gradientColor} stopOpacity="1" className="transition-all duration-400" />
                <stop offset={1} className="transition-all duration-400" stopColor={gradientColor} stopOpacity="0" />
            </>
        );
    }

    return (
        <>
            {gradientColor.map((item, i) => (
                <GradientStop key={`gradient-${i}`} item={item} index={i} totalItems={gradientColor.length} />
            ))}
        </>
    );
});

GradientStops.displayName = 'GradientStops';

const GlowEffect = ({
    radius = DEFAULT_GLOW_PROPS.radius,
    id = DEFAULT_GLOW_PROPS.id,
    color: gradientColor = DEFAULT_GLOW_PROPS.color,
    local = false,
}: GlowState) => {
    const [mousePagePosition, setMousePagePosition] = useState({ x: -radius - 100, y: -radius - 100 });
    const [scrollingTranslate, setScrollingTranslate] = useState<null | {
        originY: number;
        positionY: number;
        originX: number;
        positionX: number;
    }>(null);
    const ref = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setScrollingTranslate(null);
            if (local) {
                const rect = ref.current?.getBoundingClientRect();
                if (rect) {
                    setMousePagePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }
            } else {
                setMousePagePosition({ x: e.pageX, y: e.pageY });
            }
        };

        const handleScroll = () => {
            setScrollingTranslate((scrollinTr) =>
                scrollinTr
                    ? {
                          ...scrollinTr,
                          positionY: window.scrollY,
                          positionX: window.scrollX,
                      }
                    : {
                          originY: window.scrollY,
                          positionY: window.scrollY,
                          originX: window.scrollX,
                          positionX: window.scrollX,
                      },
            );
        };

        document.addEventListener('scroll', handleScroll);
        // document.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            document.removeEventListener('scroll', handleScroll);
            // document.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [local]);

    return (
        <svg
            ref={ref}
            width="0"
            height="0"
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            id="glow-svg"
        >
            <defs>
                <radialGradient
                    id={id}
                    gradientUnits="userSpaceOnUse"
                    cx={
                        mousePagePosition.x +
                        (scrollingTranslate ? scrollingTranslate.positionX - scrollingTranslate.originX : 0)
                    }
                    cy={
                        mousePagePosition.y +
                        (scrollingTranslate ? scrollingTranslate.positionY - scrollingTranslate.originY : 0)
                    }
                    r={radius}
                >
                    <GradientStops gradientColor={gradientColor} />
                </radialGradient>
            </defs>
        </svg>
    );
};

const usePageViewBox = (
    containerRef: React.RefObject<HTMLDivElement | SVGSVGElement | null>,
): { viewBox: [number, number, number, number] } => {
    const { isInitialized, local } = useGlow();
    const [viewBox, setViewBox] = useState<[number, number, number, number]>([0, 0, 0, 0]);

    const updateViewBox = useCallback(() => {
        if (local) return;
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const viewBoxX = rect.left + window.scrollX;
        const viewBoxY = rect.top + window.scrollY;
        const width = rect.width;
        const height = rect.height;
        setViewBox([viewBoxX, viewBoxY, width, height]);
    }, [containerRef, local]);

    useEffect(() => {
        if (isInitialized) {
            updateViewBox();
        }
    }, [isInitialized, updateViewBox]);

    return { viewBox };
};

const GlowSvg: React.FC<React.SVGProps<SVGSVGElement>> = ({ children, className, ...props }) => {
    const ref = useRef<SVGSVGElement>(null);
    const { gradientIdURL, local } = useGlow();
    const { viewBox } = usePageViewBox(ref);
    const id = useId();

    return (
        <svg
            ref={ref}
            id={id}
            width="0"
            height="0"
            className={cn('pointer-events-none absolute', className)}
            aria-hidden="true"
            stroke={gradientIdURL}
            fill={gradientIdURL}
            {...props}
            viewBox={!local ? `${viewBox[0]} ${viewBox[1]} ${viewBox[2]} ${viewBox[3]}` : (props.viewBox ?? undefined)}
        >
            {children}
        </svg>
    );
};

export interface GlowingDivProps {
    /**
     * The border radius of the div.
     *
     * @default 8
     */
    borderRadius?: number;
    /**
     * The stroke width of the div.
     *
     * @default 2
     */
    strokeWidth?: number;
    /**
     * The fill opacity of the div.
     *
     * @default 0.1
     */
    fillOpacity?: number;
    /**
     * Whether to hide the background of the div.
     *
     * @default false
     */
    hideBackground?: boolean;
    /**
     * The hover color of the div.
     */
    hoverColor?: GradientColor;
}

const GlowingDiv = React.forwardRef<HTMLDivElement, GlowingDivProps & React.HTMLAttributes<HTMLDivElement>>(
    (
        {
            children,
            className = '',
            strokeWidth = 2,
            borderRadius = 8,
            fillOpacity = 0.1,
            hideBackground = false,
            hoverColor,
            onMouseEnter,
            onMouseLeave,
            style,
            ...props
        },
        ref,
    ) => {
        const svgRef = useRef<SVGSVGElement>(null);
        const internalContainerRef = useRef<HTMLDivElement>(null);
        const { gradientIdURL, setColor, initialGlow, goBackToInitialColorOnMouseLeave } = useGlow();

        const containerRef = ref || internalContainerRef;

        const handleMouseEnter = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                onMouseEnter?.(e);
                if (hoverColor) {
                    setColor(hoverColor);
                }
            },
            [hoverColor, setColor, onMouseEnter],
        );

        const handleMouseLeave = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                onMouseLeave?.(e);
                if (goBackToInitialColorOnMouseLeave) {
                    setColor(initialGlow.color);
                }
            },
            [setColor, initialGlow.color, onMouseLeave, goBackToInitialColorOnMouseLeave],
        );

        const { viewBox } = usePageViewBox(containerRef as React.RefObject<HTMLDivElement>);

        return (
            <div
                ref={containerRef}
                className={cn('relative', className)}
                style={{
                    ...style,
                    borderRadius: borderRadius,
                    borderWidth: strokeWidth,
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                {...props}
            >
                <svg
                    ref={svgRef}
                    viewBox={`${viewBox[0]} ${viewBox[1]} ${viewBox[2]} ${viewBox[3]}`}
                    className="pointer-events-none absolute"
                    style={{
                        inset: -strokeWidth,
                    }}
                >
                    {!hideBackground && (
                        <rect
                            className="glow-fill"
                            fill={gradientIdURL}
                            fillOpacity={fillOpacity}
                            rx={Math.max(0, borderRadius - strokeWidth)}
                            x={viewBox[0] + strokeWidth}
                            y={viewBox[1] + strokeWidth}
                            width={Math.max(0, viewBox[2] - strokeWidth * 2)}
                            height={Math.max(0, viewBox[3] - strokeWidth * 2)}
                        />
                    )}
                    {strokeWidth > 0 && (
                        <rect
                            className="glow-border"
                            fill="transparent"
                            stroke={gradientIdURL}
                            strokeWidth={strokeWidth}
                            rx={Math.max(0, borderRadius - strokeWidth / 2)}
                            x={viewBox[0] + strokeWidth / 2}
                            y={viewBox[1] + strokeWidth / 2}
                            width={Math.max(0, viewBox[2] - strokeWidth)}
                            height={Math.max(0, viewBox[3] - strokeWidth)}
                        />
                    )}
                </svg>

                {children}
            </div>
        );
    },
);

GlowingDiv.displayName = 'GlowingDiv';

export { GlowRoot as Glow, GlowingDiv, GlowSvg, useGlow };
