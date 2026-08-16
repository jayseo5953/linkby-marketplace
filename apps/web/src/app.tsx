import { Route, Routes } from 'react-router';
import { AppLayout } from '@/components/layout/app-layout';
import { RequireSession } from '@/components/layout/require-session';
import { LoginPage } from '@/pages/login';
import { NotFoundPage } from '@/pages/not-found';
import { ProductDetailsPage } from '@/pages/product-details';
import { ProductListPage } from '@/pages/product-list';
import { ProductRegistrationPage } from '@/pages/product-registration';
import { ROUTES } from '@/lib/routes';

export function App() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route element={<RequireSession />}>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.products} element={<ProductListPage />} />
          <Route path={ROUTES.newProduct} element={<ProductRegistrationPage />} />
          <Route path={ROUTES.productDetail} element={<ProductDetailsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
