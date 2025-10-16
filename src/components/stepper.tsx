'use client';

import { cn } from '@kit/shared';
import { Button } from '@kit/ui/button';
import { FormField } from '@kit/ui/form';
import { Slot } from '@radix-ui/react-slot';
import { AnimatePresence, HTMLMotionProps, motion } from 'motion/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

// Utility: collect field names recursively from a React node tree
const collectFieldNames = (node: React.ReactNode, acc: Set<string>) => {
    if (node == null || typeof node === 'boolean') return;
    if (Array.isArray(node)) {
        for (const child of node) collectFieldNames(child, acc);
        return;
    }
    if (typeof node === 'string' || typeof node === 'number') return;
    if (React.isValidElement(node)) {
        // Specifically detect our FormField component and extract its 'name' prop
        if (node.type === FormField) {
            const maybeName = (node.props as any)?.name;
            if (typeof maybeName === 'string') {
                acc.add(maybeName);
            }
        }
        const childrenProp = (node.props as any)?.children;
        if (childrenProp) collectFieldNames(childrenProp, acc);
    }
};

const areArraysEqual = (a: string[] | undefined, b: string[]) => {
    if (!a) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
};

interface StepperContextType {
    activeStep: number;
    /**
     * Number of direct StepperStep children inside StepperContent
     */
    stepLength: number | null;
    /**
     * Update the number of steps (called by StepperContent)
     * @param length
     * @returns
     */
    setStepLength: (length: number) => void;
    /**
     * Allow consumers to programmatically change step
     *
     * @param step
     * @returns
     */
    onStepChange: (step: number) => void;
    moveNext: () => void;
    movePrevious: () => void;
    isFirstStep: () => boolean;
    isLastStep: () => boolean;
    /**
     * If true, prevent StepperTrigger from navigating forward (only backward allowed)
     */
    disableForwardNav: boolean;
}

const StepperContext = React.createContext<StepperContextType | undefined>(undefined);

function useStepper(): StepperContextType {
    const context = React.useContext(StepperContext);
    if (!context) {
        throw new Error('Stepper components must be used within a Stepper');
    }
    return context;
}

interface StepperFormContextType {
    /**
     * The reactForm of the form
     */
    reactForm: UseFormReturn<any> | undefined;
    /**
     * Detect the field names contained in a specific step react node tree
     *
     * @param stepChildren - The children of the step
     * @returns - The field names contained in the step
     */
    detectStepFieldNames: (
        stepChildren: React.ReactElement<
            StepperStepProps & {
                children: React.ReactNode;
            },
            string | React.JSXElementConstructor<any>
        >[]
    ) => void;
    /**
     * Whether the Next button is blocked for a given step due to failed validation
     */
    blockedSteps: Record<number, boolean>;
    /**
     * Whether the Next button is open for a given step due to requireDirtyOnStep
     */
    isDirtyGateOpen: boolean;
    /**
     * Validate the current step
     */
    validateStep: () => Promise<boolean>;
}

const StepperFormContext = React.createContext<StepperFormContextType | undefined>(undefined);

function useStepperForm(): StepperFormContextType {
    const context = React.useContext(StepperFormContext);
    if (!context) {
        throw new Error('Stepper form features must be used within a Stepper');
    }
    return context;
}

function useStepperFormContext({
    reactForm,
    activeStep,
    requireDirtyOnStep,
}: Pick<StepperProps, 'reactForm' | 'requireDirtyOnStep'> & { activeStep: number }): StepperFormContextType {
    const [stepToFieldNames, setStepToFieldNames] = useState<Record<number, string[]>>({});
    const [blockedSteps, setBlockedSteps] = useState<Record<number, boolean>>({});

    // When the current step is blocked due to failed validation, unblock it
    // as soon as any field in that step changes
    useEffect(() => {
        if (!reactForm) return;
        if (!blockedSteps[activeStep]) return;
        const fields = stepToFieldNames[activeStep] ?? [];
        if (fields.length === 0) return;

        const subscription = reactForm.watch((_value, { name }) => {
            if (!name) return;
            if (fields.includes(name)) {
                setBlockedSteps((prev) => (prev[activeStep] ? { ...prev, [activeStep]: false } : prev));
            }
        });

        return () => {
            try {
                subscription?.unsubscribe?.();
            } catch (_e) {
                // noop
            }
        };
    }, [reactForm, activeStep, blockedSteps, stepToFieldNames]);

    const registerStepFieldNames = useCallback(
        (
            stepChildren: React.ReactElement<
                StepperStepProps & {
                    children: React.ReactNode;
                },
                string | React.JSXElementConstructor<any>
            >[]
        ) => {
            // For each step, compute and register its field names only if changed
            for (let index = 0; index < stepChildren.length; index++) {
                const child = stepChildren[index];
                if (!child || !React.isValidElement(child)) continue;
                const stepNumber =
                    typeof (child.props as any)?.step === 'number' ? (child.props as any).step : index + 1;
                const namesSet = new Set<string>();
                collectFieldNames(child.props.children, namesSet);
                const names = Array.from(namesSet).sort();
                const prev = stepToFieldNames[stepNumber]?.slice().sort();
                if (!areArraysEqual(prev, names)) {
                    setStepToFieldNames((prev) => ({ ...prev, [stepNumber]: names }));
                }
            }
        },
        []
    );

    const isDirtyGateOpen = useMemo(() => {
        if (!requireDirtyOnStep || !reactForm) return true;
        const fields = stepToFieldNames[activeStep] ?? [];
        if (fields.length === 0) return true;
        const dirtyMap = (reactForm.formState.dirtyFields ?? {}) as Record<string, unknown>;
        return fields.some((name) => {
            const flag = dirtyMap[name];
            return typeof flag === 'boolean' ? flag : !!flag;
        });
    }, [requireDirtyOnStep, reactForm, activeStep, stepToFieldNames]);

    const validateStep = useCallback(async () => {
        if (!reactForm) return true;
        const fields = stepToFieldNames[activeStep] ?? [];
        if (fields.length === 0) return true;
        const valid = await reactForm.trigger(fields as any, { shouldFocus: true });
        if (!valid) {
            setBlockedSteps((prev) => (prev[activeStep] ? prev : { ...prev, [activeStep]: true }));
        }
        return valid;
    }, [reactForm, activeStep, stepToFieldNames]);

    return useMemo(
        () => ({
            reactForm,
            detectStepFieldNames: registerStepFieldNames,
            blockedSteps,
            isDirtyGateOpen,
            validateStep,
        }),
        [reactForm, requireDirtyOnStep, stepToFieldNames, blockedSteps]
    );
}

export interface StepperProps {
    step?: number;
    onStepChange?: (step: number) => void;
    children: React.ReactNode;
    /**
     * Pass your `react-hook-form` instance to enable per-step validation and submit handling
     */
    reactForm?: UseFormReturn<any>;
    /**
     * Works if `reactForm` is provided.
     * If true, require at least one field in the current step to be dirty to enable Next
     *
     * @default false
     */
    requireDirtyOnStep?: boolean;
    /**
     * The number of steps to render, if not provided, it will be the number of direct StepperStep children inside StepperContent
     */
    numberOfSteps?: number;
    /**
     * If true, clicking on StepperTrigger cannot move to a forward step.
     * Users must use the Next button to advance. Backward navigation via trigger remains allowed.
     *
     * We advise you to use this feature for your forms to make sure users don't skip steps.
     *
     * @default false
     */
    disableForwardNav?: boolean;
}

function Stepper({
    step: controlledActiveStep,
    onStepChange,
    children,
    reactForm,
    requireDirtyOnStep = false,
    numberOfSteps,
    disableForwardNav = false,
}: StepperProps) {
    const [internalActiveStep, setInternalActiveStep] = useState<number>(1);
    const [stepLength, setStepLength] = useState<number | null>(numberOfSteps ?? null);

    const activeStep = controlledActiveStep ?? internalActiveStep;

    const handleStepChange = useCallback(
        (step: number): void => {
            if (onStepChange) {
                onStepChange(step);
            } else {
                setInternalActiveStep(step);
            }
        },
        [onStepChange, setInternalActiveStep]
    );

    const moveNext = useCallback(() => {
        handleStepChange(activeStep + 1);
    }, [activeStep, handleStepChange]);

    const movePrevious = useCallback(() => {
        handleStepChange(activeStep - 1);
    }, [activeStep, handleStepChange]);

    const contextValue = useMemo(
        () => ({
            activeStep,
            stepLength,
            setStepLength: (length: number) => setStepLength(length),
            onStepChange: handleStepChange,
            moveNext,
            movePrevious,
            isFirstStep: () => activeStep === 1,
            isLastStep: () => stepLength !== null && stepLength > 0 && activeStep === stepLength,
            disableForwardNav,
        }),
        [activeStep, stepLength, handleStepChange, moveNext, movePrevious, disableForwardNav]
    );

    const formContextValue = useStepperFormContext({ reactForm, activeStep, requireDirtyOnStep });

    return (
        <StepperContext.Provider value={contextValue}>
            <StepperFormContext.Provider value={formContextValue}>{children}</StepperFormContext.Provider>
        </StepperContext.Provider>
    );
}

function StepperContent({ children, ...props }: React.ComponentPropsWithoutRef<'div'>) {
    const { containerRef, selectedChild } = useStepperContentBase(children);
    return (
        <div ref={containerRef} {...props}>
            {selectedChild}
        </div>
    );
}

function StepperMotionContent({
    children,
    ...props
}: { children: React.ReactNode } & HTMLMotionProps<'div'>) {
    const { activeStep } = useStepper();
    const { containerRef, selectedChild } = useStepperContentBase(children);

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={activeStep}
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ duration: 0.2 }}
                {...props}
                ref={containerRef}
            >
                {selectedChild}
            </motion.div>
        </AnimatePresence>
    );
}

function useStepperAutoFocusNext(
    containerRef: React.RefObject<HTMLDivElement | null>,
    activeStep: number,
    dependency?: unknown
) {
    const prevStepRef = React.useRef<number>(activeStep);

    useEffect(() => {
        const previous = prevStepRef.current;
        if (activeStep > previous) {
            const id = setTimeout(() => {
                const root = containerRef.current;
                if (!root) return;
                const el = root.querySelector<HTMLElement>(
                    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
                );
                el?.focus?.();
            }, 0);
            return () => clearTimeout(id);
        }
        return;
    }, [activeStep, containerRef, dependency]);

    useEffect(() => {
        prevStepRef.current = activeStep;
    }, [activeStep]);
}

// Shared base for StepperContent and StepperMotionContent
function useStepperContentBase(children: React.ReactNode) {
    const { activeStep, setStepLength, stepLength } = useStepper();
    const { detectStepFieldNames } = useStepperForm();
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    const stepChildren = useMemo(() => {
        const allChildren = React.Children.toArray(children);
        return allChildren.filter(
            (child): child is React.ReactElement<StepperStepProps & { children: React.ReactNode }> =>
                React.isValidElement(child) && child.type === StepperStep
        );
    }, [children]);

    useEffect(() => {
        const length = stepChildren.length;
        if (length !== stepLength) setStepLength(length);
        detectStepFieldNames(stepChildren);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepChildren, stepLength, setStepLength, detectStepFieldNames]);

    const selectedChild = useMemo(() => {
        let selected: React.ReactNode | null = null;
        for (let index = 0; index < stepChildren.length; index++) {
            const child = stepChildren[index];
            if (!child || !React.isValidElement(child)) continue;
            const stepNumber =
                typeof (child.props as any)?.step === 'number' ? (child.props as any).step : index + 1;
            if (stepNumber === activeStep) {
                selected = child;
                break;
            }
        }
        return selected;
    }, [activeStep, stepChildren]);

    useStepperAutoFocusNext(containerRef, activeStep, selectedChild);

    return { containerRef, selectedChild } as const;
}

export interface StepperStepProps {
    asChild?: boolean;
    /**
     * The assicated step number, if not provided, we will use the direct child index of StepperContent
     */
    step?: number;
}

/**
 * Must be the direct child of StepperContent
 */
function StepperStep({ asChild, children }: StepperStepProps & { children: React.ReactNode }) {
    const Comp = asChild ? Slot : 'div';
    return <Comp>{children}</Comp>;
}

export interface StepperPreviousProps {
    asChild?: boolean;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>, step?: number) => void;
}

const StepperPrevious = React.forwardRef<
    HTMLButtonElement,
    StepperPreviousProps &
        Omit<React.ComponentPropsWithoutRef<typeof Button>, 'aria-label' | 'onClick' | 'asChild'>
>(({ className, children, variant, disabled, onClick, ...props }, ref) => {
    const { activeStep, movePrevious, isFirstStep } = useStepper();

    const handlePrevClick = useCallback(
        async (e: React.MouseEvent<HTMLButtonElement>) => {
            e.preventDefault();
            e.stopPropagation();

            if (isFirstStep()) return;
            onClick?.(e, activeStep);
            movePrevious();
        },
        [activeStep, movePrevious, onClick]
    );

    return (
        <Button
            ref={ref}
            aria-label="Previous"
            onClick={handlePrevClick}
            disabled={typeof disabled === 'boolean' ? disabled : isFirstStep()}
            className={cn(className)}
            variant={variant ?? 'outline'}
            {...props}
        >
            {children || '← Previous'}
        </Button>
    );
});
StepperPrevious.displayName = 'StepperPrevious';

export interface StepperNextProps {
    asChild?: boolean;
    /**
     * The children of the next button when the last step is reached.
     */
    lastChildren?: React.ReactNode;
    /**
     * Replace the all component for the last step.
     */
    replaceForLast?: React.ReactNode;
    onClick?: (event?: React.MouseEvent<HTMLButtonElement>, step?: number) => void;
    canGoNext?: (step?: number) => Promise<boolean>;
}

const StepperNext = React.forwardRef<
    HTMLButtonElement,
    StepperNextProps &
        Omit<React.ComponentPropsWithoutRef<typeof Button>, 'aria-label' | 'onClick' | 'asChild'>
>(
    (
        {
            className,
            children,
            variant,
            disabled,
            lastChildren,
            replaceForLast,
            onClick,
            canGoNext,
            ...props
        },
        ref
    ) => {
        const { activeStep, moveNext, isLastStep } = useStepper();
        const { isDirtyGateOpen, validateStep, blockedSteps, reactForm } = useStepperForm();

        const handleNextClick = useCallback(
            async (e: React.MouseEvent<HTMLButtonElement>) => {
                const isLast = isLastStep();
                if (!isLast || !reactForm) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                
                if (canGoNext && !(await canGoNext(activeStep))) return;
                
                onClick?.(e, activeStep);

                const valid = await validateStep();
                if (isLast) return;
                if (valid) moveNext();
            },
            [activeStep, moveNext, onClick, reactForm, isLastStep, validateStep, canGoNext]
        );

        const isLast = isLastStep();

        if (isLast) {
            if (replaceForLast) return replaceForLast;
            if (reactForm) {
                return (
                    <Button
                        ref={ref}
                        aria-label="Submit"
                        role="button"
                        type="submit"
                        onClick={handleNextClick}
                        className={cn(className)}
                        variant={variant ?? 'default'}
                        disabled={
                            typeof disabled === 'boolean'
                                ? disabled
                                : reactForm.formState.isSubmitSuccessful ||
                                  blockedSteps[activeStep] ||
                                  !isDirtyGateOpen
                        }
                        {...props}
                    >
                        {lastChildren ??
                            (reactForm.formState.isSubmitting ? (
                                <>
                                    Submitting...
                                </>
                            ) : reactForm.formState.isSubmitSuccessful ? (
                                'Registration Complete!'
                            ) : (
                                'Complete Registration'
                            ))}
                    </Button>
                );
            }
        }

        return (
            <Button
                ref={ref}
                aria-label={isLast ? 'Done' : 'Next'}
                onClick={handleNextClick}
                className={cn(
                    isLast && !onClick && !reactForm ? 'pointer-events-none opacity-0' : '',
                    className
                )}
                variant={variant ?? 'default'}
                disabled={
                    typeof disabled === 'boolean' ? disabled : blockedSteps[activeStep] || !isDirtyGateOpen
                }
                {...props}
            >
                {isLast ? lastChildren || 'Done' : children || 'Next →'}
            </Button>
        );
    }
);
StepperNext.displayName = 'StepperNext';

export interface StepperTriggerProps {
    asChild?: boolean;
    step: number;
}

function StepperTrigger({
    asChild,
    className,
    step,
    children,
}: StepperTriggerProps & React.ComponentPropsWithoutRef<'div'>) {
    const Comp = asChild ? Slot : 'div';
    const { onStepChange, activeStep, disableForwardNav } = useStepper();

    const handleClick = useCallback(() => {
        if (disableForwardNav && step > activeStep) return;
        onStepChange(step);
    }, [step, onStepChange, disableForwardNav, activeStep]);

    return (
        <Comp
            className={cn(
                'group/stepper-trigger cursor-pointer',
                disableForwardNav && activeStep < step && 'pointer-events-none opacity-50',
                className
            )}
            data-slot="stepper-trigger"
            data-state={activeStep === step ? 'active' : activeStep > step ? 'complete' : 'upcoming'}
            onClick={handleClick}
        >
            {children}
        </Comp>
    );
}

const StepperActiveStep = () => {
    const { activeStep } = useStepper();
    return <>{activeStep}</>;
};
const StepperStepLength = () => {
    const { stepLength } = useStepper();
    return <>{stepLength}</>;
};

export {
    Stepper,
    StepperActiveStep,
    StepperContent,
    StepperMotionContent,
    StepperNext,
    StepperPrevious,
    StepperStep,
    StepperStepLength,
    StepperTrigger,
};
