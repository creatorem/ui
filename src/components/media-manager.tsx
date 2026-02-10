'use client';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@kit/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@kit/ui/empty';
import { Label } from '@kit/ui/label';
import { ScrollArea } from '@kit/ui/scroll-area';
import { Skeleton } from '@kit/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '@kit/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Textarea } from '@kit/ui/textarea';
import { VisuallyHidden } from '@kit/ui/visually-hidden';
import { cn, truncate } from '@kit/utils';
import { formatTimeDifference } from '@kit/utils/www';
import type { FileObject } from '@supabase/storage-js';
import { useMutation } from '@tanstack/react-query';
import { isEqual, upperCase } from 'lodash';
import Image from 'next/image';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '../icon';
import { Clipboard } from './clipboard';
import { ConfirmButton } from './confirm-button';
import { FileInput, SORTED_SUPPORTED_FORMATS } from './file-upload';
import { Spinner } from './spinner';
import { Muted } from './text';

// Extended FileObject type to include metadata
export type ExtendedFileObject = Omit<FileObject, 'buckets' | 'metadata'> & {
    user_metadata?: {
        alternativeText?: string;
        [key: string]: any;
    };
};

// Utility type for determining value type based on multiple and isUrl
type MediaValue<TMultiple extends boolean, TIsUrl extends boolean> = TIsUrl extends true
    ? TMultiple extends true
        ? string[]
        : string | null
    : TMultiple extends true
      ? ExtendedFileObject[]
      : ExtendedFileObject | null;

type MediaManagerContextType<TMultiple extends boolean, TIsUrl extends boolean> = {
    value: MediaValue<TMultiple, TIsUrl>;
    onValueChange: (value: MediaValue<TMultiple, TIsUrl>) => void;
    path: string[];
    medias: ExtendedFileObject[];
    setPath: (path: string[]) => void;
    onPathChange: (path: string[]) => void;
    onDelete: (config: { path: string[]; media: ExtendedFileObject }) => Promise<void>;
    onUpdate: (config: { alternativeText: string; path: string[]; media: ExtendedFileObject }) => Promise<{
        alternativeText: string;
    }>;
    onUpload: (config: { file: File; path: string[] }) => Promise<{
        data: ExtendedFileObject;
        error: any;
    }>;
    disabled: boolean;
    setDisabled: (disabled: boolean) => void;
    multiple: TMultiple;
    isUrl: TIsUrl;
    formatType: keyof typeof SORTED_SUPPORTED_FORMATS;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    getUrl: (media: ExtendedFileObject, path: string[]) => string;
    onMediaUpdate?: (media: ExtendedFileObject) => void;
};

const mediaManagerContext = createContext<MediaManagerContextType<boolean, boolean> | null>(null);

export const useMediaManager = <TMultiple extends boolean = boolean, TIsUrl extends boolean = boolean>() => {
    const context = useContext(mediaManagerContext);
    if (!context) {
        throw new Error('useMediaManager must be used within a MediaManager');
    }
    return context as MediaManagerContextType<TMultiple, TIsUrl>;
};

export interface MediaManagerProps<TMultiple extends boolean, TIsUrl extends boolean> {
    rootPath: string[];
    medias: ExtendedFileObject[];
    onPathChange: (path: string[]) => void;
    getUrl: MediaManagerContextType<TMultiple, TIsUrl>['getUrl'];
}

function MediaManager<TMultiple extends boolean, TIsUrl extends boolean>({
    children,
    rootPath,
    onUpdate,
    onDelete,
    onUpload,
    onValueChange = (value: MediaValue<TMultiple, TIsUrl>) => {},
    onMediaUpdate,
    medias,
    onPathChange,
    getUrl,
    value,
    multiple = false as TMultiple,
    isUrl = false as TIsUrl,
    disabled: disabledProp = false,
    formatType: formatTypeProp = 'image',
}: MediaManagerProps<TMultiple, TIsUrl> &
    Partial<
        Pick<
            MediaManagerContextType<TMultiple, TIsUrl>,
            | 'onDelete'
            | 'onUpdate'
            | 'onUpload'
            | 'disabled'
            | 'multiple'
            | 'isUrl'
            | 'formatType'
            | 'onValueChange'
            | 'onMediaUpdate'
            | 'value'
        >
    > &
    React.PropsWithChildren) {
    const [isOpen, setIsOpen] = useState(false);
    const [path, setPath] = useState<string[]>(rootPath);
    const [disabled, setDisabled] = useState(disabledProp);

    useEffect(() => {
        setDisabled(disabledProp);
    }, [disabledProp]);

    const handlePathChange = useCallback(
        (path: string[]) => {
            setPath(path);
            onPathChange(path);
        },
        [onPathChange],
    );

    return (
        <mediaManagerContext.Provider
            value={{
                onValueChange: onValueChange as MediaManagerContextType<boolean, boolean>['onValueChange'],
                medias,
                onPathChange: handlePathChange,
                isOpen,
                setIsOpen,
                path,
                setPath,
                onUpdate: onUpdate ?? (() => Promise.resolve({ alternativeText: '' })),
                onDelete: onDelete ?? (() => Promise.resolve()),
                onUpload:
                    onUpload ??
                    (async ({ file, path }: { file: File; path: string[] }) => {
                        throw new Error('Upload not implemented');
                    }),
                onMediaUpdate,
                disabled,
                setDisabled,
                multiple: multiple as boolean,
                isUrl: isUrl as boolean,
                formatType: formatTypeProp,
                value: value as MediaManagerContextType<boolean, boolean>['value'],
                getUrl,
            }}
        >
            <Dialog open={!disabled && isOpen} onOpenChange={!disabled ? setIsOpen : undefined}>
                {children}
            </Dialog>
        </mediaManagerContext.Provider>
    );
}

interface EditMediaFormProps {
    focusedMedia: ExtendedFileObject;
    onMediaDeleted: () => void;
}

function EditMediaForm({ focusedMedia, onMediaDeleted }: EditMediaFormProps) {
    const { getUrl, path, onMediaUpdate, onUpdate, onDelete } = useMediaManager();
    const [formData, setFormData] = useState({
        alternativeText: focusedMedia.user_metadata?.alternativeText || '',
    });
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        setFormData({
            alternativeText: focusedMedia.user_metadata?.alternativeText || '',
        });
    }, [focusedMedia]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setFormData((prev) => ({
            ...prev,
            alternativeText: e.target.value,
        }));
    }, []);

    const updateMediaMutation = useMutation({
        mutationFn: async ({ alternativeText }: { alternativeText: string }) => {
            return await onUpdate({
                path,
                media: focusedMedia,
                alternativeText,
            });
        },
        onSuccess: ({ alternativeText }) => {
            toast.success('Media updated successfully');

            // Update the media object
            const updatedMedia: ExtendedFileObject = {
                ...focusedMedia,
                user_metadata: {
                    ...focusedMedia.user_metadata,
                    alternativeText,
                },
            };

            // Notify parent component of the update
            if (onMediaUpdate) {
                onMediaUpdate(updatedMedia);
            }
        },
        onError: (error) => {
            toast.error(`Failed to update media: ${error.message}`);
        },
        onSettled: () => {
            setIsUpdating(false);
        },
    });

    const handleUpdate = useCallback(async () => {
        if (isUpdating) return;

        setIsUpdating(true);

        await updateMediaMutation.mutateAsync({
            alternativeText: formData.alternativeText,
        });
    }, [formData.alternativeText, updateMediaMutation, isUpdating]);

    const deleteMediaMutation = useMutation({
        mutationFn: async () => {
            await onDelete({ path, media: focusedMedia });
        },
        onSuccess: () => {
            toast.success('Media deleted successfully');
            onMediaDeleted();
        },
        onError: (error) => {
            toast.error(`Failed to delete media: ${error.message}`);
        },
    });

    const handleDelete = useCallback(() => {
        deleteMediaMutation.mutate();
    }, [deleteMediaMutation]);

    const formatFileSize = useCallback((bytes: number = 0) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
    }, []);

    const isFormChanged = formData.alternativeText !== (focusedMedia.user_metadata?.alternativeText || '');

    return (
        <div className="flex w-[300px] border-l">
            <ScrollArea type="always" className="group h-full w-full overflow-visible">
                <div className="flex w-full flex-col gap-y-2 p-6">
                    <div className="flex min-h-[180px] w-full items-center justify-center overflow-hidden rounded-md border bg-gray-50">
                        <Image
                            src={getUrl(focusedMedia, path)}
                            alt={formData.alternativeText || focusedMedia.name}
                            width={100}
                            height={100}
                            className="h-full max-h-[300px] w-full object-contain"
                            unoptimized
                        />
                    </div>

                    <div>
                        <Label htmlFor="alt-asset">Alternative Text</Label>
                        <Textarea
                            id="alt-asset"
                            value={formData.alternativeText}
                            className="w-full"
                            onChange={handleInputChange}
                            placeholder="Describe this image for accessibility"
                            disabled={isUpdating}
                            autoResize
                        />
                    </div>

                    <Button
                        onClick={handleUpdate}
                        disabled={isUpdating || !isFormChanged}
                        className="mt-2"
                        size="sm"
                        aria-label="Update media metadata"
                    >
                        {isUpdating ? (
                            <>
                                <Spinner size="small" show />
                                Updating...
                            </>
                        ) : (
                            'Update Media'
                        )}
                    </Button>

                    <div className="mt-4 rounded-md border">
                        <Table className="w-full">
                            <TableBody>
                                <TableRow className="border-b last:border-none">
                                    <TableCell className="text-muted-foreground text-left text-xs whitespace-nowrap">
                                        Name
                                    </TableCell>
                                    <TableCell className="text-right text-ellipsis">
                                        {truncate(focusedMedia.name, { length: 20 })}
                                    </TableCell>
                                </TableRow>
                                <TableRow className="border-b last:border-none">
                                    <TableCell className="text-muted-foreground text-left text-xs whitespace-nowrap">
                                        Size
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {focusedMedia.user_metadata?.size
                                            ? formatFileSize(focusedMedia.user_metadata.size)
                                            : '-'}
                                    </TableCell>
                                </TableRow>
                                <TableRow className="border-b last:border-none">
                                    <TableCell className="text-muted-foreground text-left text-xs whitespace-nowrap">
                                        Created at
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {focusedMedia.created_at ? formatTimeDifference(focusedMedia.created_at) : '-'}
                                    </TableCell>
                                </TableRow>
                                <TableRow className="border-b last:border-none">
                                    <TableCell className="text-muted-foreground text-left text-xs whitespace-nowrap">
                                        Updated at
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {focusedMedia.updated_at ? formatTimeDifference(focusedMedia.updated_at) : '-'}
                                    </TableCell>
                                </TableRow>
                                <TableRow className="border-b last:border-none">
                                    <TableCell className="text-muted-foreground text-left text-xs whitespace-nowrap">
                                        Type
                                    </TableCell>
                                    <TableCell className="flex flex-wrap justify-end gap-2">
                                        {focusedMedia.user_metadata?.mimetype ? (
                                            <Badge variant="outline">{focusedMedia.user_metadata.mimetype}</Badge>
                                        ) : (
                                            '-'
                                        )}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div className="group">
                        <Label htmlFor="url-asset" className="cursor-pointer">
                            URL
                        </Label>
                        <Clipboard value={getUrl(focusedMedia, path)} />
                    </div>

                    <ConfirmButton
                        onConfirmation={handleDelete}
                        variant={'ghost_destructive'}
                        aria-label="Delete asset"
                        disabled={deleteMediaMutation.isPending}
                        header={{
                            title: 'Delete asset',
                            description: `Are you sure you want to delete the "${
                                truncate(focusedMedia.name, {
                                    length: 20,
                                    separator: ' ',
                                }) +
                                (focusedMedia.name.length > 20 ? `.${focusedMedia.name.split('.').at(-1) || ''}` : '')
                            }" asset?`,
                        }}
                        className="mt-2 flex items-center justify-center gap-x-2"
                    >
                        {deleteMediaMutation.isPending ? (
                            <>
                                <Spinner size="small" show />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Icon name="Trash" className="h-4 w-4" />
                                Delete asset
                            </>
                        )}
                    </ConfirmButton>
                </div>
            </ScrollArea>
        </div>
    );
}

function MediaManagerContent<TMultiple extends boolean, TIsUrl extends boolean>({
    className,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogContent>) {
    const { setIsOpen, onValueChange, multiple, isUrl, value, getUrl, onUpload, formatType, medias, path } =
        useMediaManager<TMultiple, TIsUrl>();

    const [focusedMedia, setFocusedMedia] = useState<ExtendedFileObject | null>(null);
    const [selection, setSelection] = useState<ExtendedFileObject[]>([]);
    const [tab, setTab] = useState<'manager' | 'import'>('manager');

    // Helper function to decode URL and normalize for comparison
    const normalizeUrl = useCallback((url: string) => {
        try {
            return decodeURIComponent(url);
        } catch {
            return url;
        }
    }, []);

    // Helper function to find media object from URL
    const findMediaFromUrl = useCallback(
        (url: string) => {
            if (!medias.length) return null;

            const normalizedUrl = normalizeUrl(url);

            // Try to find matching media by comparing URLs
            return (
                medias.find((media) => {
                    const mediaUrl = getUrl(media, path);
                    const normalizedMediaUrl = normalizeUrl(mediaUrl);

                    // Compare both original and normalized URLs
                    return (
                        mediaUrl === url ||
                        normalizedMediaUrl === normalizedUrl ||
                        mediaUrl === normalizedUrl ||
                        normalizedMediaUrl === url
                    );
                }) || null
            );
        },
        [medias, getUrl, path, normalizeUrl],
    );

    // Initialize selection based on current value when dialog opens or value changes
    useEffect(() => {
        if (isUrl && value) {
            if (multiple && Array.isArray(value)) {
                // Multiple URLs - find corresponding media objects
                const mediaObjects = (value as string[])
                    .map((url) => findMediaFromUrl(url))
                    .filter((media): media is ExtendedFileObject => media !== null);

                setSelection(mediaObjects);
                setFocusedMedia(mediaObjects[0] || null);
            } else if (!multiple && typeof value === 'string') {
                // Single URL - find corresponding media object
                const mediaObject = findMediaFromUrl(value);
                setFocusedMedia(mediaObject);
                setSelection(mediaObject ? [mediaObject] : []);
            }
        } else if (!isUrl && value) {
            if (multiple && Array.isArray(value)) {
                // Multiple ExtendedFileObjects
                setSelection(value as ExtendedFileObject[]);
                setFocusedMedia((value as ExtendedFileObject[])[0] || null);
            } else if (!multiple && value) {
                // Single ExtendedFileObject
                const media = value as ExtendedFileObject;
                setFocusedMedia(media);
                setSelection([media]);
            }
        } else {
            // No value
            setFocusedMedia(null);
            setSelection([]);
        }
    }, [value, isUrl, multiple, findMediaFromUrl, medias]);

    const save = useCallback(() => {
        setIsOpen(false);

        if (isUrl) {
            // Convert ExtendedFileObject(s) to URL string(s)
            if (multiple) {
                const urls = selection.map((media) => getUrl(media, path));
                onValueChange(urls as MediaValue<TMultiple, TIsUrl>);
            } else {
                const url = focusedMedia ? getUrl(focusedMedia, path) : null;
                onValueChange(url as MediaValue<TMultiple, TIsUrl>);
            }
        } else {
            // Return ExtendedFileObject(s) directly
            onValueChange((multiple ? selection : focusedMedia) as MediaValue<TMultiple, TIsUrl>);
        }
    }, [focusedMedia, multiple, isUrl, onValueChange, selection, setIsOpen, getUrl, path]);

    const createSelector = useCallback(
        (media: ExtendedFileObject) => () => {
            setFocusedMedia((prev: ExtendedFileObject | null) => (isEqual(prev, media) ? null : media));
        },
        [],
    );

    const toggleSelectionItem = useCallback(
        (media: ExtendedFileObject) => (checked: boolean) => {
            if (checked) {
                setSelection((prev) => [...prev, media]);
            } else {
                setSelection((prev) => prev.filter((a) => a.id !== media.id));
            }
        },
        [],
    );

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const result = await onUpload({ file, path });
            if (result.error) {
                throw new Error(result.error.message || 'Upload failed');
            }
            return result;
        },
        mutationKey: ['media-manager', 'upload-file'],
        onSuccess: (data) => {
            setTab('manager');
            toast.success('File uploaded successfully');

            // Optionally set the uploaded file as focused
            if (data.data) {
                setFocusedMedia(data.data);
            }
        },
        onError: (error) => {
            toast.error(`Failed to upload file: ${error.message}`);
        },
    });

    return (
        <DialogContent {...props} className={cn('w-[1200px] max-w-[90%] gap-0 border p-0 sm:max-w-[90%]', className)}>
            <VisuallyHidden>
                <DialogTitle>Media Manager</DialogTitle>
                <DialogDescription className="text-sm">Manage your media assets</DialogDescription>
            </VisuallyHidden>
            <Tabs value={tab} onValueChange={setTab as (value: string) => void} className="gap-0">
                <div className="w-full border-b px-2 py-2">
                    <TabsList>
                        <TabsTrigger value="manager">Manager</TabsTrigger>
                        <TabsTrigger value="import">Import</TabsTrigger>
                    </TabsList>
                </div>
                <div className="flex h-[600px] max-h-[calc(100vh-140px)] border-b">
                    <TabsContent value="manager" className="mt-0 w-full">
                        <div className="flex h-full">
                            {medias.length === 0 ? (
                                <div
                                    className="flex h-full w-full cursor-pointer items-center justify-center"
                                    onClick={() => setTab('import')}
                                >
                                    <div className="mx-auto">
                                        <Empty className="rounded-lg transition-all duration-300">
                                            <EmptyHeader>
                                                <EmptyMedia variant="icon">
                                                    <Icon name="ImageUp" className="size-6" />
                                                </EmptyMedia>
                                                <EmptyTitle>No media found</EmptyTitle>
                                                <EmptyDescription>Upload a file to get started.</EmptyDescription>
                                            </EmptyHeader>
                                        </Empty>
                                    </div>
                                </div>
                            ) : (
                                <ScrollArea type="always" className="flex-1">
                                    <div className="flex flex-1 flex-nowrap gap-4 p-6">
                                        {medias.map((media, index) => (
                                            <div
                                                key={index}
                                                className={
                                                    'bg-foreground relative flex h-40 cursor-pointer items-center justify-center rounded-md border p-px' +
                                                    (focusedMedia?.id === media.id ? ' outline-primary outline-2' : '')
                                                }
                                                onClick={createSelector(media)}
                                            >
                                                <Image
                                                    src={getUrl(media, path)}
                                                    alt={media.user_metadata?.alternativeText || media.name}
                                                    width={100}
                                                    height={100}
                                                    className="h-full w-auto max-w-full rounded-[6px] object-contain"
                                                    unoptimized
                                                />
                                                {multiple && (
                                                    <div className="absolute top-2 right-2">
                                                        <Checkbox
                                                            className="bg-gray-50"
                                                            onCheckedChange={toggleSelectionItem(media)}
                                                            checked={selection.map((s) => s.id).includes(media.id)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                            {focusedMedia ? (
                                <EditMediaForm
                                    focusedMedia={focusedMedia}
                                    onMediaDeleted={() => setFocusedMedia(null)}
                                />
                            ) : null}
                        </div>
                    </TabsContent>
                    <TabsContent value="import" className="mt-0 w-full">
                        <div className="flex h-full max-h-full p-6">
                            {uploadMutation.isPending ? (
                                <div className="flex h-full w-full items-center justify-center">
                                    <div className="block">
                                        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                                            Preparing your asset
                                        </h2>
                                        <ul className="text-muted-foreground max-w-md list-inside space-y-2">
                                            <li className="flex items-center">
                                                <Icon
                                                    name="Check"
                                                    className="me-2 h-4 w-4 text-green-500 dark:text-green-400"
                                                />
                                                Respect maximum file size
                                            </li>
                                            <li className="flex items-center">
                                                <Icon
                                                    name="Check"
                                                    className="me-2 h-4 w-4 text-green-500 dark:text-green-400"
                                                />
                                                Control file format
                                            </li>
                                            <li className="flex items-center">
                                                <div>
                                                    <Spinner size="small" show />
                                                    <span className="sr-only">Loading</span>
                                                </div>
                                                Uploading your file
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <FileInput
                                    idName="import"
                                    formatType={formatType}
                                    onFileChange={uploadMutation.mutateAsync}
                                />
                            )}
                        </div>
                    </TabsContent>
                </div>
                <div className="flex w-full justify-end gap-x-4 p-6 py-4">
                    {selection.length === 0 || !focusedMedia ? (
                        <Button
                            autoFocus
                            aria-label="Close"
                            variant="default"
                            size={'sm'}
                            onClick={() => {
                                setIsOpen(false);
                            }}
                        >
                            Close
                        </Button>
                    ) : (
                        <Button autoFocus variant="default" size={'sm'} onClick={save} aria-label="Select">
                            Select
                        </Button>
                    )}
                </div>
            </Tabs>
        </DialogContent>
    );
}

// Default placeholder component for MediaManagerTrigger
type DefaultImageProps<TMultiple extends boolean, TIsUrl extends boolean> = {
    className?: string;
};

function DefaultImage<TMultiple extends boolean, TIsUrl extends boolean>({
    className,
}: DefaultImageProps<TMultiple, TIsUrl>) {
    const { value, getUrl, path, isUrl, medias } = useMediaManager<TMultiple, TIsUrl>();

    const hasValue = useMemo(() => {
        if (isUrl) {
            return Array.isArray(value) ? value.length > 0 : Boolean(value);
        } else {
            return Array.isArray(value) ? value.length > 0 : Boolean(value);
        }
    }, [value, isUrl]);

    // Helper function to decode URL and normalize for comparison
    const normalizeUrl = useCallback((url: string) => {
        try {
            return decodeURIComponent(url);
        } catch {
            return url;
        }
    }, []);

    // Helper function to find media object from URL
    const findMediaFromUrl = useCallback(
        (url: string) => {
            if (!isUrl || !medias.length) return null;

            const normalizedUrl = normalizeUrl(url);

            // Try to find matching media by comparing URLs
            return (
                medias.find((media) => {
                    const mediaUrl = getUrl(media, path);
                    const normalizedMediaUrl = normalizeUrl(mediaUrl);

                    // Compare both original and normalized URLs
                    return (
                        mediaUrl === url ||
                        normalizedMediaUrl === normalizedUrl ||
                        mediaUrl === normalizedUrl ||
                        normalizedMediaUrl === url
                    );
                }) || null
            );
        },
        [isUrl, medias, getUrl, path, normalizeUrl],
    );

    const getImageSrc = useCallback(() => {
        if (!hasValue) return '';

        if (isUrl) {
            // Value is already a URL string
            if (Array.isArray(value)) {
                return (value as string[])[0] || '';
            } else {
                return (value as string) || '';
            }
        } else {
            // Value is ExtendedFileObject, need to get URL
            if (Array.isArray(value)) {
                const media = (value as ExtendedFileObject[])[0];
                return media ? getUrl(media, path) : '';
            } else {
                const media = value as ExtendedFileObject;
                return media ? getUrl(media, path) : '';
            }
        }
    }, [value, isUrl, hasValue, getUrl, path]);

    const getImageAlt = useCallback(() => {
        if (!hasValue) return 'Media';

        if (isUrl) {
            // For URL strings, try to find the corresponding media object to get metadata
            if (Array.isArray(value)) {
                const url = (value as string[])[0];
                if (url) {
                    const media = findMediaFromUrl(url);
                    return media?.user_metadata?.alternativeText || media?.name || 'Media';
                }
            } else {
                const url = value as string;
                if (url) {
                    const media = findMediaFromUrl(url);
                    return media?.user_metadata?.alternativeText || media?.name || 'Media';
                }
            }
            return 'Media';
        } else {
            // For ExtendedFileObject, we can use metadata directly
            if (Array.isArray(value)) {
                const media = (value as ExtendedFileObject[])[0];
                return media?.user_metadata?.alternativeText || media?.name || 'Media';
            } else {
                const media = value as ExtendedFileObject;
                return media?.user_metadata?.alternativeText || media?.name || 'Media';
            }
        }
    }, [value, isUrl, hasValue, findMediaFromUrl]);

    if (!hasValue) return null;

    return (
        <Image
            src={getImageSrc()}
            alt={getImageAlt()}
            className={cn('h-full w-auto max-w-full rounded-md object-contain', className)}
            width={100}
            height={100}
            unoptimized
        />
    );
}

interface MediaManagerTriggerProps extends React.PropsWithChildren {
    className?: string;
    imageClassName?: string;
    placeholder?: React.ReactNode;
}

const MediaManagerTrigger = <TMultiple extends boolean, TIsUrl extends boolean>({
    className,
    children,
    placeholder,
    imageClassName,
}: MediaManagerTriggerProps) => {
    const { formatType, disabled, value, isUrl } = useMediaManager<TMultiple, TIsUrl>();

    const formatString = useMemo(() => {
        if (!formatType) return 'All formats';
        const arr = SORTED_SUPPORTED_FORMATS[formatType].map((t) => upperCase(t.split('/')[1]));
        return arr
            .join(', ')
            .replace(/,([^,]*)$/, ' or$1')
            .replace(' XML', '');
    }, [formatType]);

    const hasValue = useMemo(() => {
        if (isUrl) {
            return Array.isArray(value) ? value.length > 0 : Boolean(value);
        } else {
            return Array.isArray(value) ? value.length > 0 : Boolean(value);
        }
    }, [value, isUrl]);

    return (
        <DialogTrigger asChild>
            <div
                className={cn(
                    'bg-background outline-border hover:bg-accent hover:outline-primary m-1 flex h-64 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg outline-offset-2 outline-dashed',
                    disabled ? 'pointer-events-none' : '',
                    className,
                )}
            >
                {hasValue ? (
                    children ? (
                        children
                    ) : (
                        <DefaultImage className={imageClassName} />
                    )
                ) : placeholder ? (
                    placeholder
                ) : (
                    <div className="flex flex-col items-center justify-center gap-1 pt-5 pb-6">
                        <Icon name="UploadCloud" className="text-muted-foreground size-6" />
                        <Muted>Upload a file</Muted>
                        <Muted className="max-w-3/5 text-center text-xs">{formatString}</Muted>
                    </div>
                )}
            </div>
        </DialogTrigger>
    );
};

interface MediaManagerSkeletonProps {
    className?: string;
}

const MediaManagerSkeleton = ({ className }: MediaManagerSkeletonProps) => {
    return (
        <div
            className={cn(
                'bg-background outline-border hover:bg-accent hover:outline-primary mt-1 flex h-64 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg outline-offset-2 outline-dashed',
                className,
            )}
        >
            <div className="flex flex-col items-center justify-center space-y-3 pt-5 pb-6">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
            </div>
        </div>
    );
};

export { MediaManager, MediaManagerContent, MediaManagerSkeleton, MediaManagerTrigger };
