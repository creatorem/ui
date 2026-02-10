'use client';

import { cn } from '@kit/utils';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LiquidFilter } from './filter';

interface WidthHeight {
    width?: number;
    height?: number;
}

export interface LiquidSliderProps {
    size?: 'xs' | 'sm' | 'md' | 'lg';
    min?: number;
    max?: number;
    defaultValue?: number;
    value?: number;
    onValueChange?: (value: number) => void;
    step?: number;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    /**
     * Size of the thumb (overrides size preset if provided)
     */
    thumb?: WidthHeight;
    /**
     * Size of the slider rail (overrides size preset if provided)
     */
    slider?: WidthHeight;
    glassThickness?: number;
    bezelWidth?: number;
    refractiveIndex?: number;
    /**
     * @default false
     */
    forceActive?: boolean;
}

// Size presets
const SLIDER_SIZES = {
    xs: {
        thumb: { height: 20, width: 35 },
        slider: { height: 5, width: 135 },
        glassThickness: 40,
        bezelWidth: 8,
    },
    sm: {
        thumb: { height: 30, width: 52 },
        slider: { height: 7, width: 202 },
        glassThickness: 60,
        bezelWidth: 12,
    },
    md: {
        thumb: { height: 40, width: 70 },
        slider: { height: 10, width: 270 },
        glassThickness: 80,
        bezelWidth: 16,
    },
    lg: {
        thumb: { height: 50, width: 87 },
        slider: { height: 12, width: 337 },
        glassThickness: 100,
        bezelWidth: 20,
    },
} as const;

const SCALE_REST = 0.6;
const SCALE_DRAG = 1;

export const LiquidSlider: React.FC<LiquidSliderProps> = ({
    size = 'md',
    min = 0,
    max = 100,
    defaultValue = 50,
    value: controlledValue,
    onValueChange,
    step = 1,
    disabled = false,
    forceActive = false,
    className,
    style,
    thumb,
    slider,
    glassThickness: customGlassThickness,
    bezelWidth: customBezelWidth,
    refractiveIndex = 1.5, // water is 1.33
}) => {
    // Get size configuration
    const sizeConfig = SLIDER_SIZES[size];

    // Determine final dimensions and properties - custom values override size presets
    const thumbHeight = thumb?.height ?? sizeConfig.thumb.height;
    const thumbWidth = thumb?.width ?? sizeConfig.thumb.width;
    const sliderHeight = slider?.height ?? sizeConfig.slider.height;
    const sliderWidth = slider?.width ?? sizeConfig.slider.width;
    const glassThickness = customGlassThickness ?? sizeConfig.glassThickness;
    const bezelWidth = customBezelWidth ?? sizeConfig.bezelWidth;
    const rawId = useId();
    const filterId = `slider-thumb_${rawId}`;
    const value = useMotionValue(controlledValue ?? defaultValue);

    // Update internal value when controlled value changes
    useEffect(() => {
        if (controlledValue !== undefined) {
            value.set(controlledValue);
        }
    }, [controlledValue, value]);

    const thumbWidthRest = thumbWidth * SCALE_REST;

    const [left, setLeft] = useState(0);
    const computeLeft = useCallback(() => {
        console.warn('COMPUTE LEFT');
        const clampedValue = Math.min(Math.max(value.get(), min), max);
        const ratio = (clampedValue - min) / (max - min); // Convert value to 0-1 ratio
        const trackWidth = sliderWidth - thumbWidth + thumbWidthRest / 3; // Usable track width
        setLeft(ratio * trackWidth - thumbWidthRest / 3);
    }, [value, thumbWidth, min, max, sliderWidth, forceActive]);

    // to avoid double render for controlled input during dragging
    const isDragging = useRef(false);
    const [controlledPosSet, isControlledPosSet] = useState(false);
    useEffect(() => {
        if (!isDragging.current) {
            computeLeft();
            isControlledPosSet(true);
        }
    }, [computeLeft, controlledValue]);

    // Use numeric MotionValue (0/1) instead of boolean for compatibility with transforms
    const pointerDown = useMotionValue(0);

    const isUp = useTransform((): number => (forceActive || pointerDown.get() > 0.5 ? 1 : 0));

    const thumbRadius = thumbHeight / 2;
    // MotionValue-based controls
    const blur = useMotionValue(0); // 0..40
    const specularOpacity = useMotionValue(0.4); // 0..1
    const specularSaturation = useMotionValue(7); // 0..50
    const refractionBase = useMotionValue(1); // 0..1
    const pressMultiplier = useTransform(isUp, [0, 1], [0.4, 0.9]);
    const scaleRatio = useSpring(
        useTransform([pressMultiplier, refractionBase], ([m, base]) => (Number(m) || 0) * (Number(base) || 0)),
    );

    const trackRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);

    const scaleSpring = useSpring(useTransform(isUp, [0, 1], [SCALE_REST, SCALE_DRAG]), {
        damping: 80,
        stiffness: 2000,
    });

    const backgroundOpacity = useSpring(useTransform(isUp, [0, 1], [1, 0.1]), {
        damping: 80,
        stiffness: 2000,
    });

    // Calculate thumb X position based on value (0-100% -> pixel position)
    // const thumbX = useTransform(value, (v) => {
    //     const ratio = (v - min) / (max - min); // Convert value to 0-1 ratio
    //     const trackWidth = sliderWidth - thumbWidth + thumbWidthRest / 3; // Usable track width
    //     return ratio * trackWidth - thumbWidthRest / 3; // Calculate X position
    // });

    const handlePointerDown = useCallback(() => {
        if (disabled) return;
        pointerDown.set(1);
        isDragging.current = true;
    }, [disabled, pointerDown]);

    const handlePointerUp = useCallback(() => {
        if (disabled) return;
        pointerDown.set(0);
        setTimeout(() => {
            isDragging.current = false;
        }, 100);
    }, [disabled, pointerDown]);

    const handleDragStart = useCallback(() => {
        if (disabled) return;
        pointerDown.set(1);
        isDragging.current = true;
    }, [disabled, pointerDown]);

    const handleDrag = useCallback(() => {
        const track = trackRef.current!.getBoundingClientRect();
        const thumb = thumbRef.current!.getBoundingClientRect();

        const x0 = track.left + thumbWidthRest / 2;
        const x100 = track.right - thumbWidthRest / 2;

        const trackInsideWidth = x100 - x0;

        const thumbCenterX = thumb.left + thumb.width / 2;

        const x = Math.max(x0, Math.min(x100, thumbCenterX));
        const ratio = (x - x0) / trackInsideWidth;

        const newValue = Math.max(min, Math.min(max, ratio * (max - min) + min));
        const steppedValue = Math.round(newValue / step) * step;
        value.set(steppedValue);
        onValueChange?.(steppedValue);
    }, [min, max, step, thumbWidthRest, value, onValueChange]);

    const handleDragEnd = useCallback(() => {
        if (!disabled) return;
        pointerDown.set(0);
        setTimeout(() => {
            isDragging.current = false;
        }, 100);
    }, [disabled, pointerDown]);

    const handleGlobalPointerUp = useCallback(() => {
        pointerDown.set(0);
        setTimeout(() => {
            isDragging.current = false;
        }, 100);
    }, [pointerDown]);

    // End drag when releasing outside the element
    useEffect(() => {
        window.addEventListener('pointerup', handleGlobalPointerUp);
        window.addEventListener('mouseup', handleGlobalPointerUp);
        window.addEventListener('touchend', handleGlobalPointerUp);
        return () => {
            window.removeEventListener('pointerup', handleGlobalPointerUp);
            window.removeEventListener('mouseup', handleGlobalPointerUp);
            window.removeEventListener('touchend', handleGlobalPointerUp);
        };
    }, [handleGlobalPointerUp]);

    const transformedWidth = useTransform(value, (v) => `${v}%`);
    const transformedThumbOpacity = useTransform(backgroundOpacity, (op) => `rgba(255, 255, 255, ${op})`);

    return (
        <div
            className={cn('relative', className)}
            style={{
                width: sliderWidth,
                height: thumbHeight,
                ...style,
            }}
        >
            {(typeof controlledValue === 'number' || typeof defaultValue === 'number') && !controlledPosSet ? null : (
                <>
                    <motion.div
                        ref={trackRef}
                        style={{
                            display: 'inline-block',
                            width: sliderWidth,
                            height: sliderHeight,
                            left: 0,
                            top: (thumbHeight - sliderHeight) / 2,
                            backgroundColor: '#89898F66',
                            borderRadius: sliderHeight / 2,
                            position: 'absolute',
                            cursor: 'pointer',
                        }}
                        onMouseDown={handlePointerDown}
                        onMouseUp={handlePointerUp}
                    >
                        <div className="h-full w-full overflow-hidden rounded-full">
                            <motion.div
                                style={{
                                    top: 0,
                                    left: 0,
                                    height: sliderHeight,
                                    width: transformedWidth,
                                    borderRadius: 6,
                                    backgroundColor: '#0377F7',
                                }}
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        ref={thumbRef}
                        drag={disabled ? false : 'x'}
                        dragConstraints={{
                            left: -thumbWidthRest / 3 - left,
                            right: sliderWidth - thumbWidth + thumbWidthRest / 3 - left,
                        }}
                        dragElastic={0.02}
                        onMouseDown={handlePointerDown}
                        onMouseUp={handlePointerUp}
                        onDragStart={handleDragStart}
                        onDrag={handleDrag}
                        onDragEnd={handleDragEnd}
                        dragMomentum={false}
                        className="absolute"
                        style={{
                            height: thumbHeight,
                            width: thumbWidth,
                            top: 0,
                            left,
                            // x: thumbX,
                            borderRadius: thumbRadius,
                            backdropFilter: `url(#${filterId})`,
                            scale: scaleSpring,
                            cursor: 'pointer',

                            backgroundColor: transformedThumbOpacity,
                            boxShadow: '0 3px 14px rgba(0,0,0,0.1)',
                        }}
                    />
                </>
            )}

            <LiquidFilter
                id={filterId}
                width={thumbWidth}
                height={thumbHeight}
                radius={thumbRadius}
                blur={blur.get()}
                glassThickness={glassThickness}
                bezelWidth={bezelWidth}
                refractiveIndex={refractiveIndex}
                scaleRatio={scaleRatio}
                specularOpacity={specularOpacity.get()}
                specularSaturation={specularSaturation.get()}
            />
        </div>
    );
};
