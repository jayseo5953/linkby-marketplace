import { useParams } from 'react-router';

export function ProductDetailsPage() {
  const { id } = useParams();

  return (
    <>
      <h1 className="text-xl font-medium">Product {id}</h1>
      <p className="text-muted-foreground mt-1 text-sm">Placeholder — LM-10.</p>
    </>
  );
}
