import { queryOptions } from "@tanstack/react-query";
import {
  fetchArtwork,
  fetchArtworks,
  fetchCart,
  fetchCartQuote,
  fetchFavorites,
  fetchOrder,
  fetchOrders,
  fetchProfile,
  fetchSession,
  fetchWallets,
} from "./client";
import type { ArtworkFilters } from "../types/artwork";

export const artworkQuery = (filters: ArtworkFilters) =>
  queryOptions({
    queryKey: ["artworks", filters] as const,
    queryFn: ({ signal }) => fetchArtworks(filters, signal),
    staleTime: 15_000,
    retry: 1,
  });

export const artworkDetailQuery = (artworkId: string) =>
  queryOptions({
    queryKey: ["artwork", artworkId] as const,
    queryFn: ({ signal }) => fetchArtwork(artworkId, signal),
    staleTime: 15_000,
  });

export const sessionQuery = queryOptions({
  queryKey: ["session"] as const,
  queryFn: ({ signal }) => fetchSession(signal),
  retry: false,
});

export const cartQuery = queryOptions({
  queryKey: ["cart"] as const,
  queryFn: ({ signal }) => fetchCart(signal),
});

export const cartQuoteQuery = (coupon: string) =>
  queryOptions({
    queryKey: ["cart-quote", coupon] as const,
    queryFn: ({ signal }) => fetchCartQuote(coupon, signal),
    retry: false,
  });

export const favoritesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["favorites", userId] as const,
    queryFn: ({ signal }) => fetchFavorites(signal),
    staleTime: 30_000,
  });

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId] as const,
    queryFn: ({ signal }) => fetchProfile(signal),
  });

export const walletsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["wallets", userId] as const,
    queryFn: ({ signal }) => fetchWallets(signal),
  });

export const ordersQuery = (userId: string) =>
  queryOptions({
    queryKey: ["orders", userId] as const,
    queryFn: ({ signal }) => fetchOrders(signal),
  });

export const orderQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["order", orderId] as const,
    queryFn: ({ signal }) => fetchOrder(orderId, signal),
    refetchInterval: (query) => query.state.data?.status === "pending" ? 2_000 : false,
  });
