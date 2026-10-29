import { artworks } from "../data/artworks";
import type {
  Artwork,
  CartItem,
  CollectorProfile,
  OrderReceipt,
  Wallet,
  CartQuote,
} from "../types/artwork";
import {
  MOCK_STORAGE_KEY,
  SESSION_STORAGE_KEY,
} from "../lib/storage-keys";

export interface MockAccount {
  id: string;
  email: string;
  passwordHash: string;
}

export interface MockSession {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface MockScenario {
  name: string;
  latencyMs: number;
  paymentOutcome: "confirmed" | "declined";
  expireSession: boolean;
  timeoutConsumed: boolean;
}

export interface MockDatabase {
  accounts: MockAccount[];
  profiles: Record<string, CollectorProfile>;
  sessions: MockSession[];
  artworks: Artwork[];
  carts: Record<string, CartItem[]>;
  cartVersions: Record<string, number>;
  favorites: Record<string, string[]>;
  wallets: Record<string, Wallet[]>;
  orders: Record<string, OrderReceipt>;
  idempotency: Record<string, { fingerprint: string; orderId: string }>;
  quotes: Record<string, { quote: CartQuote; ownerId: string }>;
  scenario: MockScenario;
}

const defaultScenario: MockScenario = {
  name: "default",
  latencyMs: 0,
  paymentOutcome: "confirmed",
  expireSession: false,
  timeoutConsumed: false,
};

function createInitialDatabase(): MockDatabase {
  const primaryProfile: CollectorProfile = {
    id: "collector-emerald",
    email: "colecionador@kurio.test",
    name: "Alex Morgan",
    avatar: artworks[0].image,
  };
  const secondProfile: CollectorProfile = {
    id: "collector-sage",
    email: "sara@kurio.test",
    name: "Sara Santos",
    avatar: artworks[1].image,
  };

  return {
    accounts: [
      {
        id: primaryProfile.id,
        email: primaryProfile.email,
        passwordHash: "5967c16c2022d4e40c36c348638237f3846e004c5f74dcde8aa0373f383aa8d4",
      },
      {
        id: secondProfile.id,
        email: secondProfile.email,
        passwordHash: "df636f5dba0381634c56a236fbcc4df3205b0da9b9b026715884a12418491846",
      },
    ],
    profiles: {
      [primaryProfile.id]: primaryProfile,
      [secondProfile.id]: secondProfile,
    },
    sessions: [],
    artworks: artworks.map((artwork) => ({ ...artwork })),
    carts: {},
    cartVersions: {},
    favorites: {
      [primaryProfile.id]: [],
      [secondProfile.id]: [],
    },
    wallets: {
      [primaryProfile.id]: [
        { id: "wallet-emerald", name: "Carteira principal", address: "0x1234...7890", network: "Ethereum", primary: true },
      ],
      [secondProfile.id]: [
        { id: "wallet-sage", name: "Carteira principal", address: "0xabcd...5678", network: "Polygon", primary: true },
      ],
    },
    orders: {},
    idempotency: {},
    quotes: {},
    scenario: { ...defaultScenario },
  };
}

function parseDatabase(value: string | null): MockDatabase | undefined {
  if (!value) return undefined;
  const database = JSON.parse(value) as MockDatabase;
  if (
    !database?.accounts ||
    !database.profiles ||
    !database.artworks ||
    !database.carts ||
    !database.cartVersions ||
    !database.orders ||
    !database.quotes ||
    !database.scenario
  ) {
    throw new Error("O banco local de demonstração está corrompido. Limpe os dados do site e tente novamente.");
  }
  return database;
}

export function readDatabase(): MockDatabase {
  const database = parseDatabase(localStorage.getItem(MOCK_STORAGE_KEY)) ?? createInitialDatabase();
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(database));
  return database;
}

export function saveDatabase(database: MockDatabase) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(database));
}

export function resetDatabase() {
  const database = createInitialDatabase();
  saveDatabase(database);
  localStorage.removeItem(SESSION_STORAGE_KEY);
  return database;
}

export function getCurrentArtwork(database: MockDatabase, id: string) {
  return database.artworks.find((artwork) => artwork.id === id);
}

export function findProfile(database: MockDatabase, userId: string) {
  return database.profiles[userId];
}
