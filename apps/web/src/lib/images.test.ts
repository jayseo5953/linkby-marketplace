import { MAX_IMAGE_BYTES } from '@linkby/shared';
import { describe, expect, it } from 'vitest';
import { addImages } from './images';

const image = (name: string, bytes = 10, type = 'image/jpeg') =>
  new File([new Uint8Array(bytes)], name, { type });

describe('addImages', () => {
  it('appends to what is already selected', () => {
    const selection = addImages([image('a.jpg')], [image('b.png', 10, 'image/png')]);

    expect(selection.images.map((file) => file.name)).toEqual(['a.jpg', 'b.png']);
    expect(selection.rejections).toEqual([]);
  });

  it('rejects an unsupported type by name', () => {
    const selection = addImages([], [image('notes.pdf', 10, 'application/pdf')]);

    expect(selection.images).toEqual([]);
    expect(selection.rejections).toEqual([
      '"notes.pdf" is not a JPEG, PNG or WebP image. Not added.',
    ]);
  });

  it('rejects an image over the size limit by name and size', () => {
    const selection = addImages([], [image('beach-raw.png', 12_500_000, 'image/png')]);

    expect(selection.images).toEqual([]);
    expect(selection.rejections).toEqual([
      '"beach-raw.png" is 11.9MB — the limit is 5.0MB per image. Not added.',
    ]);
  });

  it('accepts a file exactly on the limit and rejects one byte more', () => {
    expect(addImages([], [image('on.jpg', MAX_IMAGE_BYTES)]).images).toHaveLength(1);
    expect(addImages([], [image('over.jpg', MAX_IMAGE_BYTES + 1)]).images).toEqual([]);
  });

  it('rejects only the files past the cap', () => {
    const selection = addImages(
      [],
      ['1', '2', '3', '4', '5', '6'].map((n) => image(`${n}.jpg`)),
    );

    expect(selection.images).toHaveLength(5);
    expect(selection.rejections).toEqual(['Only 5 images allowed — "6.jpg" was not added.']);
  });

  it('counts what was already selected against the cap', () => {
    const current = ['1', '2', '3', '4', '5'].map((n) => image(`${n}.jpg`));
    const selection = addImages(current, [image('extra.jpg')]);

    expect(selection.images).toHaveLength(5);
    expect(selection.rejections).toEqual(['Only 5 images allowed — "extra.jpg" was not added.']);
  });

  it('keeps the good files in a batch that also has bad ones', () => {
    const selection = addImages(
      [],
      [
        image('ok.jpg'),
        image('huge.jpg', MAX_IMAGE_BYTES + 1),
        image('also-ok.webp', 10, 'image/webp'),
      ],
    );

    expect(selection.images.map((file) => file.name)).toEqual(['ok.jpg', 'also-ok.webp']);
    expect(selection.rejections).toHaveLength(1);
  });
});
