export type ArtworkListing = "Novos lançamentos" | "Em alta" | "Todos os NFTs";
export type ArtworkSort = "recent" | "low" | "high";
export type EthAmount = string;

export interface Artwork {
  id: string;
  name: string;
  price: EthAmount;
  oldPrice?: EthAmount;
  image: string;
  category: string;
  network: string;
  listing: Exclude<ArtworkListing, "Todos os NFTs">;
  edition: number;
  available: number;
  version: number;
}

export interface ArtworkFilters {
  search: string;
  category: string;
  network: string;
  listing: ArtworkListing;
  minPrice: EthAmount;
  maxPrice: EthAmount;
  sort: ArtworkSort;
  page: number;
}

export interface ArtworkCollection {
  items: Artwork[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CollectorProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

export interface CollectorSession {
  user: CollectorProfile;
  expiresAt: number;
}

export interface Wallet {
  id: string;
  name: string;
  address: string;
  network: string;
  primary: boolean;
}

export interface CartItem {
  artwork: Artwork;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  version: number;
}

export interface CartQuote {
  items: CartItem[];
  subtotal: EthAmount;
  discount: EthAmount;
  networkFee: EthAmount;
  total: EthAmount;
  coupon: string;
  version: number;
  quoteId: string;
}

export type OrderStatus = "pending" | "confirmed" | "declined";

export interface OrderReceipt {
  id: string;
  idempotencyKey: string;
  ownerId: string;
  status: OrderStatus;
  items: CartItem[];
  subtotal: EthAmount;
  discount: EthAmount;
  networkFee: EthAmount;
  total: EthAmount;
  coupon: string;
  transactionReference: string;
  walletAddress: string;
  network: string;
  collectorName: string;
  collectorEmail: string;
  version: number;
  createdAt: string;
}

export interface ArtworkSearch {
  search?: string;
  category?: string;
  network?: string;
  listing?: ArtworkListing;
  minPrice?: string;
  maxPrice?: string;
  sort?: ArtworkSort;
  page?: number;
}
