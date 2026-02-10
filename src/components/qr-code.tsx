'use client';

import { Button } from '@kit/ui/button';
import { Icon } from '@kit/ui/icon';
import { cn } from '@kit/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import QRCodeLib from 'qrcode';
import React, { createContext, useCallback, useContext, useMemo } from 'react';

// Generate QR matrix using the `qrcode` dependency
const generateQRMatrix = (text: string, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'): boolean[][] => {
    try {
        const qr = QRCodeLib.create(text, { errorCorrectionLevel });
        const size: number = qr.modules.size;
        const data: Array<boolean | 0 | 1> = qr.modules.data as any;

        const matrix: boolean[][] = new Array(size)
            .fill(false)
            .map((_, row) => new Array(size).fill(false).map((__, col) => Boolean(data[row * size + col])));

        return matrix;
    } catch (e) {
        // Fallback to empty matrix on error
        return [];
    }
};

interface QRCodeContextType {
    value: string;
    matrix: boolean[][];
    size: number;
    errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
}

const QRCodeContext = createContext<QRCodeContextType | null>(null);

const useQRCode = () => {
    const context = useContext(QRCodeContext);
    if (!context) {
        throw new Error('QR Code components must be used within QRCodeRoot');
    }
    return context;
};

export interface QRCodeRootProps {
    /**
     * For composition, for more information see [Radix Slot](https://www.radix-ui.com/primitives/docs/utilities/slot)
     *
     * @default false
     */
    asChild?: boolean;
    /**
     * The value of the QR code.
     */
    value?: string;
    defaultValue?: string;
    /**
     * The error correction level of the QR code.
     * @default 'M'
     */
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    /**
     * Size of each pixel of the QR code.
     * @default 4
     */
    pixelSize?: number;
}

const QRCodeRoot: React.FC<QRCodeRootProps & React.HTMLAttributes<HTMLDivElement>> = ({
    asChild = false,
    value,
    defaultValue = '',
    errorCorrectionLevel = 'M',
    pixelSize = 4,
    children,
    ...props
}) => {
    const qrValue = value ?? defaultValue;

    const matrix = useMemo(() => {
        if (!qrValue) return [];
        return generateQRMatrix(qrValue, errorCorrectionLevel);
    }, [qrValue, errorCorrectionLevel]);

    const contextValue = useMemo(
        () => ({
            value: qrValue,
            matrix,
            size: matrix.length,
            errorCorrectionLevel,
        }),
        [qrValue, matrix, errorCorrectionLevel],
    );

    return <QRCodeContext.Provider value={contextValue}>{children}</QRCodeContext.Provider>;
};
QRCodeRoot.displayName = 'QRCodeRoot';

export interface QRCodeFrameProps {
    /**
     * @default false
     */
    asChild?: boolean;
}

const QRCodeFrame = React.forwardRef<HTMLDivElement, QRCodeFrameProps & React.HTMLAttributes<HTMLDivElement>>(
    ({ asChild = false, className, children, ...props }, ref) => {
        const Comp = asChild ? Slot : 'div';

        return (
            <Comp
                ref={ref}
                className={cn(
                    'relative inline-block aspect-square size-full border-8 border-white bg-white shadow-sm',
                    className,
                )}
                {...props}
            >
                {children}
            </Comp>
        );
    },
);
QRCodeFrame.displayName = 'QRCodeFrame';

const QRCodePattern = React.forwardRef<SVGSVGElement, Omit<React.SVGAttributes<SVGSVGElement>, 'children'>>(
    ({ className, ...props }, ref) => {
        const { matrix, size } = useQRCode();

        if (!matrix.length) return null;

        return (
            <svg
                ref={ref}
                className={cn('block aspect-square size-full', className)}
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                {...props}
            >
                {matrix.map((row, y) =>
                    row.map((filled, x) =>
                        filled ? (
                            <rect
                                key={`${y}-${x}`}
                                x={x}
                                y={y}
                                width={1}
                                height={1}
                                fill="currentColor"
                                className="text-black"
                            />
                        ) : null,
                    ),
                )}
            </svg>
        );
    },
);

QRCodePattern.displayName = 'QRCodePattern';

const qrCodeOverlayVariants = cva(
    'absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-lg',
    {
        variants: {
            size: {
                xs: 'size-5 [&>img]:size-4 [&>svg]:size-4',
                sm: 'size-7 [&>img]:size-5 [&>svg]:size-5',
                md: 'size-9 [&>img]:size-7 [&>svg]:size-7',
                lg: 'size-12 [&>img]:size-10 [&>svg]:size-10',
                xl: 'size-14 [&>img]:size-12 [&>svg]:size-12',
            },
        },
        defaultVariants: {
            size: 'md',
        },
    },
);

export interface QRCodeOverlayProps {
    /**
     * @default false
     */
    asChild?: boolean;
    /**
     * The size of the QR code overlay.
     * @default 'md'
     */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const QRCodeOverlay = React.forwardRef<HTMLDivElement, QRCodeOverlayProps & React.HTMLAttributes<HTMLDivElement>>(
    ({ asChild = false, size = 'md', className, children, ...props }, ref) => {
        const Comp = asChild ? Slot : 'div';

        return (
            <Comp ref={ref} className={cn(qrCodeOverlayVariants({ size }), className)} {...props}>
                {children}
            </Comp>
        );
    },
);
QRCodeOverlay.displayName = 'QRCodeOverlay';

export interface QRCodeDownloadTriggerProps {
    /**
     * For composition, for more information see [Radix Slot](https://www.radix-ui.com/primitives/docs/utilities/slot)
     *
     * @default false
     */
    asChild?: boolean;
    /**
     * The file name of the QR code.
     * @default 'qr-code.png'
     */
    fileName?: string;
    /**
     * The mime type of the QR code.
     * @default 'image/png'
     */
    mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
    /**
     * The quality of the QR code.
     * @default 1
     */
    quality?: number;
}

const QRCodeDownloadTrigger = React.forwardRef<
    HTMLButtonElement,
    QRCodeDownloadTriggerProps & Omit<React.ComponentPropsWithoutRef<typeof Button>, 'aria-label'>
>(
    (
        {
            asChild = false,
            fileName = 'qr-code.png',
            mimeType = 'image/png',
            quality = 1,
            onClick,
            className,
            children,
            ...props
        },
        ref,
    ) => {
        const { matrix, size } = useQRCode();
        const Comp = asChild ? Slot : Button;

        const handleDownload = useCallback(
            async (event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();

                if (!matrix.length) return;

                // Create a canvas to generate the image
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                const pixelSize = 8; // Higher resolution for download
                canvas.width = size * pixelSize;
                canvas.height = size * pixelSize;

                // Fill background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Draw QR pattern
                ctx.fillStyle = 'black';
                matrix.forEach((row, y) => {
                    row.forEach((filled, x) => {
                        if (filled) {
                            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                        }
                    });
                });

                // Convert to blob and download
                canvas.toBlob(
                    (blob) => {
                        if (!blob) return;

                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = fileName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    },
                    mimeType,
                    quality,
                );

                onClick?.(event);
            },
            [matrix, size, fileName, mimeType, quality, onClick],
        );

        return (
            <Comp
                ref={ref}
                onClick={handleDownload}
                aria-label="Download QR Code"
                className={cn('w-full', className)}
                {...props}
            >
                {children ?? (
                    <>
                        <Icon name="Download" className="size-4" />
                        Download
                    </>
                )}
            </Comp>
        );
    },
);
QRCodeDownloadTrigger.displayName = 'QRCodeDownloadTrigger';

export { QRCodeRoot as QRCode, QRCodeDownloadTrigger, QRCodeFrame, QRCodeOverlay, QRCodePattern };
