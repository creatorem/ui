'use client';

import { Icon } from '@kit/ui/icon';
import { Portal } from '@kit/ui/portal';
import { cn } from '@kit/utils';
import { AnimatePresence, type Easing, HTMLMotionProps, motion, type Transition } from 'framer-motion';
import React, { useCallback, useId, useMemo, useState } from 'react';
import { RemoveScroll } from 'react-remove-scroll';
import { useDelay, useFnDelay } from '../hooks/use-delay';

const Z_INDEX = 1000;

const DEFAULT_DURATION = 0.5;
const DEFAULT_EASE = [0.7, 0, 0.6, 0.917] as Easing;

const DEFAULT_TRANSITION: Transition & { duration: number; layout: { duration: number } } = {
    ease: DEFAULT_EASE,
    duration: DEFAULT_DURATION,
    layout: {
        ease: DEFAULT_EASE,
        duration: DEFAULT_DURATION,
    },
};

const createDurationVariables = (duration: number) => {
    return {
        ['--dialog-duration' as string]: `${duration}s`,
        ['--dialog-duration-95' as string]: `${duration * 0.95}s`,
        ['--dialog-duration-90' as string]: `${duration * 0.9}s`,
        ['--dialog-duration-80' as string]: `${duration * 0.8}s`,
        ['--dialog-duration-70' as string]: `${duration * 0.7}s`,
        ['--dialog-duration-60' as string]: `${duration * 0.6}s`,
        ['--dialog-duration-50' as string]: `${duration * 0.5}s`,
        ['--dialog-duration-40' as string]: `${duration * 0.4}s`,
        ['--dialog-duration-30' as string]: `${duration * 0.3}s`,
        ['--dialog-duration-20' as string]: `${duration * 0.2}s`,
        ['--dialog-duration-10' as string]: `${duration * 0.1}s`,
    };
};

// can be replaced by lodash.merge
function deepMerge<T>(obj1: T, obj2: T = {} as T): T {
    const result = { ...obj1 };

    for (const key in obj2) {
        if (obj2[key] && typeof obj2[key] === 'object' && !Array.isArray(obj2[key])) {
            result[key] = deepMerge(
                (result[key] as T[Extract<keyof T, string>]) || ({} as T[Extract<keyof T, string>]),
                obj2[key] as T[Extract<keyof T, string>],
            );
        } else {
            result[key] = obj2[key];
        }
    }

    return result;
}

interface DialogContextType {
    id: string;
    /**
     * Used to set the `data-open` attribute on the dialog components.
     *
     * For a human, `dataOpen` change almost at the same time as `presenceOpen`.
     *
     * `dataOpen` is :
     *  - the _last_ value to change on **open**
     *  - the _first_ value to change on **close**
     */
    dataOpen: boolean;
    /**
     * Used for the `AnimatePresence` component.
     * When true, the dialog content is mounted in the react tree.
     *
     * For a human, `presenceOpen` change almost at the same time as `dataOpen`.
     *
     * `presenceOpen` is :
     *  - the _first_ value to change on **open**
     *  - the _last_ value to change on **close**
     */
    presenceOpen: boolean;
    setIsOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
    transition: Transition & typeof DEFAULT_TRANSITION;
    /**
     * Is `presenceOpen` is true, but also during animations.
     */
    animatedOpen: boolean;
}

const DialogContext = React.createContext<DialogContextType | null>(null);

const useDialog = () => {
    const context = React.useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a Dialog');
    }
    return context;
};

export interface DialogProps {
    /**
     * Custom transition configuration for animations for the all dialog components.
     */
    transition?: Transition & typeof DEFAULT_TRANSITION;
    /**
     * Initial open state when uncontrolled.
     *
     * @default false
     */
    defaultOpen?: boolean;
    /**
     * Controlled open state. When provided, the dialog becomes controlled.
     */
    open?: boolean;
    /**
     * Callback called when the open state changes.
     */
    onOpenChange?: (open: boolean) => void;
}

/**
 * Dialog component that supports both controlled and uncontrolled modes.
 */
const Dialog: React.FC<DialogProps & React.PropsWithChildren> = ({
    children,
    transition: transitionProp,
    defaultOpen = false,
    open,
    onOpenChange,
}) => {
    const id = useId();
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const isOpen = open !== undefined ? open : internalOpen;

    const setIsOpen = useCallback(
        (value: boolean | ((prev: boolean) => boolean)) => {
            const newValue = typeof value === 'function' ? value(isOpen) : value;

            if (open === undefined) {
                // Only update internal state if not controlled
                setInternalOpen(newValue);
            }

            // Always call onOpenChange if provided
            onOpenChange?.(newValue);
        },
        [isOpen, open, onOpenChange],
    );

    // used to render the data-open attributes before the animation is applied
    const awaitedOpen = useDelay(isOpen, 0);

    const transition = useMemo(() => deepMerge(DEFAULT_TRANSITION, transitionProp), [transitionProp]);

    const animatedOpen = useFnDelay(
        async (delay) => {
            if (!isOpen) await delay(transition.layout.duration * 1000);
            return isOpen;
        },
        [isOpen, transition.layout.duration],
    );

    return (
        <DialogContext.Provider
            value={{
                id,
                dataOpen: isOpen ? (awaitedOpen ?? isOpen) : isOpen,
                presenceOpen: isOpen ? isOpen : (awaitedOpen ?? isOpen),
                setIsOpen,
                transition,
                animatedOpen: animatedOpen ?? isOpen,
            }}
        >
            {children}
        </DialogContext.Provider>
    );
};

type DialogTriggerProps = Omit<HTMLMotionProps<'div'>, 'layoutId' | 'transition'> & React.PropsWithChildren;

const DialogTrigger = React.forwardRef<HTMLDivElement, DialogTriggerProps>(
    ({ children, style, className, whileHover, ...props }, ref) => {
        const { id, transition: transitionDialog, setIsOpen, dataOpen, animatedOpen } = useDialog();

        return (
            <motion.div
                layoutId={`dialog-content-${id}`}
                transition={transitionDialog}
                data-slot="dialog-trigger-anchor"
                data-open={dataOpen}
                className={cn(
                    'group/dialog-trigger cursor-pointer',
                    className,
                    animatedOpen || dataOpen ? 'pointer-events-none' : undefined,
                )}
                style={{
                    ...style,
                    ...createDurationVariables(transitionDialog.layout.duration),
                    zIndex: animatedOpen || dataOpen ? Z_INDEX - 2 : 0,
                }}
                whileHover={animatedOpen || dataOpen ? undefined : whileHover}
                {...props}
                onClick={() => setIsOpen(!dataOpen)}
                ref={ref}
            >
                {children}
            </motion.div>
        );
    },
);

DialogTrigger.displayName = 'DialogTrigger';

export interface DialogLayoutProps {
    /**
     * Required to set the motion `layoutId`.
     */
    layoutId: string;
}

// Context to pass image wrapper layoutId down to images
const DialogImageContext = React.createContext<string | null>(null);
const useDialogImageLayoutId = () => React.useContext(DialogImageContext);

const DialogMotionImageWrapper = React.forwardRef<
    HTMLImageElement,
    Omit<HTMLMotionProps<'div'>, 'id' | 'layoutId'> & DialogLayoutProps
>(({ children, className, layoutId: layoutIdProp, transition, whileHover, ...props }, ref) => {
    const { id, transition: transitionDialog, dataOpen, animatedOpen } = useDialog();

    return (
        <DialogImageContext.Provider value={layoutIdProp}>
            <motion.div
                layoutId={`dialog-image-wrapper-${id}-${layoutIdProp}`}
                transition={{ ...transitionDialog, ...transition }}
                data-slot={'dialog-image-wrapper'}
                data-open={dataOpen}
                className={cn('relative flex h-72 w-full flex-col justify-stretch overflow-hidden', className)}
                whileHover={animatedOpen || dataOpen ? undefined : whileHover}
                {...props}
                ref={ref}
            >
                {children}
            </motion.div>
        </DialogImageContext.Provider>
    );
});

DialogMotionImageWrapper.displayName = 'DialogMotionImageWrapper';

const DialogMotionImage = React.forwardRef<HTMLImageElement, Omit<HTMLMotionProps<'img'>, 'layoutId'>>(
    ({ children, className, whileHover, transition, ...props }, ref) => {
        const { id, transition: transitionDialog, dataOpen, animatedOpen } = useDialog();
        const wrapperLayoutId = useDialogImageLayoutId();

        return (
            <motion.img
                layoutId={`dialog-image-${id}-${wrapperLayoutId}`}
                transition={{ ...transitionDialog, ...transition }}
                data-slot={'dialog-image'}
                data-open={dataOpen}
                rel="preload"
                loading="eager"
                className={cn('absolute inset-0 w-full object-cover', className)}
                whileHover={animatedOpen || dataOpen ? undefined : whileHover}
                {...props}
                ref={ref}
            />
        );
    },
);

DialogMotionImage.displayName = 'DialogMotionImage';

interface DialogContentWrapperProps {
    /**
     * Whether to close the dialog when the content is clicked.
     * @default 'close'
     */
    clickBehaviour?: 'none' | 'close';
}

const DialogContentWrapper: React.FC<
    DialogContentWrapperProps & React.HTMLAttributes<HTMLDivElement> & React.PropsWithChildren
> = ({ clickBehaviour = 'close', children, className: wrapperClassName, style: wrapperStyle, ...wrapper }) => {
    const { transition: transitionDialog, dataOpen, presenceOpen } = useDialog();

    return (
        <AnimatePresence>
            {presenceOpen && (
                <RemoveScroll
                    style={{
                        ...wrapperStyle,
                        ...createDurationVariables(transitionDialog.layout.duration),
                        zIndex: Z_INDEX,
                    }}
                    data-slot="dialog-content-wrapper"
                    role="dialog"
                    data-open={dataOpen}
                    className={cn(
                        'group/dialog pointer-events-none fixed inset-0 flex h-screen w-screen overflow-auto overscroll-auto p-8',
                        wrapperClassName,
                    )}
                    {...wrapper}
                >
                    {children}
                </RemoveScroll>
            )}
        </AnimatePresence>
    );
};

interface DialogContentLayoutIdProps {
    /**
     * Whether to close the dialog when the content is clicked.
     * @default 'close'
     */
    clickBehaviour?: 'none' | 'close';
}

const DialogContentLayoutId: React.FC<
    DialogContentLayoutIdProps & Omit<HTMLMotionProps<'div'>, 'layoutId'> & React.PropsWithChildren
> = ({ clickBehaviour = 'close', children, transition, className, ...props }) => {
    const { id, transition: transitionDialog, dataOpen, setIsOpen } = useDialog();

    const handleClick = useCallback(() => {
        if (clickBehaviour === 'close') {
            setIsOpen(false);
        }
    }, [clickBehaviour, setIsOpen]);

    return (
        <motion.div
            layoutId={`dialog-content-${id}`}
            transition={{ ...transitionDialog, ...transition }}
            data-slot="dialog-content"
            data-open={dataOpen}
            className={cn(
                'pointer-events-auto m-auto max-w-[96vw] overflow-hidden rounded-2xl border shadow-2xl',
                clickBehaviour === 'close' ? 'cursor-pointer' : 'cursor-default',
                className,
            )}
            onClick={handleClick}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export type DialogContentProps = {
    /**
     * Whether to close the dialog when the content is clicked.
     * @default 'close'
     */
    clickBehaviour?: 'none' | 'close';
    /**
     * The wrapper props for the dialog content.
     */
    wrapper?: React.HTMLAttributes<HTMLDivElement>;
};

const DialogContent: React.FC<
    DialogContentProps & Omit<HTMLMotionProps<'div'>, 'layoutId'> & React.PropsWithChildren
> = ({ children, wrapper = {}, ...props }) => {
    return (
        <DialogContentWrapper {...wrapper}>
            <DialogContentLayoutId {...props}>{children}</DialogContentLayoutId>
        </DialogContentWrapper>
    );
};

DialogContent.displayName = 'DialogContent';

const DialogMotionDiv = React.forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
    ({ children, layoutId: layoutIdProp, transition, whileHover, ...props }, ref) => {
        const { id, transition: transitionDialog, dataOpen, animatedOpen } = useDialog();

        return (
            <motion.div
                layoutId={layoutIdProp ? `motion-div-${id}-${layoutIdProp}` : undefined}
                transition={deepMerge(transitionDialog, transition)}
                data-slot={'motion-div'}
                data-open={dataOpen}
                whileHover={animatedOpen || dataOpen ? undefined : whileHover}
                {...props}
                ref={ref}
            >
                {children}
            </motion.div>
        );
    },
);

DialogMotionDiv.displayName = 'DialogMotionDiv';

export interface DialogAnimatePresenceDivProps {
    /**
     * The div will only be happend to the react tree once the dialog animation is complete.
     */
    onceOpen?: boolean;
    /**
     * When `onceOpen` is true, the delay factor will be used to alter the delay time, by multiplying the delay time by the delay factor.
     * @default 1
     */
    delayFactor?: number;
    /**
     * Allow to alter the duration time according to the context duration value of the dialog.
     * Will overwrite your transition duration value if you have set one.
     *
     * @default 0.5
     */
    durationFactor?: number;
}

const DialogAnimatePresenceDiv = React.forwardRef<
    HTMLDivElement,
    DialogAnimatePresenceDivProps & HTMLMotionProps<'div'>
>(({ transition: transitionProp, children, onceOpen, delayFactor = 1, durationFactor = 0.5, ...props }, ref) => {
    const { transition: transitionDialog, dataOpen } = useDialog();

    const innerOpen = useFnDelay(
        async (delay) => {
            if (dataOpen) {
                const delayTime = onceOpen
                    ? (transitionProp?.duration ?? transitionDialog.duration) * 1000 * delayFactor
                    : 0;
                await delay(delayTime);
            }
            return dataOpen;
        },
        [dataOpen, transitionProp?.duration, transitionDialog.duration, delayFactor, onceOpen],
    );

    return (
        <AnimatePresence>
            {innerOpen && (
                <DialogMotionDiv
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                        ...transitionProp,
                        ...(durationFactor
                            ? {
                                  duration: transitionDialog.duration * durationFactor,
                                  layout: {
                                      duration: transitionDialog.layout.duration * durationFactor,
                                  },
                              }
                            : {}),
                    }}
                    ref={ref}
                    {...props}
                >
                    {children}
                </DialogMotionDiv>
            )}
        </AnimatePresence>
    );
});

DialogAnimatePresenceDiv.displayName = 'DialogAnimatePresenceDiv';

const DialogOverlay = React.forwardRef<HTMLDivElement, Omit<HTMLMotionProps<'div'>, 'layoutId'>>(
    ({ transition, style, ...props }, ref) => {
        const { transition: transitionDialog, setIsOpen, presenceOpen } = useDialog();

        return (
            <AnimatePresence>
                {presenceOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{
                            opacity: 1,
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ ...transitionDialog, ...transition }}
                        className="fixed inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50"
                        data-slot="dialog-overlay"
                        style={{
                            ...style,
                            zIndex: Z_INDEX - 1,
                        }}
                        onClick={() => setIsOpen(false)}
                        ref={ref}
                        {...props}
                    />
                )}
            </AnimatePresence>
        );
    },
);

const DialogPortal = Portal;

const DialogClose = React.forwardRef<HTMLButtonElement, HTMLMotionProps<'button'>>(
    ({ children, className, ...props }, ref) => {
        const { setIsOpen } = useDialog();
        return (
            <motion.button
                ref={ref}
                {...props}
                onClick={() => setIsOpen(false)}
                className={cn(
                    'bg-muted/50 hover:bg-muted absolute top-4 right-4 z-50 flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors',
                    className,
                )}
            >
                {children ?? <Icon name="X" className="text-accent-foreground size-7" />}
            </motion.button>
        );
    },
);
DialogClose.displayName = 'DialogClose';

export {
    Dialog,
    DialogAnimatePresenceDiv,
    DialogClose,
    DialogContent,
    DialogContentLayoutId,
    DialogContentWrapper,
    DialogMotionDiv,
    DialogMotionImage,
    DialogMotionImageWrapper,
    DialogOverlay,
    DialogPortal,
    DialogTrigger,
    useDialog,
};
