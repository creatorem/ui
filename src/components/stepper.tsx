'use client';

import { Button } from '@kit/ui/button';
import { FormField } from '@kit/ui/form';
import { cn } from '@kit/utils';
import {
    StepperActiveStep,
    StepperFormField,
    type StepperProps,
    StepperStep,
    StepperStepLength,
    type StepperStepProps,
    Stepper as UtilsStepper,
    useStepper,
    useStepperContentBase,
    useStepperForm,
} from '@kit/utils/stepper';
import { Slot } from '@radix-ui/react-slot';
import { AnimatePresence, HTMLMotionProps, motion } from 'motion/react';
import React, { useCallback, useEffect } from 'react';

function Stepper(props: Omit<React.ComponentProps<typeof UtilsStepper>, 'FormField'>) {
    return <UtilsStepper {...props} FormField={FormField} />;
}

function StepperContent({ children, ...props }: React.ComponentPropsWithoutRef<'div'>) {
    const { activeStep } = useStepper();
    const { selectedChild } = useStepperContentBase(children);
    const { containerRef } = useStepperAutoFocusNext(activeStep, selectedChild);

    return (
        <div ref={containerRef} {...props}>
            {selectedChild}
        </div>
    );
}

function StepperMotionContent({ children, ...props }: { children: React.ReactNode } & HTMLMotionProps<'div'>) {
    const { activeStep } = useStepper();
    const { selectedChild } = useStepperContentBase(children);
    const { containerRef } = useStepperAutoFocusNext(activeStep, selectedChild);

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

function useStepperAutoFocusNext(activeStep: number, dependency?: unknown) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const prevStepRef = React.useRef<number>(activeStep);

    useEffect(() => {
        const previous = prevStepRef.current;
        if (activeStep > previous) {
            const id = setTimeout(() => {
                const root = containerRef.current;
                if (!root) return;
                const el = root.querySelector<HTMLElement>(
                    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
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

    return { containerRef };
}

export interface StepperPreviousProps {
    asChild?: boolean;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>, step?: number) => void;
}

const StepperPrevious = React.forwardRef<
    HTMLButtonElement,
    StepperPreviousProps & Omit<React.ComponentPropsWithoutRef<typeof Button>, 'aria-label' | 'onClick' | 'asChild'>
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
        [activeStep, movePrevious, onClick],
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
    onLastClick?: () => void;
    canGoNext?: (step: number) => Promise<boolean>;
}

const StepperNext = React.forwardRef<
    HTMLButtonElement,
    StepperNextProps & Omit<React.ComponentPropsWithoutRef<typeof Button>, 'aria-label' | 'onClick' | 'asChild'>
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
            onLastClick,
            ...props
        },
        ref,
    ) => {
        const { activeStep, moveNext, isLastStep } = useStepper();
        const { isDirtyGateOpen, validateStep, blockedSteps, reactForm, onSubmit } = useStepperForm();

        const isLast = isLastStep();

        const handleNextClick = useCallback(
            async (e: React.MouseEvent<HTMLButtonElement>) => {
                const isLast = isLastStep();
                if (!isLast || !reactForm || onSubmit) {
                    e.preventDefault();
                    e.stopPropagation();
                }

                if (canGoNext && !(await canGoNext(activeStep))) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                const valid = await validateStep();
                if (!valid) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                onClick?.(e, activeStep);

                if (isLast) {
                    onLastClick?.();
                    onSubmit?.();
                    return;
                }

                moveNext();
            },
            [
                activeStep,
                moveNext,
                onClick,
                reactForm,
                isLastStep,
                validateStep,
                canGoNext,
                onLastClick,
                isLast,
                onSubmit,
            ],
        );

        if (isLast) {
            if (replaceForLast) return replaceForLast;
            if (reactForm) {
                return (
                    <Button
                        ref={ref}
                        aria-label="Submit"
                        role="button"
                        type={onSubmit ? 'button' : 'submit'}
                        onClick={handleNextClick}
                        className={cn(className)}
                        variant={variant ?? 'default'}
                        disabled={
                            typeof disabled === 'boolean'
                                ? disabled
                                : reactForm.formState.isSubmitSuccessful || blockedSteps[activeStep] || !isDirtyGateOpen
                        }
                        {...props}
                    >
                        {lastChildren ??
                            (reactForm.formState.isSubmitting ? (
                                <>Submitting...</>
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
                className={cn(isLast && !onClick && !reactForm ? 'pointer-events-none opacity-0' : '', className)}
                variant={variant ?? 'default'}
                disabled={typeof disabled === 'boolean' ? disabled : blockedSteps[activeStep] || !isDirtyGateOpen}
                {...props}
            >
                {isLast ? lastChildren || 'Done' : children || 'Next →'}
            </Button>
        );
    },
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
                className,
            )}
            data-slot="stepper-trigger"
            data-state={activeStep === step ? 'active' : activeStep > step ? 'complete' : 'upcoming'}
            onClick={handleClick}
        >
            {children}
        </Comp>
    );
}

export { Stepper, StepperContent, StepperMotionContent, StepperNext, StepperPrevious, StepperTrigger };

/* from utils */
export {
    StepperActiveStep,
    StepperFormField,
    StepperStep,
    StepperStepLength,
    type StepperProps,
    type StepperStepProps,
};
