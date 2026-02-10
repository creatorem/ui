'use client';

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogPortal,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { useZodForm } from '@kit/utils/hooks/use-zod-form';
import { Slot } from '@radix-ui/react-slot';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

type ConfirmationOperationType = {
    type: 'write';
    value: string;
};

interface TextConfirmationFormProps {
    confirmation: string;
    isValid: (valid: boolean) => void;
    onSubmit: (e: React.MouseEvent) => void;
}

const TextConfirmationForm: React.FC<TextConfirmationFormProps> = ({ confirmation, isValid, onSubmit }) => {
    // Create validation schema based on the confirmation text
    const formSchema = useMemo(
        () =>
            z.object({
                confirmation: z.literal(confirmation, {
                    errorMap: () => ({ message: `Confirmation text must be "${confirmation}"` }),
                }),
            }),
        [confirmation],
    );

    type FormValues = z.infer<typeof formSchema>;

    const form = useZodForm({
        schema: formSchema,
        defaultValues: {
            confirmation: '',
        },
        mode: 'onChange',
    });

    // Update parent component about validity when form state changes
    useEffect(() => {
        isValid(form.formState.isValid);
    }, [form.formState.isValid, isValid]);

    const handleSubmit = (data: FormValues) => {
        // Form is valid if we get here
        isValid(true);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-2">
                <FormField
                    control={form.control}
                    name="confirmation"
                    render={({ field }) => (
                        <FormItem>
                            <Label>Type &quot;{confirmation}&quot; to confirm</Label>
                            <FormControl>
                                <Input placeholder={confirmation} autoComplete="off" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive text-sm font-medium" />
                        </FormItem>
                    )}
                />
            </form>
        </Form>
    );
};

// we suppose that the delete button will always be on top of the page
const Z_INDEX = 999999999999;

export type ConfirmationHeader =
    | React.ReactNode
    | string
    | {
          title: string | React.ReactNode;
          description?: string | React.ReactNode;
      };

export interface ConfirmationButtonLabels {
    /**
     * @default 'Cancel'
     */
    cancel?: string;
    /**
     * @default 'Confirm'
     */
    confirm?: string;
}

export type ConfirmationTemplate = 'delete';

const CONFIRMATION_TEMPLATES: Record<
    ConfirmationTemplate,
    {
        header: ConfirmationHeader;
        content?: string | React.ReactNode;
        buttonLabels: ConfirmationButtonLabels;
    }
> = {
    delete: {
        header: {
            title: 'Delete Item',
            description: 'Are you sure you want to delete this item? This action cannot be undone.',
        },
        buttonLabels: {
            cancel: 'Cancel',
            confirm: 'Delete',
        },
    },
};

export interface ConfirmButtonProps {
    /**
     * @default false
     */
    asChild?: boolean;
    /**
     * The function to call when the confirmation is successful.
     * @param e - The `React.MouseEvent` event object.
     */
    onConfirmation: (e: React.MouseEvent) => void;
    /**
     * Use a premade template to prefill all your labels.
     */
    template?: ConfirmationTemplate;
    /**
     * The header of the alert dialog.
     * Can be :
     *  - a JSX element
     *  - a string (the title alone)
     *  - an object with title and an optional description
     */
    header?: ConfirmationHeader;
    /**
     * The content of the alert dialog.
     * You can pass a simple string or JSX.
     */
    content?: string | React.ReactNode;
    /**
     * The operation to perform when the confirmation is successful.
     * For now only supports "write" operations.
     *
     * @example
     * {
     *     type: 'write',
     *     value: 'Delete XXX XXX account',
     * }
     */
    operation?: ConfirmationOperationType;
    /**
     * The labels for the buttons.
     */
    buttonLabels?: ConfirmationButtonLabels;
    confirmButtonProps?: Omit<React.ComponentPropsWithoutRef<typeof Button>, 'children' | 'aria-label' | 'content'>;
}

export const ConfirmButton = React.forwardRef<
    React.ComponentRef<typeof Button>,
    Omit<React.ComponentPropsWithoutRef<typeof Button>, 'content'> & ConfirmButtonProps
>(
    (
        {
            children,
            asChild,
            onBlur,
            onConfirmation,
            operation,
            template: templatekey,
            content: contentProp,
            header: headerProp,
            buttonLabels: buttonLabelsProp = {
                cancel: 'Cancel',
                confirm: 'Confirm',
            },
            confirmButtonProps,
            ...buttonProps
        },
        ref,
    ) => {
        const templateData = useMemo(() => (templatekey ? CONFIRMATION_TEMPLATES[templatekey] : null), [templatekey]);
        const header = useMemo(() => headerProp ?? templateData?.header, [headerProp, templateData]);
        const content = useMemo(() => contentProp ?? templateData?.content, [contentProp, templateData]);
        const buttonCancelLabel = useMemo(
            () => buttonLabelsProp.cancel ?? templateData?.buttonLabels.cancel ?? 'Cancel',
            [buttonLabelsProp.cancel, templateData?.buttonLabels.cancel],
        );
        const buttonConfirmLabel = useMemo(
            () => buttonLabelsProp.confirm ?? templateData?.buttonLabels.confirm ?? 'Confirm',
            [buttonLabelsProp.confirm, templateData?.buttonLabels.confirm],
        );

        const [open, setOpen] = useState(false);
        const [isValidConfirmation, setIsValidConfirmation] = useState(!operation);

        const openAlertDialog = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(true);
            },
            [setOpen],
        );

        const handleCancellation = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
            },
            [setOpen],
        );

        const handleDeletion = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                if (isValidConfirmation) {
                    onConfirmation(e);
                    setOpen(false);
                }
            },
            [isValidConfirmation, onConfirmation],
        );

        const preventPropagation = useCallback((e: React.MouseEvent) => {
            e.stopPropagation();
        }, []);

        const headerNode = useMemo(() => {
            if (!header) return null;

            if (React.isValidElement(header)) {
                return header;
            }

            if (typeof header === 'string') {
                return (
                    <AlertDialogHeader className="space-y-2">
                        <AlertDialogTitle className="text-lg font-semibold">{header}</AlertDialogTitle>
                    </AlertDialogHeader>
                );
            }

            if (typeof header === 'object' && 'title' in header) {
                return (
                    <AlertDialogHeader className="space-y-2">
                        <AlertDialogTitle className="text-lg font-semibold">{header.title}</AlertDialogTitle>
                        {header.description ? (
                            <AlertDialogDescription className="text-muted-foreground">
                                {header.description}
                            </AlertDialogDescription>
                        ) : null}
                    </AlertDialogHeader>
                );
            }

            return null;
        }, [header]);

        const Comp = asChild ? Slot : Button;

        return (
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogTrigger asChild>
                    <Comp type="button" ref={ref} onClick={openAlertDialog} {...buttonProps}>
                        {children}
                    </Comp>
                </AlertDialogTrigger>
                <AlertDialogPortal>
                    <AlertDialogContent
                        overlay={{ style: { zIndex: Z_INDEX } }}
                        onClick={preventPropagation}
                        className={'gap-4'}
                        style={{ zIndex: Z_INDEX + 1 }}
                    >
                        {headerNode}

                        {typeof content === 'string' ? (
                            <p className="text-muted-foreground text-sm">{content}</p>
                        ) : (
                            content
                        )}

                        {operation?.type === 'write' && (
                            <div className="py-4">
                                <TextConfirmationForm
                                    confirmation={operation.value}
                                    isValid={setIsValidConfirmation}
                                    onSubmit={handleDeletion}
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-x-4">
                            <Button
                                aria-label={buttonCancelLabel ?? 'Cancel'}
                                variant="outline"
                                size="sm"
                                onClick={handleCancellation}
                            >
                                {buttonCancelLabel}
                            </Button>
                            <Button
                                aria-label={buttonConfirmLabel ?? 'Confirm'}
                                autoFocus
                                variant={templatekey === 'delete' ? 'destructive' : 'default'}
                                size="sm"
                                type="submit"
                                onClick={handleDeletion}
                                disabled={!isValidConfirmation || buttonProps.disabled}
                                {...confirmButtonProps}
                            >
                                {buttonConfirmLabel}
                            </Button>
                        </div>
                    </AlertDialogContent>
                </AlertDialogPortal>
            </AlertDialog>
        );
    },
);
ConfirmButton.displayName = 'ConfirmButton';
