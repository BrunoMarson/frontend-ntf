import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { sessionQuery } from "./api/query";
import { queryClient } from "./api/query-client";
import { LiveCatalogProvider } from "./hooks/use-live-catalog";
import { HomePage } from "./routes/home";
import { LoginPage, RegisterPage } from "./routes/auth";
import {
  CartPage,
  CheckoutPage,
  OrderPage,
  ProfilePage,
  WalletsPage,
} from "./routes/collector";
import { ArtworkDetailPage } from "./routes/detail";

const rootRoute = createRootRoute({
  component: () => <LiveCatalogProvider><Outlet /></LiveCatalogProvider>,
  notFoundComponent: () => <main className="page-shell py-20 text-center">Página não encontrada.</main>,
});

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authenticated",
  beforeLoad: async ({ location }) => {
    const session = await queryClient.ensureQueryData(sessionQuery);
    if (!session) {
      throw redirect({
        to: "/login",
        search: (previous) => ({ ...previous, redirect: location.href }),
      });
    }
  },
  component: Outlet,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>) => ({
    search: typeof search.search === "string" ? search.search : "",
    category: typeof search.category === "string" ? search.category : "",
    network: typeof search.network === "string" ? search.network : "",
    listing: search.listing === "Em alta" || search.listing === "Novos lançamentos" ? search.listing : "Todos os NFTs",
    minPrice: typeof search.minPrice === "string" ? search.minPrice : "0.02",
    maxPrice: typeof search.maxPrice === "string" ? search.maxPrice : "12.3",
    sort: search.sort === "low" || search.sort === "high" ? search.sort : "recent",
    page: typeof search.page === "number" && Number.isSafeInteger(search.page) && search.page > 0 ? search.page : 1,
  }),
  component: HomePage,
});

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/nft/$artworkId",
  component: ArtworkDetailPage,
});

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cart",
  component: CartPage,
});

const checkoutRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/checkout",
  component: CheckoutPage,
});

const orderRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/orders/$orderId",
  component: OrderPage,
});

const profileRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/profile",
  component: ProfilePage,
});

const walletsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/wallets",
  component: WalletsPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/",
  }),
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/",
  }),
  component: RegisterPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  registerRoute,
  detailRoute,
  cartRoute,
  authenticatedRoute.addChildren([checkoutRoute, orderRoute, profileRoute, walletsRoute]),
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
