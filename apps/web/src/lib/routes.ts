// One owner for the paths, so the router and the 401 redirect cannot drift apart.
export const ROUTES = {
  login: '/login',
  products: '/',
  newProduct: '/products/new',
  productDetail: '/products/:id',
} as const;
