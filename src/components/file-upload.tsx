import { truncate } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Icon } from '../icon';

// constants

const SUPPORTED_IMAGE_FORMATS = [
    'image/webp',
    'image/jpeg',
    'image/png',
    'image/gif',
    // 'image/svg+xml',
    'image/avif',
    'image/tiff',
    'image/ico',
];

const SUPPORTED_VIDEO_FORMATS = ['video/mpeg', 'video/mp4', 'video/mov', 'video/avi'];

const SUPPORTED_AUDIO_FORMATS = ['audio/mp3', 'audio/wav', 'audio/ogg'];

const SUPPORTED_FILE_FORMATS = [
    'application/csv',
    'application/zip',
    'application/pdf',
    'application/xls',
    'application/xlsx',
    'application/json',
];

export const ALL_SUPPORTED_FORMATS = [
    ...SUPPORTED_IMAGE_FORMATS,
    ...SUPPORTED_VIDEO_FORMATS,
    ...SUPPORTED_AUDIO_FORMATS,
    ...SUPPORTED_FILE_FORMATS,
];

export const SORTED_SUPPORTED_FORMATS = {
    image: SUPPORTED_IMAGE_FORMATS,
    video: SUPPORTED_VIDEO_FORMATS,
    audio: SUPPORTED_AUDIO_FORMATS,
    file: SUPPORTED_FILE_FORMATS,
};

export const MAX_IMAGE_SIZE = 4; //In MegaBytes

// components

const byte2MB = (sizeInBytes: number, decimalsNum = 2) => {
    const result = sizeInBytes / (1024 * 1024);
    return +result.toFixed(decimalsNum);
};

export interface FileInputProps {
    idName: string;
    onFileChange: (file: File) => void;
    formatType?: keyof typeof SORTED_SUPPORTED_FORMATS;
}

export const FileInput: React.FC<FileInputProps> = ({ idName, onFileChange, formatType }) => {
    const formats = useMemo(() => {
        return formatType ? SORTED_SUPPORTED_FORMATS[formatType] : ALL_SUPPORTED_FORMATS;
    }, [formatType]);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (byte2MB(file.size) > MAX_IMAGE_SIZE) {
                toast.error('File size is too large', {
                    description: `Max size is ${MAX_IMAGE_SIZE}MB`,
                });
                return;
            }

            if (!formats.includes(file.type)) {
                toast.error('File type is not supported', {
                    description: truncate(`File type is not supported, supported formats are ${formats.join(', ')}`, {
                        length: 70,
                        separator: ' ',
                    }),
                });
                return;
            }

            onFileChange(file);
        },
        [formats, onFileChange],
    );

    return (
        <label
            htmlFor={`file-${idName}`}
            className="bg-accent/10 hover:bg-accent/40 flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed"
        >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Icon name="UploadCloud" />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    {/* {t.rich('upload.title', {
                        span: (chunks) => <span className="font-semibold">{chunks}</span>,
                    })} */}
                    <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG or GIF</p>
            </div>
            <input
                id={`file-${idName}`}
                type="file"
                className="hidden"
                onChange={handleChange}
                accept={formats.join(',')}
            />
        </label>
    );
};
