'use client';

import { MotionValue, motion, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';
import { CONVEX, calculateRefractionSpecular, getDisplacementData, getValueOrMotion } from './liquid-lib';

// function getBezier (bezelType: "convex_circle" | "convex_squircle" | "concave" | "lip") {
//   let surfaceFn;
//   switch (bezelType) {
//     case "convex_circle":
//       surfaceFn = CONVEX_CIRCLE.fn;
//       break;
//     case "convex_squircle":
//       surfaceFn = CONVEX.fn;
//       break;
//     case "concave":
//       surfaceFn = CONCAVE.fn;
//       break;
//     case "lip":
//       surfaceFn = LIP.fn;
//       break;
//     default:
//       surfaceFn = CONVEX.fn;
//   }
//   return surfaceFn;
// }

function imageDataToUrl(imageData: ImageData): string {
    if (typeof document === 'undefined') {
        return '';
    }

    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
}

export type LiquidFilterProps = {
    id: string;
    filterOnly?: boolean;
    scaleRatio?: MotionValue<number>;
    canvasWidth?: number | MotionValue<number>;
    canvasHeight?: number | MotionValue<number>;
    width: number | MotionValue<number>;
    height: number | MotionValue<number>;
    radius: number | MotionValue<number>;
    /**
     * SVG Gauss gradient applied
     * @default 0.2
     */
    blur?: number | MotionValue<number>;
    /**
     * Glass tickess.
     * Bigger this value is, longer will be the translations.
     * @default 40
     */
    glassThickness?: number | MotionValue<number>;
    /**
     * Width of the non-flat glass surface at the boundaries.
     * @default 20
     */
    bezelWidth?: number | MotionValue<number>;
    /**
     * Value used in the snell law: n1 sin(θ1) = n2 sin(θ2)
     * Water is 1.33
     *
     * @default 1.5
     */
    refractiveIndex?: number | MotionValue<number>;
    /**
     * Opacity of the border
     * @default 0.4
     */
    specularOpacity?: number | MotionValue<number>;
    /**
     * @default 4
     */
    specularSaturation?: number | MotionValue<number>;
    dpr?: number | MotionValue<number>;
    /**
     * Set the profile of the edges.
     * @default CONVEX.fn
     */
    bezelHeightFn?: (x: number) => number;
    // bezelType?: 'convex_circle' | 'convex_squircle' | 'concave' | 'lip';
};

export const LiquidFilter: React.FC<LiquidFilterProps> = ({
    id,
    filterOnly = false,
    canvasWidth,
    canvasHeight,
    width,
    height,
    radius,
    blur = 0.2,
    glassThickness = 40,
    bezelWidth: bezelWidthProp = 20,
    refractiveIndex = 1.5,
    scaleRatio,
    specularOpacity = 1,
    specularSaturation = 4,
    bezelHeightFn = CONVEX.fn,
    dpr,
}) => {
    // Hydration fix: only render on client to avoid SSR/client mismatch with dynamic canvas data
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const displacementData = useTransform(() => {
        const canvasW = canvasWidth ? getValueOrMotion(canvasWidth) : getValueOrMotion(width);
        const canvasH = canvasHeight ? getValueOrMotion(canvasHeight) : getValueOrMotion(height);
        const devicePixelRatio = dpr ? getValueOrMotion(dpr) : 1;
        const clampedBezelWidth = Math.max(
            Math.min(getValueOrMotion(bezelWidthProp), 2 * getValueOrMotion(radius) - 1),
            0,
        );

        return getDisplacementData({
            glassThickness: getValueOrMotion(glassThickness),
            bezelWidth: clampedBezelWidth,
            bezelHeightFn,
            refractiveIndex: getValueOrMotion(refractiveIndex),
            canvasWidth: canvasW,
            canvasHeight: canvasH,
            objectWidth: getValueOrMotion(width),
            objectHeight: getValueOrMotion(height),
            radius: getValueOrMotion(radius),
            dpr: devicePixelRatio,
        });
    });

    const specularLayer = useTransform(() => {
        const devicePixelRatio = dpr ? getValueOrMotion(dpr) : 1;

        return calculateRefractionSpecular(
            getValueOrMotion(width),
            getValueOrMotion(height),
            getValueOrMotion(radius),
            50,
            undefined,
            devicePixelRatio,
        );
    });

    const displacementMapDataUrl = useTransform(() => {
        return imageDataToUrl(displacementData.get().displacementMap);
    });
    const specularLayerDataUrl = useTransform(() => {
        return imageDataToUrl(specularLayer.get());
    });
    const scale = useTransform(() => displacementData.get().maximumDisplacement * (scaleRatio?.get() ?? 1));

    const content = (
        <filter id={id}>
            <motion.feGaussianBlur
                in={'SourceGraphic'}
                stdDeviation={typeof blur === 'object' && 'get' in blur ? blur : useTransform(() => blur as number)}
                result="blurred_source"
            />

            <motion.feImage
                href={displacementMapDataUrl}
                x={0}
                y={0}
                width={useTransform(() => (canvasWidth ? getValueOrMotion(canvasWidth) : getValueOrMotion(width)))}
                height={useTransform(() => (canvasHeight ? getValueOrMotion(canvasHeight) : getValueOrMotion(height)))}
                result="displacement_map"
            />

            <motion.feDisplacementMap
                in="blurred_source"
                in2="displacement_map"
                scale={scale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="displaced"
            />

            <motion.feColorMatrix
                in="displaced"
                type="saturate"
                values={useTransform(() => getValueOrMotion(specularSaturation).toString()) as any}
                result="displaced_saturated"
            />

            <motion.feImage
                href={specularLayerDataUrl}
                x={0}
                y={0}
                width={useTransform(() => (canvasWidth ? getValueOrMotion(canvasWidth) : getValueOrMotion(width)))}
                height={useTransform(() => (canvasHeight ? getValueOrMotion(canvasHeight) : getValueOrMotion(height)))}
                result="specular_layer"
            />

            <feComposite in="displaced_saturated" in2="specular_layer" operator="in" result="specular_saturated" />

            <feComponentTransfer in="specular_layer" result="specular_faded">
                <motion.feFuncA type="linear" slope={useTransform(() => getValueOrMotion(specularOpacity))} />
            </feComponentTransfer>

            <motion.feBlend in="specular_saturated" in2="displaced" mode="normal" result="withSaturation" />
            <motion.feBlend in="specular_faded" in2="withSaturation" mode="normal" />
        </filter>
    );

    // Return null during SSR to prevent hydration mismatch
    if (!isMounted) {
        return null;
    }

    return filterOnly ? (
        content
    ) : (
        <svg colorInterpolationFilters="sRGB" style={{ display: 'none' }}>
            <defs>{content}</defs>
        </svg>
    );
};
