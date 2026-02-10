'use client';

import { Input } from '@kit/ui/input';
import { cn } from '@kit/utils';
import { Slot } from '@radix-ui/react-slot';
import React, { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useInputDragControl } from '../hooks/use-input-drag-control';

interface NumberInputContextValue {
    value: number | '';
    min?: number;
    max?: number;
    step: number;
    unit?: string;
    onValueChange: (value: number | '') => void;
}

const NumberInputContext = createContext<NumberInputContextValue | null>(null);

const useNumberInputContext = () => {
    const context = useContext(NumberInputContext);
    if (!context) {
        throw new Error('NumberInput components must be used within NumberInputRoot');
    }
    return context;
};

export interface NumberInputRootProps {
    /**
     * Whether to render the number input as a child component.
     * @default false
     */
    asChild?: boolean;
    value?: number | '';
    defaultValue?: number;
    /**
     * The unit of the number input.
     */
    unit?: string;
    /**
     * The minimum value of the number input.
     */
    min?: number;
    /**
     * The maximum value of the number input.
     */
    max?: number;
    /**
     * The step of the number input.
     * @default 1
     */
    step?: number;
    onValueChange?: (value: number | '') => void;
    className?: string;
}

const NumberInputRoot = forwardRef<HTMLDivElement, NumberInputRootProps & React.PropsWithChildren>(
    (
        {
            asChild = false,
            children,
            value: propValue,
            defaultValue = 0,
            min,
            max,
            step = 1,
            unit,
            onValueChange,
            className,
            ...props
        },
        ref,
    ) => {
        const Comp = asChild ? Slot : 'div';
        const prevPropValueRef = useRef(propValue);

        const [internalValue, setInternalValue] = useState<number | ''>(propValue ?? defaultValue);

        // Use controlled state if open prop is provided, otherwise use internal state
        const finalValue = propValue !== undefined ? propValue : internalValue;

        const handleValueChange = useCallback(
            (value: number | '' | ((prev: number | '') => number | '')) => {
                const newValue = typeof value === 'function' ? value(finalValue) : value;

                if (propValue === undefined) {
                    // Only update internal state if not controlled
                    setInternalValue(newValue);
                }

                // Always call onOpenChange if provided
                onValueChange?.(newValue);
            },
            [finalValue, propValue, onValueChange],
        );

        // Sync with controlled prop value
        useEffect(() => {
            if (typeof propValue === 'number' && propValue !== prevPropValueRef.current) {
                setInternalValue(propValue);
                prevPropValueRef.current = propValue;
            }
        }, [propValue]);

        const contextValue: NumberInputContextValue = {
            value: internalValue,
            min,
            max,
            step,
            unit,
            onValueChange: handleValueChange,
        };

        return (
            <NumberInputContext.Provider value={contextValue}>
                <Comp ref={ref} className={cn('flex items-center gap-2', className)} {...props}>
                    {children}
                </Comp>
            </NumberInputContext.Provider>
        );
    },
);
NumberInputRoot.displayName = 'NumberInputRoot';

export interface DragWheelControlsProps {
    /**
     * Whether to render the drag and wheel controls as a child component.
     * @default false
     */
    asChild?: boolean;
    /**
     * Whether to enable drag functionality.
     * @default false
     */
    disableDrag?: boolean;
    /**
     * Whether to enable wheel functionality.
     * @default false
     */
    disableWheel?: boolean;
    /**
     * Scale factor for drag sensitivity. Higher values make dragging more sensitive.
     * @default 1
     */
    dragScale?: number;
    /**
     * Scale factor for wheel sensitivity. Higher values make wheel scrolling more sensitive.
     * @default 1
     */
    wheelScale?: number;
    /**
     * When true, disables ALT key 0.1 multiplier and snaps value to multiples of step.
     * @default false
     */
    lockToStep?: boolean;
    /**
     * Drag axis. Vertical: top is positive. Horizontal: right is positive.
     * @default 'vertical'
     */
    dragDirection?: 'vertical' | 'horizontal';
}

const DragWheelControls = forwardRef<HTMLDivElement, DragWheelControlsProps & React.HTMLAttributes<HTMLDivElement>>(
    (
        {
            children,
            asChild = false,
            disableDrag = false,
            disableWheel = false,
            dragScale = 1,
            wheelScale = 1,
            lockToStep = false,
            dragDirection = 'vertical',
            className,
            ...props
        },
        ref,
    ) => {
        const Comp = asChild ? Slot : 'div';
        const { value, onValueChange, min, max, step } = useNumberInputContext();
        const localRef = useRef<HTMLDivElement>(null);

        const currentValue = typeof value === 'number' ? value : (min ?? 0);

        // Handle wheel increment
        useEffect(() => {
            const container = localRef.current;
            if (!container || disableWheel) return;

            const handleWheel = (event: WheelEvent) => {
                event.preventDefault();
                event.stopPropagation();

                const direction = event.deltaY < 0 ? 1 : -1;
                const threshold = Math.max(1, Math.round(wheelScale));

                const anyContainer = container as unknown as { __wheelAccum?: number };
                anyContainer.__wheelAccum = (anyContainer.__wheelAccum ?? 0) + direction;
                const stepsCount = (anyContainer.__wheelAccum / threshold) | 0;
                if (stepsCount === 0) return;
                anyContainer.__wheelAccum -= stepsCount * threshold;

                const increment = stepsCount * step;
                const newValue = Math.round((currentValue + increment) / step) * step;
                const clampedValue = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, newValue));
                onValueChange(clampedValue);
            };

            container.addEventListener('wheel', handleWheel, { passive: false });
            return () => container.removeEventListener('wheel', handleWheel);
        }, [disableWheel, currentValue, step, wheelScale, min, max, onValueChange]);

        const { handleMouseDown, isDragging } = useInputDragControl({
            containerRef: localRef,
            value: currentValue,
            step,
            min,
            max,
            onDrag: onValueChange,
            dragScale,
            lockToStep,
            dragDirection,
        });

        return (
            <Comp
                ref={(node) => {
                    localRef.current = node;
                    if (typeof ref === 'function') {
                        ref(node);
                    } else if (ref) {
                        (ref as React.RefObject<HTMLDivElement | null>).current = node;
                    }
                }}
                onMouseDown={!disableDrag ? handleMouseDown : undefined}
                style={{
                    cursor: isDragging ? (dragDirection === 'horizontal' ? 'ew-resize' : 'ns-resize') : 'default',
                }}
                className={cn('flex items-center gap-2', className)}
                {...props}
            >
                {children}
            </Comp>
        );
    },
);
DragWheelControls.displayName = 'DragWheelControls';

const NumberInputBase = forwardRef<
    HTMLInputElement,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'step'>
>(({ className, ...props }, ref) => {
    const { value, onValueChange, min, max, step, unit } = useNumberInputContext();

    const inputRef = useRef<HTMLInputElement>(null);

    const handleChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = event.target.value === '' ? '' : Number(event.target.value);
            onValueChange(newValue);
        },
        [onValueChange],
    );

    const handleBlur = useCallback(() => {
        if (typeof value === 'number') {
            const clampedValue = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
            onValueChange(clampedValue);
        } else {
            onValueChange(min ?? 0);
        }
    }, [value, min, max, onValueChange]);

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                const direction = event.key === 'ArrowUp' ? 'up' : 'down';
                const increment = direction === 'up' ? step : -step;
                const currentValue = typeof value === 'number' ? value : (min ?? 0);
                const newValue = Math.round((currentValue + increment) / step) * step;
                const clampedValue = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, newValue));
                onValueChange(clampedValue);
            }
        },
        [value, step, min, max, onValueChange],
    );

    return (
        <Input
            ref={ref || inputRef}
            type="number"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            step={step}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={typeof value === 'number' ? value : undefined}
            aria-valuetext={typeof value === 'number' ? `${value}${unit ? ` ${unit}` : ''}` : undefined}
            className={cn('flex-1', className)}
            {...props}
        />
    );
});
NumberInputBase.displayName = 'NumberInputBase';

export interface NumberInputUnitProps {
    /**
     * Whether to render the number input unit as a child component.
     * @default false
     */
    asChild?: boolean;
}

const NumberInputUnit = forwardRef<HTMLDivElement, NumberInputUnitProps & React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'div';
        const { unit } = useNumberInputContext();

        const displayUnit = children || unit;

        if (!displayUnit) return null;

        return (
            <Comp ref={ref} className={cn('text-muted-foreground text-sm whitespace-nowrap', className)} {...props}>
                {displayUnit}
            </Comp>
        );
    },
);
NumberInputUnit.displayName = 'NumberInputUnit';

/* _______Higher Level Component________ */

export interface NumberInputProps extends Omit<NumberInputRootProps, 'children' | 'asChild'> {
    controls?: DragWheelControlsProps;
    base?: React.ComponentProps<typeof NumberInputBase>;
}

const NumberInput: React.FC<NumberInputProps> = ({ controls = {}, base = {}, ...props }) => {
    return (
        <NumberInputRoot {...props} asChild>
            <DragWheelControls {...controls}>
                <NumberInputBase {...base} />
                <NumberInputUnit />
            </DragWheelControls>
        </NumberInputRoot>
    );
};

export { DragWheelControls, NumberInput, NumberInputBase, NumberInputRoot, NumberInputUnit };
