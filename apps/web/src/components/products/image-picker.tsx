import { ALLOWED_IMAGE_TYPES, MAX_IMAGES } from '@linkby/shared';
import { CircleAlert, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addImages } from '@/lib/images';

export function ImagePicker({
  images,
  onChange,
  disabled,
}: {
  images: File[];
  onChange: (images: File[]) => void;
  disabled: boolean;
}) {
  const [rejections, setRejections] = useState<string[]>([]);

  const previews = useMemo(
    () => images.map((image) => ({ image, url: URL.createObjectURL(image) })),
    [images],
  );

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  const remaining = MAX_IMAGES - images.length;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="images">Images (up to {MAX_IMAGES}, max 5MB each)</Label>
      <Input
        id="images"
        type="file"
        multiple
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        className="h-auto"
        disabled={disabled || remaining === 0}
        onChange={(event) => {
          const selection = addImages(images, Array.from(event.target.files ?? []));
          setRejections(selection.rejections);
          onChange(selection.images);
          // Cleared so re-picking the same file still fires a change event.
          event.target.value = '';
        }}
      />

      {rejections.map((rejection) => (
        <p key={rejection} role="alert" className="text-destructive flex items-start gap-2 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {rejection}
        </p>
      ))}

      {previews.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {previews.map((preview) => (
            <div key={preview.url} className="relative">
              <img
                src={preview.url}
                alt={preview.image.name}
                className="size-20 rounded-lg border object-cover"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute -top-2 -right-2 size-6 rounded-full"
                disabled={disabled}
                aria-label={`Remove ${preview.image.name}`}
                onClick={() => onChange(images.filter((image) => image !== preview.image))}
              >
                <X />
              </Button>
            </div>
          ))}
          <span className="text-muted-foreground text-sm">
            {remaining} slot{remaining === 1 ? '' : 's'} remaining
          </span>
        </div>
      )}
    </div>
  );
}
