import axios, { AxiosError } from "axios";
import {
  GUEST_STORAGE_KEY,
  SESSION_STORAGE_KEY,
} from "../lib/storage-keys";
import type {
  Artwork,
  ArtworkCollection,
  ArtworkFilters,
  Cart,
  CartQuote,
  CollectorProfile,
  CollectorSession,
  OrderReceipt,
  Wallet,
} from "../types/artwork";

interface SessionCredentials {
  email: string;
  password: string;
}

interface RegistrationDetails extends SessionCredentials {
  name: string;
}

interface SessionResponse extends CollectorSession {
  token: string;
}

export interface CheckoutRequest {
  quoteId: string;
  walletId: string;
  network: string;
  collectorName: string;
  collectorEmail: string;
  items: Array<{ artworkId: string; quantity: number }>;
  coupon: string;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/",
  timeout: 10_000,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.response.use(undefined, (error: unknown) => {
  if (error instanceof AxiosError && error.response?.status === 401) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("kurio:session-expired"));
  }
  return Promise.reject(error);
});

apiClient.interceptors.request.use((config) => {
  const session = localStorage.getItem(SESSION_STORAGE_KEY);
  if (session) {
    const { token } = JSON.parse(session) as { token: string };
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  let guestId = localStorage.getItem(GUEST_STORAGE_KEY);
  if (!guestId) {
    guestId = crypto.randomUUID();
    localStorage.setItem(GUEST_STORAGE_KEY, guestId);
  }
  config.headers.set("X-Guest-ID", guestId);
  return config;
});

export async function fetchArtworks(filters: ArtworkFilters, signal?: AbortSignal) {
  const { data } = await apiClient.get<ArtworkCollection>("api/artworks", {
    params: filters,
    signal,
  });
  return data;
}

export async function fetchArtwork(id: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<Artwork>(`api/artworks/${encodeURIComponent(id)}`, { signal });
  return data;
}

export async function fetchSession(signal?: AbortSignal) {
  const { data } = await apiClient.get<CollectorSession | null>("api/session", { signal });
  return data;
}

async function persistSession(credentials: SessionCredentials | RegistrationDetails, endpoint: string) {
  const { data } = await apiClient.post<SessionResponse>(endpoint, credentials);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: data.token }));
  return data;
}

export function login(credentials: SessionCredentials) {
  return persistSession(credentials, "api/auth/login");
}

export function register(details: RegistrationDetails) {
  return persistSession(details, "api/auth/register");
}

export async function logout() {
  await apiClient.post("api/auth/logout");
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function fetchFavorites(signal?: AbortSignal) {
  const { data } = await apiClient.get<string[]>("api/favorites", { signal });
  return data;
}

export async function updateFavorite(artworkId: string, favorite: boolean) {
  if (favorite) {
    await apiClient.put(`api/favorites/${encodeURIComponent(artworkId)}`);
    return;
  }
  await apiClient.delete(`api/favorites/${encodeURIComponent(artworkId)}`);
}

export async function fetchCart(signal?: AbortSignal) {
  const { data } = await apiClient.get<Cart>("api/cart", { signal });
  return data;
}

export async function addCartItem(artworkId: string, quantity = 1) {
  const { data } = await apiClient.post<Cart>("api/cart/items", { artworkId, quantity });
  return data;
}

export async function updateCartItem(artworkId: string, quantity: number) {
  const { data } = await apiClient.patch<Cart>(`api/cart/items/${encodeURIComponent(artworkId)}`, { quantity });
  return data;
}

export async function removeCartItem(artworkId: string) {
  const { data } = await apiClient.delete<Cart>(`api/cart/items/${encodeURIComponent(artworkId)}`);
  return data;
}

export async function mergeGuestCart(items: Array<{ artworkId: string; quantity: number }>) {
  const { data } = await apiClient.post<Cart>("api/cart/merge", { items });
  return data;
}

export async function fetchCartQuote(coupon: string, signal?: AbortSignal) {
  const { data } = await apiClient.post<CartQuote>("api/cart/quote", { coupon }, { signal });
  return data;
}

export async function fetchProfile(signal?: AbortSignal) {
  const { data } = await apiClient.get<CollectorProfile>("api/profile", { signal });
  return data;
}

export async function updateProfile(profile: Pick<CollectorProfile, "name" | "email" | "avatar">) {
  const { data } = await apiClient.patch<CollectorProfile>("api/profile", profile);
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const { data } = await apiClient.patch<{ updated: boolean }>("api/profile/password", {
    currentPassword,
    newPassword,
  });
  return data;
}

export async function fetchWallets(signal?: AbortSignal) {
  const { data } = await apiClient.get<Wallet[]>("api/wallets", { signal });
  return data;
}

export async function saveWallet(wallet: Omit<Wallet, "id"> & { id?: string }) {
  if (wallet.id) {
    const { data } = await apiClient.patch<Wallet>(`api/wallets/${encodeURIComponent(wallet.id)}`, wallet);
    return data;
  }
  const { data } = await apiClient.post<Wallet>("api/wallets", wallet);
  return data;
}

export async function removeWallet(walletId: string) {
  await apiClient.delete(`api/wallets/${encodeURIComponent(walletId)}`);
}

export async function connectWallet(walletId: string, action: "connect" | "refuse" | "disconnect") {
  const { data } = await apiClient.post<{ status: "connected" | "refused" | "disconnected" }>(
    `api/wallets/${encodeURIComponent(walletId)}/connection`,
    { action },
  );
  return data;
}

export async function createOrder(request: CheckoutRequest, idempotencyKey: string) {
  const { data } = await apiClient.post<OrderReceipt>(
    "api/orders",
    request,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return data;
}

export async function fetchOrder(orderId: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<OrderReceipt>(`api/orders/${encodeURIComponent(orderId)}`, { signal });
  return data;
}

export async function fetchOrders(signal?: AbortSignal) {
  const { data } = await apiClient.get<OrderReceipt[]>("api/orders", { signal });
  return data;
}

export async function recoverPendingOrder(idempotencyKey: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<OrderReceipt | null>("api/orders/by-idempotency-key", {
    params: { key: idempotencyKey },
    signal,
  });
  return data;
}
