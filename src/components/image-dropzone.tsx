import { Button } from '@kit/ui/button';
import { Icon } from '@kit/ui/icon';
import { cn } from '@kit/utils';
import React, { useCallback, useMemo } from 'react';
import { type DropEvent, type DropzoneOptions, type FileRejection, useDropzone } from 'react-dropzone';

export interface ImageDropzoneProps {
    title?: string;
    subtitle?: string;
    src?: string;
    borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
    className?: string;
    onDrop?: (acceptedFiles: File[], fileRejections: FileRejection[], event: DropEvent) => void;
    onError?: (error: Error) => void;
    children?: React.ReactNode;
}

export const ImageDropzone: React.FC<ImageDropzoneProps & Omit<DropzoneOptions, 'onDrop' | 'onError'>> = ({
    accept,
    maxFiles = 1,
    maxSize,
    minSize,
    onDrop,
    onError,
    disabled,
    title = 'Upload image',
    subtitle = 'Drag & drop or click to select',
    src,
    borderRadius = 'none',
    className,
    children,
    ...dropzoneProps
}) => {
    const dropzoneOptions: DropzoneOptions = useMemo(
        () => ({
            accept,
            maxFiles,
            maxSize,
            minSize,
            onDrop: (acceptedFiles, fileRejections, event) => {
                if (fileRejections.length > 0) {
                    onError?.(new Error(`File rejected: ${fileRejections[0]?.errors[0]?.message ?? ''}`));
                } else {
                    onDrop?.(acceptedFiles, fileRejections, event);
                }
            },
            disabled,
            ...dropzoneProps,
        }),
        [accept, maxFiles, maxSize, minSize, onDrop, onError, disabled, dropzoneProps],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

    const borderRadiusClass = useMemo(
        () =>
            ({
                none: '',
                sm: 'rounded-xs',
                md: 'rounded-md',
                lg: 'rounded-lg',
                xl: 'rounded-xl',
                '2xl': 'rounded-2xl',
                '3xl': 'rounded-3xl',
                full: 'rounded-full',
            })[borderRadius],
        [borderRadius],
    );

    const renderContent = useCallback(() => {
        if (!src) {
            return (
                children || (
                    <>
                        <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full">
                            <Icon name="Upload" className="size-5 shrink-0" />
                        </div>
                        <p className="mt-2 text-sm font-medium">{title}</p>
                        <p className="text-muted-foreground text-xs">{subtitle}</p>
                    </>
                )
            );
        }

        return (
            <img
                src={src}
                alt={title}
                className={cn('size-full max-h-full max-w-full object-cover', borderRadiusClass)}
            />
        );
    }, [src, children, title, subtitle, borderRadiusClass]);

    return (
        <Button
            type="button"
            disabled={disabled}
            variant="outline"
            className={cn(
                'hover:border-primary hover:bg-accent flex h-fit w-full flex-col items-center justify-center border-dashed',
                borderRadiusClass,
                src ? 'p-0.5' : 'px-0 py-3',
                isDragActive && 'border-primary',
                className,
            )}
            {...getRootProps()}
        >
            <input {...getInputProps()} />
            {renderContent()}
        </Button>
    );
};
