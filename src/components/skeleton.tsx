import { cn } from '@kit/utils';

export interface SkeletonProps {
    /**
     * Disable the shimmer animation.
     *
     * @default false
     */
    noShimmer?: boolean;
    /**
     * Display an animated shimmer border.
     *
     * @default false
     */
    shimmerBorder?: boolean;
    /**
     * Used by the extra wrapper added when `shimmerBorder` is true
     */
    shimmerBorderClassName?: string;
}

function Skeleton({
    className,
    noShimmer = false,
    shimmerBorder = false,
    shimmerBorderClassName = '',
    style: styleProps,
    ...props
}: SkeletonProps & React.ComponentProps<'div'>) {
    const { animationDelay } = styleProps || {};

    const content = (
        <div
            data-slot="skeleton"
            className={cn(
                'bg-accent rounded-md',
                noShimmer
                    ? 'animate-pulse'
                    : 'animate-shimmer shimmer-with-pulse [--shimmer-color:color-mix(in_oklab,var(--color-opposite)_8%,transparent_100%)] dark:[--shimmer-color:color-mix(in_oklab,var(--color-opposite)_3%,transparent_100%)]',
                className,
            )}
            aria-label="Loading"
            style={styleProps}
            {...props}
        />
    );

    return shimmerBorder && !noShimmer ? (
        <div
            className={cn(
                'animate-shimmer rounded-[9px] p-px [--shimmer-color:color-mix(in_oklab,var(--color-opposite)_40%,transparent_100%)]',
                shimmerBorderClassName,
            )}
            style={{ animationDelay }}
        >
            <div className="bg-background rounded-md">{content}</div>
        </div>
    ) : (
        content
    );
}

export { Skeleton };
