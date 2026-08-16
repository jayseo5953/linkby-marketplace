import { Package } from 'lucide-react';

export function ProductImages({ name, imageUrls }: { name: string; imageUrls: string[] }) {
  if (imageUrls.length === 0) {
    return (
      <div className="bg-muted flex h-64 w-full items-center justify-center rounded-xl">
        <Package className="text-muted-foreground size-8" aria-hidden />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {imageUrls.map((url, index) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={`${name} — image ${index + 1} of ${imageUrls.length}`}
            className="bg-muted aspect-[4/3] w-full rounded-xl object-contain"
          />
        </a>
      ))}
    </div>
  );
}
