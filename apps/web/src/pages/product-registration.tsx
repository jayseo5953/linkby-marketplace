import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from '@linkby/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import * as productsApi from '@/api/products';
import { ImagePicker } from '@/components/products/image-picker';
import { PriceField } from '@/components/products/price-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parsePriceToCents } from '@/lib/format';
import { ROUTES } from '@/lib/routes';

export function ProductRegistrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Page itself is a form, if evolves, could be split into a form component
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<File[]>([]);
  // Set synchronously: a double-click submits twice before `isPending` has re-rendered the button.
  const inFlight = useRef(false);

  const create = useMutation({
    mutationFn: (priceCents: number) =>
      productsApi.createProduct({ name, description, priceCents }, images),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate(ROUTES.products);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const priceCents = parsePriceToCents(price);
  const canSubmit =
    name.trim() !== '' && description.trim() !== '' && priceCents !== null && !create.isPending;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-medium">New listing</h1>

      <Card className="mt-4">
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (priceCents === null || inFlight.current) return;

              inFlight.current = true;
              create.mutate(priceCents);
            }}
          >
            {create.error !== null && (
              <p role="alert" className="text-destructive flex items-center gap-2 text-sm">
                <CircleAlert className="size-4 shrink-0" />
                Couldn't create the listing. Nothing was saved.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                maxLength={MAX_NAME_LENGTH}
                value={name}
                readOnly={create.isPending}
                onChange={(event) => setName(event.target.value)}
              />
              <CharacterCount used={name.length} limit={MAX_NAME_LENGTH} />
            </div>

            <PriceField
              label="Price"
              value={price}
              readOnly={create.isPending}
              onChange={setPrice}
            />

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                className="max-h-64"
                maxLength={MAX_DESCRIPTION_LENGTH}
                value={description}
                readOnly={create.isPending}
                onChange={(event) => setDescription(event.target.value)}
              />
              <CharacterCount used={description.length} limit={MAX_DESCRIPTION_LENGTH} />
            </div>

            <ImagePicker images={images} onChange={setImages} disabled={create.isPending} />

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={create.isPending}
                onClick={() => navigate(ROUTES.products)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {create.isPending ? 'Submitting…' : 'Submit'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function CharacterCount({ used, limit }: { used: number; limit: number }) {
  return (
    <p className="text-muted-foreground self-end text-sm">
      {used}/{limit}
    </p>
  );
}
