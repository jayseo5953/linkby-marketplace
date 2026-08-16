import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES } from '@linkby/shared';

export type ImageSelection = { images: File[]; rejections: string[] };

const describeSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

// Rejected files are named one by one and the rest of the batch is still kept (§3a).
export function addImages(current: File[], added: File[]): ImageSelection {
  return added.reduce<ImageSelection>(
    (selection, file) => {
      const reject = (reason: string) => ({
        ...selection,
        rejections: [...selection.rejections, reason],
      });

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return reject(`"${file.name}" is not a JPEG, PNG or WebP image. Not added.`);
      }

      if (file.size > MAX_IMAGE_BYTES) {
        return reject(
          `"${file.name}" is ${describeSize(file.size)} — the limit is ${describeSize(MAX_IMAGE_BYTES)} per image. Not added.`,
        );
      }

      if (selection.images.length >= MAX_IMAGES) {
        return reject(`Only ${MAX_IMAGES} images allowed — "${file.name}" was not added.`);
      }

      return { ...selection, images: [...selection.images, file] };
    },
    { images: current, rejections: [] },
  );
}
