'use client';

import { cn } from '@kit/utils';
import { mix, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import type { CSSProperties, FC } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LiquidFilter } from './filter';
import { LIP } from './liquid-lib';

interface WidthHeight {
    width?: number;
    height?: number;
}

export interface LiquidSwitchProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    checked?: boolean;
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
    style?: CSSProperties;
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
    blur?: number;
    specularOpacity?: number;
    specularSaturation?: number;
    refractionBase?: number;
}

// Size presets
const SWITCH_SIZES = {
    sm: {
        thumb: { height: 30, width: 48 },
        slider: { height: 24, width: 60 },
        glassThickness: 24,
        bezelWidth: 10,
    },
    md: {
        thumb: { height: 46, width: 73 },
        slider: { height: 34, width: 80 },
        glassThickness: 24,
        bezelWidth: 10,
    },
    lg: {
        thumb: { height: 69, width: 109 },
        slider: { height: 50, width: 120 },
        glassThickness: 35,
        bezelWidth: 14,
    },
    xl: {
        thumb: { height: 92, width: 146 },
        slider: { height: 67, width: 160 },
        glassThickness: 47,
        bezelWidth: 19,
    },
    // lg: {
    //     thumb: { height: 115, width: 182 },
    //     slider: { height: 84, width: 200 },
    //     glassThickness: 59,
    //     bezelWidth: 24,
    // },
} as const;

const THUMB_REST_SCALE = 0.65;
const THUMB_ACTIVE_SCALE = 0.9;

export const LiquidSwitch: FC<LiquidSwitchProps> = ({
    checked: controlledChecked,
    defaultChecked = false,
    onCheckedChange,
    disabled = false,
    forceActive = false,
    size = 'md',
    className,
    style,
    thumb,
    slider,
    glassThickness: customGlassThickness,
    bezelWidth: customBezelWidth,
    refractiveIndex = 1.5,
    blur = 0.2,
    specularOpacity = 0.5,
    specularSaturation = 6,
    refractionBase: refractionBaseProp = 1,
}) => {
    // Get size configuration (fallback to 'md' if custom dimensions are provided without size)
    const sizeConfig = SWITCH_SIZES[size];

    // Determine final dimensions and properties - custom values override size presets
    const thumbHeight = thumb?.height ?? sizeConfig.thumb.height;
    const thumbWidth = thumb?.width ?? sizeConfig.thumb.width;
    const sliderHeight = slider?.height ?? sizeConfig.slider.height;
    const sliderWidth = slider?.width ?? sizeConfig.slider.width;
    const glassThickness = customGlassThickness ?? sizeConfig.glassThickness;
    const bezelWidth = customBezelWidth ?? sizeConfig.bezelWidth;
    const rawId = useId();
    const filterId = `switch-thumb_${rawId}`;
    const thumbRadius = thumbHeight / 2;
    const sliderRef = useRef<HTMLDivElement>(null);

    // Internal state for checked value
    const [internalChecked, setInternalChecked] = useState(controlledChecked ?? defaultChecked);
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : internalChecked;

    // Glass effect controls
    const refractionBase = useMotionValue(refractionBaseProp);
    const xDragRatio = useMotionValue(0);

    const THUMB_REST_OFFSET = ((1 - THUMB_REST_SCALE) * thumbWidth) / 2;
    const TRAVEL = sliderWidth - sliderHeight - (thumbWidth - thumbHeight) * THUMB_REST_SCALE;

    // Motion sources
    const checkedMotion = useMotionValue(checked ? 1 : 0);
    const pointerDown = useMotionValue(0);
    const initialPointerX = useMotionValue(0);
    const active = useTransform(() => (forceActive || pointerDown.get() > 0.5 ? 1 : 0));

    // Update motion value when checked prop changes
    useEffect(() => {
        checkedMotion.set(checked ? 1 : 0);
    }, [checked, checkedMotion]);

    // Event handlers
    const handleToggle = useCallback(
        (newChecked: boolean) => {
            if (disabled) return;

            if (!isControlled) {
                setInternalChecked(newChecked);
            }
            onCheckedChange?.(newChecked);
        },
        [disabled, isControlled, onCheckedChange],
    );

    const handlePointerDown = useCallback(
        (e: React.MouseEvent | React.TouchEvent) => {
            if (disabled) return;
            e.stopPropagation();

            const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
            pointerDown.set(1);
            initialPointerX.set(clientX);
        },
        [disabled, pointerDown, initialPointerX],
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!sliderRef.current || disabled || pointerDown.get() < 0.5) return;
            e.stopPropagation();

            const baseRatio = checkedMotion.get();
            const displacementX = e.clientX - initialPointerX.get();
            const ratio = baseRatio + displacementX / TRAVEL;
            const overflow = ratio < 0 ? -ratio : ratio > 1 ? ratio - 1 : 0;
            const overflowSign = ratio < 0 ? -1 : 1;
            const dampedOverflow = (overflowSign * overflow) / 22;
            xDragRatio.set(Math.min(1, Math.max(0, ratio)) + dampedOverflow);
        },
        [disabled, pointerDown, checkedMotion, initialPointerX, TRAVEL, xDragRatio],
    );

    const handleTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (!sliderRef.current || disabled || pointerDown.get() < 0.5) return;
            e.stopPropagation();

            const baseRatio = checkedMotion.get();
            const clientX = e.touches[0]?.clientX ?? 0;
            const displacementX = clientX - initialPointerX.get();
            const ratio = baseRatio + displacementX / TRAVEL;
            const overflow = ratio < 0 ? -ratio : ratio > 1 ? ratio - 1 : 0;
            const overflowSign = ratio < 0 ? -1 : 1;
            const dampedOverflow = (overflowSign * overflow) / 22;
            xDragRatio.set(Math.min(1, Math.max(0, ratio)) + dampedOverflow);
        },
        [disabled, pointerDown, checkedMotion, initialPointerX, TRAVEL, xDragRatio],
    );

    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            if (disabled) return;

            const x = e.clientX;
            const initialX = initialPointerX.get();
            const distance = x - initialX;
            if (Math.abs(distance) < 4) {
                const shouldBeChecked = checkedMotion.get() < 0.5;
                handleToggle(shouldBeChecked);
            }
        },
        [disabled, initialPointerX, checkedMotion, handleToggle],
    );

    const handleGlobalPointerUp = useCallback(
        (e: MouseEvent | TouchEvent) => {
            pointerDown.set(0);

            const x = e instanceof MouseEvent ? e.clientX : (e.changedTouches[0]?.clientX ?? 0);
            const distance = x - initialPointerX.get();

            if (Math.abs(distance) > 4) {
                const dragRatio = xDragRatio.get();
                const shouldBeChecked = dragRatio > 0.5;
                handleToggle(shouldBeChecked);
            }
        },
        [pointerDown, initialPointerX, xDragRatio, handleToggle],
    );

    // Global pointer up listener
    useEffect(() => {
        window.addEventListener('mouseup', handleGlobalPointerUp);
        window.addEventListener('touchend', handleGlobalPointerUp);
        return () => {
            window.removeEventListener('mouseup', handleGlobalPointerUp);
            window.removeEventListener('touchend', handleGlobalPointerUp);
        };
    }, [handleGlobalPointerUp]);

    //
    // SPRINGS
    //
    const xRatio = useSpring(
        useTransform(() => {
            const c = checkedMotion.get();
            const dragRatio = xDragRatio.get();

            if (pointerDown.get() > 0.5) {
                return dragRatio;
            } else {
                return c ? 1 : 0;
            }
        }),
        { damping: 80, stiffness: 1000 },
    );
    const backgroundOpacity = useSpring(
        useTransform(active, (v) => 1 - 0.9 * v),
        { damping: 80, stiffness: 2000 },
    );
    const thumbScale = useSpring(
        useTransform(active, (v) => THUMB_REST_SCALE + (THUMB_ACTIVE_SCALE - THUMB_REST_SCALE) * v),
        { damping: 80, stiffness: 2000 },
    );
    const scaleRatio = useSpring(useTransform(() => (0.4 + 0.5 * active.get()) * refractionBase.get()));
    const considerChecked = useTransform(() => {
        const x = xDragRatio.get();
        const c = checkedMotion.get();
        return pointerDown.get() ? (x > 0.5 ? 1 : 0) : c > 0.5 ? 1 : (0 as number);
    });

    const backgroundColor = useTransform(
        useSpring(considerChecked, { damping: 80, stiffness: 1000 }),
        mix('#94949F77', '#3BBF4EEE'),
    );

    return (
        <div
            className={cn('relative', className)}
            style={{
                width: sliderWidth,
                // height: thumbHeight,
                height: sliderHeight,
                ...style,
            }}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
        >
            <motion.div
                ref={sliderRef}
                style={{
                    display: 'inline-block',
                    width: sliderWidth,
                    height: sliderHeight,
                    backgroundColor: backgroundColor,
                    borderRadius: sliderHeight / 2,
                    position: 'absolute',
                    top: 0,
                    // top: (thumbHeight - sliderHeight) / 2,
                    cursor: 'pointer',
                }}
                onClick={handleClick}
            >
                <LiquidFilter
                    id={filterId}
                    width={thumbWidth}
                    height={thumbHeight}
                    radius={thumbRadius}
                    blur={blur}
                    glassThickness={glassThickness}
                    bezelWidth={bezelWidth}
                    refractiveIndex={refractiveIndex}
                    scaleRatio={scaleRatio}
                    specularOpacity={specularOpacity}
                    specularSaturation={specularSaturation}
                    bezelHeightFn={LIP.fn}
                />
                <motion.div
                    className="absolute"
                    onTouchStart={handlePointerDown}
                    onMouseDown={handlePointerDown}
                    style={{
                        height: thumbHeight,
                        width: thumbWidth,
                        marginLeft: -THUMB_REST_OFFSET + (sliderHeight - thumbHeight * THUMB_REST_SCALE) / 2,
                        x: useTransform(() => xRatio.get() * TRAVEL),
                        y: '-50%',
                        borderRadius: thumbRadius,
                        top: sliderHeight / 2,
                        backdropFilter: `url(#${filterId})`,
                        scale: thumbScale,
                        cursor: 'pointer',
                        backgroundColor: useTransform(backgroundOpacity, (op) => `rgba(255, 255, 255, ${op})`),
                        boxShadow: useTransform(() => {
                            const isPressed = pointerDown.get() > 0.5;
                            return (
                                '0 4px 22px rgba(0,0,0,0.1)' +
                                (isPressed
                                    ? ', inset 2px 7px 24px rgba(0,0,0,0.09), inset -2px -7px 24px rgba(255,255,255,0.09)'
                                    : '')
                            );
                        }),
                    }}
                />
            </motion.div>
        </div>
    );
};
