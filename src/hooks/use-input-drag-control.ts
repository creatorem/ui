'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const getStepValue = (e: MouseEvent | React.WheelEvent | React.KeyboardEvent, lockToStep: boolean): number => {
    let step = 1;
    if (e.ctrlKey) {
        step = 100;
    } else if (e.shiftKey) {
        step = 10;
    } else if (e.altKey && !lockToStep) {
        step = 0.1;
    }
    return step;
};

/**
 * Get the inner y position of the window.
 * @param y
 * @returns The inner y position of the window.
 */
const getWindowInnerYPosition = (y: number): number => {
    let finalY = y % window.innerHeight;
    if (finalY < 0) {
        finalY += window.innerHeight;
    }
    return finalY;
};

/**
 * Get the inner x position of the window.
 * @param x
 * @returns The inner x position of the window.
 */
const getWindowInnerXPosition = (x: number): number => {
    let finalX = x % window.innerWidth;
    if (finalX < 0) {
        finalX += window.innerWidth;
    }
    return finalX;
};

export interface UseInputDragControlParams {
    /**
     * The container able to trigger the drag control.
     */
    containerRef: React.RefObject<HTMLElement | null>;
    /**
     * The value of the number input.
     */
    value: number;
    /**
     * The step of the number input.
     * @default 1
     */
    step?: number;
    /**
     * The minimum value of the number input.
     */
    min?: number;
    /**
     * The maximum value of the number input.
     */
    max?: number;
    /**
     * The function to call when the value changes.
     */
    onDrag?: (newVal: number) => void;
    /**
     * Scale factor for drag sensitivity. Higher values make dragging more sensitive.
     * @default 1
     */
    dragScale?: number;
    /**
     * When true, disables ALT key 0.1 multiplier and snaps value to multiples of step.
     * @default false
     */
    lockToStep?: boolean;
    /**
     * Drag direction. Vertical: top is positive. Horizontal: right is positive.
     * @default 'vertical'
     */
    dragDirection?: 'vertical' | 'horizontal';
}

export const useInputDragControl = ({
    containerRef,
    value,
    step = 1,
    min,
    max,
    onDrag,
    dragScale = 1,
    lockToStep = false,
    dragDirection = 'vertical',
}: UseInputDragControlParams) => {
    const [isDragging, setIsDragging] = useState(false);
    const [xLocation, setXLocation] = useState(0);
    const [yLocation, setYLocation] = useState(0);
    const valueRef = useRef(value);
    const accumRef = useRef(0); // accumulate raw pointer movement along chosen axis

    // Keep an up-to-date reference to the external value so new drags
    // always start from the latest value
    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            // Don't prevent default - let the input focus normally
            const currentValue = valueRef.current;
            const startX = e.clientX;
            const startY = e.clientY;
            setXLocation(startX);
            setYLocation(startY);

            const initialValue = currentValue;
            let delta = 0;
            let hasMoved = false;
            const moveThreshold = 3; // pixels threshold to start dragging

            const handleMouseMove = (e: MouseEvent) => {
                const deltaX = Math.abs(e.clientX - startX);
                const deltaY = Math.abs(e.clientY - startY);

                // Only start dragging if we've moved beyond the threshold
                if (!hasMoved && (deltaX > moveThreshold || deltaY > moveThreshold)) {
                    hasMoved = true;
                    setIsDragging(true);

                    // Request pointer lock for smooth dragging
                    if (containerRef.current) {
                        containerRef.current.requestPointerLock();
                    }
                    accumRef.current = 0;
                }

                if (hasMoved) {
                    const pxPerStep = Math.max(1, dragScale);
                    const finalStepUnit = step * getStepValue(e, lockToStep);
                    // Compute delta based on axis: vertical (top is positive), horizontal (right is positive)
                    const movementY = e.movementY;
                    const movementX = e.movementX;
                    const axisMovement = dragDirection === 'vertical' ? -movementY : movementX;
                    // accumulate axis movement and only apply value change when we reached a multiple of pxPerStep
                    accumRef.current += axisMovement;
                    const stepsCount = (accumRef.current / pxPerStep) | 0; // truncate toward zero
                    if (stepsCount !== 0) {
                        accumRef.current -= stepsCount * pxPerStep;
                        delta += stepsCount * finalStepUnit;
                    }
                    const newVal = initialValue + delta;

                    // Handle min/max clamping
                    let finalValue = newVal;
                    if (max !== undefined && newVal > max) {
                        finalValue = max;
                        delta = max - initialValue;
                    } else if (min !== undefined && newVal < min) {
                        finalValue = min;
                        delta = min - initialValue;
                    }

                    // Update cursor position using movement deltas
                    setXLocation((prevX) => {
                        const newX = prevX + e.movementX;
                        return getWindowInnerXPosition(newX);
                    });

                    setYLocation((prevY) => {
                        const newY = prevY + e.movementY;
                        return getWindowInnerYPosition(newY);
                    });

                    onDrag?.(finalValue);
                }
            };

            const handleMouseUp = () => {
                if (hasMoved) {
                    document.exitPointerLock();
                    setIsDragging(false);
                }
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        },
        [step, min, max, onDrag, containerRef, dragScale, lockToStep],
    );

    // Handle custom cursor
    useEffect(() => {
        const cursor = document.getElementById('locked-cursor');
        if (isDragging) {
            if (cursor) {
                if (document.pointerLockElement) {
                    cursor.style.top = `${yLocation}px`;
                    cursor.style.left = `${xLocation}px`;
                    cursor.style.transform = `${dragDirection === 'horizontal' ? 'rotate(90deg)' : 'rotate(0deg)'}`;
                }
            } else {
                // Create custom drag cursor
                const createdCursor = document.createElement('div');
                createdCursor.innerHTML = `
                    <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke="white" stroke-linecap="round" stroke-width="1" d="M13 6.99h3L12 3 8 6.99h3v10.02H8L12 21l4-3.99h-3z"></path>
                    </svg>
                `;
                createdCursor.classList.add('drag-icon');
                createdCursor.id = 'locked-cursor';
                createdCursor.style.cssText = `
                    position: fixed;
                    pointer-events: none;
                    z-index: 9999;
                    color: #6b7280;
                    transform: ${dragDirection === 'horizontal' ? 'rotate(90deg)' : 'rotate(0deg)'};
                `;
                document.body.append(createdCursor);
                createdCursor.style.top = `${yLocation}px`;
                createdCursor.style.left = `${xLocation}px`;
            }
        } else if (cursor) {
            cursor.remove();
        }
    }, [xLocation, yLocation, isDragging, dragDirection]);

    return { handleMouseDown, isDragging };
};
