import { http, HttpResponse } from "msw";
import { addEth, fromUnits, multiplyEth, subtractEth, toUnits } from "../lib/eth";
import { artworks } from "../data/artworks";
import type {
  ArtworkFilters,
  CartItem,
  CartQuote,
  CollectorProfile,
  OrderReceipt,
  Wallet,
} from "../types/artwork";
import {
  findProfile,
  getCurrentArtwork,
  readDatabase,
  resetDatabase,
  saveDatabase,
  type MockAccount,
  type MockDatabase,
  type MockSession,
} from "./store";

const pageSize = 9;
function jsonError(status: number, code: string, message: string, fields?: Record<string, string>) {
  return HttpResponse.json({ code, message, fields }, { status });
}

function getGuestId(request: Request) {
  return request.headers.get("x-guest-id");
}

function getCurrentSession(database: MockDatabase, request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const session = database.sessions.find((item) => item.token === token);
  if (!session) return undefined;
  if (database.scenario.expireSession || session.expiresAt <= Date.now()) {
    database.sessions = database.sessions.filter((item) => item.token !== token);
    saveDatabase(database);
    return undefined;
  }
  return session;
}

function requireUser(database: MockDatabase, request: Request) {
  const session = getCurrentSession(database, request);
  if (!session) {
    return {
      error: jsonError(401, "SESSION_EXPIRED", "Sua sessão expirou. Entre novamente para continuar."),
    } as const;
  }
  const profile = findProfile(database, session.userId);
  if (!profile) {
    return { error: jsonError(401, "SESSION_INVALID", "Sua sessão não é válida.") } as const;
  }
  return { session, profile } as const;
}

async function beforeRequest(database: MockDatabase, _request: Request) {
  if (database.scenario.latencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, database.scenario.latencyMs));
  }
  if (database.scenario.name === "network-error" || database.scenario.name === "connection-lost") {
    return Response.error();
  }
  if (database.scenario.name === "http-500") {
    return jsonError(500, "SERVICE_UNAVAILABLE", "O serviço está temporariamente indisponível.");
  }
  if (database.scenario.name === "unauthorized") {
    database.scenario.expireSession = true;
    saveDatabase(database);
  }
  return undefined;
}

async function hashPassword(password: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function userCartKey(database: MockDatabase, request: Request) {
  const session = getCurrentSession(database, request);
  if (session) return session.userId;
  const guestId = getGuestId(request);
  return guestId ? `guest:${guestId}` : undefined;
}

function nextCartVersion(database: MockDatabase, ownerId: string) {
  const nextVersion = (database.cartVersions[ownerId] ?? 0) + 1;
  database.cartVersions[ownerId] = nextVersion;
  return nextVersion;
}

function hydratedCart(database: MockDatabase, ownerId: string) {
  const savedItems = database.carts[ownerId] ?? [];
  const items = savedItems.map((item) => {
    const artwork = getCurrentArtwork(database, item.artwork.id);
    if (!artwork) {
      throw new Error(`O NFT ${item.artwork.id} do carrinho não existe no catálogo.`);
    }
    return { artwork, quantity: item.quantity };
  });
  return { items, version: database.cartVersions[ownerId] ?? 0 };
}

function safeCart(database: MockDatabase, ownerId: string) {
  try {
    return hydratedCart(database, ownerId);
  } catch (error) {
    return jsonError(409, "CART_ITEM_MISSING", error instanceof Error ? error.message : "O carrinho contém um item inválido.");
  }
}

function quoteCart(
  database: MockDatabase,
  ownerId: string,
  cartItems: CartItem[],
  coupon: string,
  cartVersion: number,
): CartQuote {
  const subtotal = addEth(...cartItems.map((item) => multiplyEth(item.artwork.price, item.quantity)));
  const discount = coupon === "KURIO10" ? fromUnits((toUnits(subtotal) * 10n) / 100n) : "0";
  const networks = new Set(cartItems.map((item) => item.artwork.network));
  const fees = { Ethereum: "0.005", Polygon: "0.001", Solana: "0.0025" } as const;
  const networkFee = addEth(
    ...[...networks].map((network) => {
      if (!(network in fees)) throw new Error(`Taxa de rede não configurada para ${network}.`);
      return fees[network as keyof typeof fees];
    }),
  );
  const quote: CartQuote = {
    items: cartItems.map((item) => ({
      artwork: { ...item.artwork },
      quantity: item.quantity,
    })),
    subtotal,
    discount,
    networkFee,
    total: addEth(subtractEth(subtotal, discount), networkFee),
    coupon,
    version: cartVersion,
    quoteId: crypto.randomUUID(),
  };
  database.quotes[quote.quoteId] = { quote, ownerId };
  return quote;
}

function removePurchasedItems(database: MockDatabase, ownerId: string, items: CartItem[]) {
  const cart = database.carts[ownerId] ?? [];
  for (const purchased of items) {
    const currentItem = cart.find((item) => item.artwork.id === purchased.artwork.id);
    if (!currentItem) continue;
    const remaining = currentItem.quantity - purchased.quantity;
    if (remaining > 0) currentItem.quantity = remaining;
    else database.carts[ownerId] = cart.filter((item) => item.artwork.id !== purchased.artwork.id);
  }
  nextCartVersion(database, ownerId);
}

function orderFingerprint(payload: unknown) {
  return JSON.stringify(payload);
}

function cookieSession(database: MockDatabase, profile: CollectorProfile): MockSession {
  database.scenario.expireSession = false;
  if (database.scenario.name === "unauthorized") database.scenario.name = "default";
  const session = {
    token: crypto.randomUUID(),
    userId: profile.id,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
  database.sessions = database.sessions.filter((item) => item.userId !== profile.id);
  database.sessions.push(session);
  return session;
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function registrationErrors(name: string, email: string, password: string) {
  const fields: Record<string, string> = {};
  if (name.trim().length < 2) fields.name = "Informe seu nome completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Informe um e-mail válido.";
  if (password.length < 8) fields.password = "A senha deve ter pelo menos 8 caracteres.";
  return fields;
}

function sessionResponse(database: MockDatabase, session: MockSession) {
  const user = findProfile(database, session.userId);
  if (!user) throw new Error(`A sessão ${session.token} não tem um perfil correspondente.`);
  return HttpResponse.json({ token: session.token, user, expiresAt: session.expiresAt });
}

export const handlers = [
  http.post("/__mock/reset", () => {
    resetDatabase();
    return HttpResponse.json({ reset: true });
  }),

  http.post("/__mock/scenario", async ({ request }) => {
    const database = readDatabase();
    const scenario = await readJson<Partial<MockDatabase["scenario"]>>(request);
    database.scenario = { ...database.scenario, ...scenario };
    saveDatabase(database);
    return HttpResponse.json(database.scenario);
  }),

  http.post("/__mock/expire-session", () => {
    const database = readDatabase();
    database.scenario.expireSession = true;
    saveDatabase(database);
    return HttpResponse.json({ expired: true });
  }),

  http.post("/__mock/events/nft.updated", async ({ request }) => {
    const database = readDatabase();
    const payload = await readJson<{
      id: string;
      price?: string;
      available?: number;
      eventVersion?: number;
      duplicateCount?: number;
    }>(request);
    const artwork = getCurrentArtwork(database, payload.id);
    if (!artwork) return jsonError(404, "NFT_NOT_FOUND", "NFT não encontrado.");
    if (payload.price !== undefined && !/^\d+(?:\.\d{1,8})?$/.test(payload.price)) {
      return jsonError(422, "INVALID_PRICE", "Informe um preço ETH válido.");
    }
    if (payload.available !== undefined && (!Number.isSafeInteger(payload.available) || payload.available < 0)) {
      return jsonError(422, "INVALID_AVAILABILITY", "Informe uma disponibilidade válida.");
    }
    const version = payload.eventVersion ?? artwork.version + 1;
    if (!Number.isSafeInteger(version) || version < 1) {
      return jsonError(422, "INVALID_EVENT_VERSION", "Informe uma versão de evento válida.");
    }
    if (version <= artwork.version) return HttpResponse.json(artwork);
    if (payload.price !== undefined) artwork.price = payload.price;
    if (payload.available !== undefined) artwork.available = payload.available;
    artwork.version = version;
    saveDatabase(database);
    return HttpResponse.json(artwork);
  }),

  http.post("/__mock/events/order.updated", async ({ request }) => {
    const database = readDatabase();
    const payload = await readJson<{
      id: string;
      status: OrderReceipt["status"];
      version: number;
    }>(request);
    const order = database.orders[payload.id];
    if (!order) return jsonError(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
    if (!Number.isSafeInteger(payload.version) || payload.version < 1) {
      return jsonError(422, "INVALID_EVENT_VERSION", "Informe uma versão de evento válida.");
    }
    if (!["pending", "confirmed", "declined"].includes(payload.status)) {
      return jsonError(422, "INVALID_ORDER_STATUS", "Informe um estado de pedido válido.");
    }
    if (payload.version <= order.version) {
      return HttpResponse.json(order);
    }
    if (order.status === "confirmed" || order.status === "declined") {
      return jsonError(409, "ORDER_TERMINAL", "Este pedido já possui um estado terminal.");
    }
    const updated = { ...order, status: payload.status, version: payload.version };
    database.orders[order.id] = updated;
    if (payload.status === "confirmed") removePurchasedItems(database, order.ownerId, order.items);
    saveDatabase(database);
    return HttpResponse.json(updated);
  }),

  http.get("/api/session", ({ request }) => {
    const database = readDatabase();
    const session = getCurrentSession(database, request);
    if (!session) return HttpResponse.json(null);
    const user = findProfile(database, session.userId);
    if (!user) return jsonError(401, "SESSION_INVALID", "Sua sessão não é válida.");
    return HttpResponse.json({ user, expiresAt: session.expiresAt });
  }),

  http.post("/api/auth/login", async ({ request }) => {
    const database = readDatabase();
    const unavailable = await beforeRequest(database, request);
    if (unavailable) return unavailable;
    const { email, password } = await readJson<{ email: string; password: string }>(request);
    const passwordHash = await hashPassword(password);
    const account = database.accounts.find(
      (item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.passwordHash === passwordHash,
    );
    if (!account) return jsonError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
    const user = findProfile(database, account.id);
    if (!user) return jsonError(404, "PROFILE_NOT_FOUND", "Perfil do colecionador não encontrado.");
    const session = cookieSession(database, user);
    saveDatabase(database);
    return sessionResponse(database, session);
  }),

  http.post("/api/auth/register", async ({ request }) => {
    const database = readDatabase();
    const unavailable = await beforeRequest(database, request);
    if (unavailable) return unavailable;
    const { name, email, password } = await readJson<{ name: string; email: string; password: string }>(request);
    const fields = registrationErrors(name, email, password);
    if (Object.keys(fields).length) return jsonError(422, "VALIDATION_ERROR", "Revise os campos informados.", fields);
    if (database.accounts.some((account) => account.email.toLowerCase() === email.trim().toLowerCase())) {
      return jsonError(409, "EMAIL_TAKEN", "Este e-mail já possui uma conta.", { email: "Use outro e-mail." });
    }
    if (database.scenario.name === "signup-conflict") {
      return jsonError(409, "EMAIL_TAKEN", "Este e-mail já possui uma conta.", { email: "Use outro e-mail." });
    }
    const profile: CollectorProfile = {
      id: crypto.randomUUID(),
      email: email.trim().toLowerCase(),
      name: name.trim(),
      avatar: artworks[0].image,
    };
    const account: MockAccount = {
      id: profile.id,
      email: profile.email,
      passwordHash: await hashPassword(password),
    };
    database.accounts.push(account);
    database.profiles[profile.id] = profile;
    database.favorites[profile.id] = [];
    database.wallets[profile.id] = [];
    const session = cookieSession(database, profile);
    saveDatabase(database);
    return sessionResponse(database, session);
  }),

  http.post("/api/auth/logout", ({ request }) => {
    const database = readDatabase();
    const session = getCurrentSession(database, request);
    if (session) database.sessions = database.sessions.filter((item) => item.token !== session.token);
    saveDatabase(database);
    return HttpResponse.json({ loggedOut: true });
  }),

  http.get("/api/artworks", async ({ request }) => {
    const database = readDatabase();
    const unavailable = await beforeRequest(database, request);
    if (unavailable) return unavailable;
    const params = new URL(request.url).searchParams;
    const filters: ArtworkFilters = {
      search: params.get("search") ?? "",
      category: params.get("category") ?? "",
      network: params.get("network") ?? "",
      listing: (params.get("listing") ?? "Todos os NFTs") as ArtworkFilters["listing"],
      minPrice: params.get("minPrice") ?? "0",
      maxPrice: params.get("maxPrice") ?? "12.3",
      sort: (params.get("sort") ?? "recent") as ArtworkFilters["sort"],
      page: Math.max(1, Number(params.get("page") ?? 1)),
    };
    let items = database.artworks.filter((artwork) => {
      const matchesSearch = artwork.name.toLocaleLowerCase("pt-BR").includes(filters.search.toLocaleLowerCase("pt-BR"));
      const matchesCategory = !filters.category || artwork.category === filters.category;
      const matchesNetwork = !filters.network || artwork.network === filters.network;
      const matchesListing = filters.listing === "Todos os NFTs" || artwork.listing === filters.listing;
      const matchesPrice = toUnits(artwork.price) >= toUnits(filters.minPrice) && toUnits(artwork.price) <= toUnits(filters.maxPrice);
      return matchesSearch && matchesCategory && matchesNetwork && matchesListing && matchesPrice;
    });
    if (filters.sort === "low") items = [...items].sort((a, b) => toUnits(a.price) < toUnits(b.price) ? -1 : 1);
    if (filters.sort === "high") items = [...items].sort((a, b) => toUnits(a.price) > toUnits(b.price) ? -1 : 1);
    const total = items.length;
    const start = (filters.page - 1) * pageSize;
    return HttpResponse.json({ items: items.slice(start, start + pageSize), total, page: filters.page, pageSize });
  }),

  http.get("/api/artworks/:artworkId", async ({ params, request }) => {
    const database = readDatabase();
    const unavailable = await beforeRequest(database, request);
    if (unavailable) return unavailable;
    const artwork = getCurrentArtwork(database, String(params.artworkId));
    if (!artwork) return jsonError(404, "NFT_NOT_FOUND", "Este NFT não existe ou foi removido.");
    return HttpResponse.json(artwork);
  }),

  http.get("/api/favorites", async ({ request }) => {
    const database = readDatabase();
    const unavailable = await beforeRequest(database, request);
    if (unavailable) return unavailable;
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    return HttpResponse.json(database.favorites[auth.profile.id] ?? []);
  }),

  http.put("/api/favorites/:artworkId", async ({ params, request }) => {
    const database = readDatabase();
    const unavailable = await beforeRequest(database, request);
    if (unavailable) return unavailable;
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    const artworkId = String(params.artworkId);
    if (!getCurrentArtwork(database, artworkId)) return jsonError(404, "NFT_NOT_FOUND", "NFT não encontrado.");
    const favorites = database.favorites[auth.profile.id] ?? [];
    if (!favorites.includes(artworkId)) database.favorites[auth.profile.id] = [...favorites, artworkId];
    saveDatabase(database);
    return HttpResponse.json(database.favorites[auth.profile.id]);
  }),

  http.delete("/api/favorites/:artworkId", async ({ params, request }) => {
    const database = readDatabase();
    const unavailable = await beforeRequest(database, request);
    if (unavailable) return unavailable;
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    database.favorites[auth.profile.id] = (database.favorites[auth.profile.id] ?? []).filter((id) => id !== String(params.artworkId));
    saveDatabase(database);
    return HttpResponse.json(database.favorites[auth.profile.id]);
  }),

  http.get("/api/cart", ({ request }) => {
    const database = readDatabase();
    const ownerId = userCartKey(database, request);
    if (!ownerId) return jsonError(400, "GUEST_REQUIRED", "Identificador do visitante não informado.");
    const cart = safeCart(database, ownerId);
    return cart instanceof Response ? cart : HttpResponse.json(cart);
  }),

  http.post("/api/cart/items", async ({ request }) => {
    const database = readDatabase();
    const unavailable = await beforeRequest(database, request);
    if (unavailable) return unavailable;
    const ownerId = userCartKey(database, request);
    if (!ownerId) return jsonError(400, "GUEST_REQUIRED", "Identificador do visitante não informado.");
    const { artworkId, quantity } = await readJson<{ artworkId: string; quantity: number }>(request);
    const artwork = getCurrentArtwork(database, artworkId);
    if (!artwork) return jsonError(404, "NFT_NOT_FOUND", "NFT não encontrado.");
    if (!Number.isSafeInteger(quantity) || quantity < 1) return jsonError(422, "INVALID_QUANTITY", "Informe uma quantidade válida.");
    if (quantity > artwork.available) return jsonError(409, "SOLD_OUT", "A quantidade solicitada não está disponível.");
    const cart = database.carts[ownerId] ?? [];
    const item = cart.find((current) => current.artwork.id === artwork.id);
    if ((item?.quantity ?? 0) + quantity > artwork.available) return jsonError(409, "SOLD_OUT", "A edição não tem unidades suficientes.");
    if (item) item.quantity += quantity;
    else cart.push({ artwork, quantity });
    database.carts[ownerId] = cart;
    const version = nextCartVersion(database, ownerId);
    saveDatabase(database);
    return HttpResponse.json({ items: hydratedCart(database, ownerId).items, version });
  }),

  http.patch("/api/cart/items/:artworkId", async ({ params, request }) => {
    const database = readDatabase();
    const ownerId = userCartKey(database, request);
    if (!ownerId) return jsonError(400, "GUEST_REQUIRED", "Identificador do visitante não informado.");
    const { quantity } = await readJson<{ quantity: number }>(request);
    const artworkId = String(params.artworkId);
    const cart = database.carts[ownerId] ?? [];
    const item = cart.find((entry) => entry.artwork.id === artworkId);
    const artwork = getCurrentArtwork(database, artworkId);
    if (!item || !artwork) return jsonError(404, "CART_ITEM_NOT_FOUND", "Este item não está no carrinho.");
    if (!Number.isSafeInteger(quantity) || quantity < 1) return jsonError(422, "INVALID_QUANTITY", "Informe uma quantidade válida.");
    if (quantity > artwork.available) return jsonError(409, "SOLD_OUT", "A quantidade solicitada não está disponível.");
    item.quantity = quantity;
    const version = nextCartVersion(database, ownerId);
    saveDatabase(database);
    return HttpResponse.json({ items: hydratedCart(database, ownerId).items, version });
  }),

  http.delete("/api/cart/items/:artworkId", ({ params, request }) => {
    const database = readDatabase();
    const ownerId = userCartKey(database, request);
    if (!ownerId) return jsonError(400, "GUEST_REQUIRED", "Identificador do visitante não informado.");
    database.carts[ownerId] = (database.carts[ownerId] ?? []).filter((item) => item.artwork.id !== String(params.artworkId));
    const version = nextCartVersion(database, ownerId);
    saveDatabase(database);
    return HttpResponse.json({ items: hydratedCart(database, ownerId).items, version });
  }),

  http.post("/api/cart/merge", async ({ request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    const { items } = await readJson<{ items: Array<{ artworkId: string; quantity: number }> }>(request);
    const cart = database.carts[auth.profile.id] ?? [];
    for (const guestItem of items) {
      const artwork = getCurrentArtwork(database, guestItem.artworkId);
      if (!artwork) continue;
      const existing = cart.find((item) => item.artwork.id === artwork.id);
      const quantity = Math.min(artwork.available, (existing?.quantity ?? 0) + Math.max(0, Math.floor(guestItem.quantity)));
      if (quantity === 0) continue;
      if (existing) existing.quantity = quantity;
      else cart.push({ artwork, quantity });
    }
    database.carts[auth.profile.id] = cart;
    database.carts[`guest:${getGuestId(request)}`] = [];
    const version = nextCartVersion(database, auth.profile.id);
    saveDatabase(database);
    return HttpResponse.json({ items: hydratedCart(database, auth.profile.id).items, version });
  }),

  http.post("/api/cart/quote", async ({ request }) => {
    const database = readDatabase();
    const unavailable = await beforeRequest(database, request);
    if (unavailable) return unavailable;
    const ownerId = userCartKey(database, request);
    if (!ownerId) return jsonError(400, "GUEST_REQUIRED", "Identificador do visitante não informado.");
    const { coupon } = await readJson<{ coupon: string }>(request);
    const normalizedCoupon = coupon.trim().toUpperCase();
    if (database.scenario.name === "coupon-invalid" || (normalizedCoupon && normalizedCoupon !== "KURIO10" && normalizedCoupon !== "EXPIRED")) {
      return jsonError(422, "INVALID_COUPON", "Este cupom não é válido.", { coupon: "Verifique o código do cupom." });
    }
    if (database.scenario.name === "coupon-expired" || normalizedCoupon === "EXPIRED") {
      return jsonError(410, "EXPIRED_COUPON", "Este cupom expirou.", { coupon: "O período de utilização acabou." });
    }
    const cart = safeCart(database, ownerId);
    if (cart instanceof Response) return cart;
    if (cart.items.some((item) => item.quantity > item.artwork.available || item.artwork.available === 0)) {
      return jsonError(409, "AVAILABILITY_CHANGED", "A disponibilidade de um NFT mudou.");
    }
    const quote = quoteCart(database, ownerId, cart.items, normalizedCoupon, cart.version);
    saveDatabase(database);
    return HttpResponse.json(quote);
  }),

  http.get("/api/profile", ({ request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    return HttpResponse.json(auth.profile);
  }),

  http.patch("/api/profile", async ({ request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    const changes = await readJson<Pick<CollectorProfile, "name" | "email" | "avatar">>(request);
    const fields: Record<string, string> = {};
    if (changes.name.trim().length < 2) fields.name = "Informe seu nome.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) fields.email = "Informe um e-mail válido.";
    if (database.accounts.some((account) => account.email.toLowerCase() === changes.email.trim().toLowerCase() && account.id !== auth.profile.id)) {
      fields.email = "Este e-mail já pertence a outra conta.";
    }
    if (Object.keys(fields).length) return jsonError(422, "VALIDATION_ERROR", "Revise os campos informados.", fields);
    auth.profile.name = changes.name.trim();
    auth.profile.email = changes.email.trim().toLowerCase();
    auth.profile.avatar = changes.avatar;
    const account = database.accounts.find((item) => item.id === auth.profile.id);
    if (!account) return jsonError(404, "ACCOUNT_NOT_FOUND", "Conta não encontrada.");
    account.email = auth.profile.email;
    saveDatabase(database);
    return HttpResponse.json(auth.profile);
  }),

  http.patch("/api/profile/password", async ({ request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    const { currentPassword, newPassword } = await readJson<{ currentPassword: string; newPassword: string }>(request);
    const account = database.accounts.find((item) => item.id === auth.profile.id);
    if (!account) return jsonError(404, "ACCOUNT_NOT_FOUND", "Conta não encontrada.");
    if (account.passwordHash !== await hashPassword(currentPassword)) {
      return jsonError(422, "VALIDATION_ERROR", "A senha atual está incorreta.", { currentPassword: "Confira sua senha atual." });
    }
    if (newPassword.length < 8) return jsonError(422, "VALIDATION_ERROR", "A nova senha precisa de pelo menos 8 caracteres.", { newPassword: "Use pelo menos 8 caracteres." });
    account.passwordHash = await hashPassword(newPassword);
    saveDatabase(database);
    return HttpResponse.json({ updated: true });
  }),

  http.get("/api/wallets", ({ request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    return HttpResponse.json(database.wallets[auth.profile.id] ?? []);
  }),

  http.post("/api/wallets", async ({ request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    const candidate = await readJson<Omit<Wallet, "id">>(request);
    const fields = walletErrors(candidate);
    if (Object.keys(fields).length) return jsonError(422, "VALIDATION_ERROR", "Revise os dados da carteira.", fields);
    const wallets = database.wallets[auth.profile.id] ?? [];
    if (wallets.some((wallet) => wallet.address.toLowerCase() === candidate.address.toLowerCase())) {
      return jsonError(409, "WALLET_EXISTS", "Esta carteira já está cadastrada.", { address: "Informe outro endereço." });
    }
    const wallet: Wallet = { ...candidate, id: crypto.randomUUID(), primary: candidate.primary || wallets.length === 0 };
    database.wallets[auth.profile.id] = wallet.primary
      ? [...wallets.map((item) => ({ ...item, primary: false })), wallet]
      : [...wallets, wallet];
    saveDatabase(database);
    return HttpResponse.json(wallet, { status: 201 });
  }),

  http.patch("/api/wallets/:walletId", async ({ params, request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    const wallets = database.wallets[auth.profile.id] ?? [];
    const current = wallets.find((wallet) => wallet.id === String(params.walletId));
    if (!current) return jsonError(404, "WALLET_NOT_FOUND", "Carteira não encontrada.");
    const changes = await readJson<Partial<Wallet>>(request);
    const updated = { ...current, ...changes };
    const fields = walletErrors(updated);
    if (Object.keys(fields).length) return jsonError(422, "VALIDATION_ERROR", "Revise os dados da carteira.", fields);
    if (wallets.some((wallet) => wallet.id !== current.id && wallet.address.toLowerCase() === updated.address.toLowerCase())) {
      return jsonError(409, "WALLET_EXISTS", "Esta carteira já está cadastrada.", { address: "Informe outro endereço." });
    }
    database.wallets[auth.profile.id] = wallets.map((wallet) => ({
      ...wallet,
      ...(updated.primary ? { primary: false } : {}),
      ...(wallet.id === current.id ? updated : {}),
    }));
    saveDatabase(database);
    return HttpResponse.json(updated);
  }),

  http.delete("/api/wallets/:walletId", ({ params, request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    const wallets = database.wallets[auth.profile.id] ?? [];
    const wallet = wallets.find((item) => item.id === String(params.walletId));
    if (!wallet) return jsonError(404, "WALLET_NOT_FOUND", "Carteira não encontrada.");
    if (wallet.primary && wallets.length > 1) return jsonError(409, "PRIMARY_WALLET_REQUIRED", "Escolha outra carteira principal antes de remover esta.");
    database.wallets[auth.profile.id] = wallets.filter((item) => item.id !== wallet.id);
    saveDatabase(database);
    return HttpResponse.json({ removed: true });
  }),

  http.post("/api/wallets/:walletId/connection", async ({ params, request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    const wallet = (database.wallets[auth.profile.id] ?? []).find((item) => item.id === String(params.walletId));
    if (!wallet) return jsonError(404, "WALLET_NOT_FOUND", "Carteira não encontrada.");
    const { action } = await readJson<{ action: "connect" | "refuse" | "disconnect" }>(request);
    if (action === "refuse" || database.scenario.name === "wallet-refused") {
      return jsonError(422, "WALLET_CONNECTION_REFUSED", "A conexão da carteira foi recusada.");
    }
    return HttpResponse.json({ status: action === "disconnect" ? "disconnected" : "connected" });
  }),

  http.get("/api/orders", ({ request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    return HttpResponse.json(Object.values(database.orders).filter((order) => order.ownerId === auth.profile.id));
  }),

  http.get("/api/orders/by-idempotency-key", ({ request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    const key = new URL(request.url).searchParams.get("key") ?? "";
    const entry = database.idempotency[`${auth.profile.id}:${key}`];
    return HttpResponse.json(entry ? database.orders[entry.orderId] : null);
  }),

  http.post("/api/orders", async ({ request }) => {
    const database = readDatabase();
    const unavailable = await beforeRequest(database, request);
    if (unavailable) return unavailable;
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) return jsonError(400, "IDEMPOTENCY_KEY_REQUIRED", "A chave de idempotência é obrigatória.");
    const payload = await readJson<{
      quoteId: string;
      walletId: string;
      network: string;
      collectorName: string;
      collectorEmail: string;
      items: Array<{ artworkId: string; quantity: number }>;
      coupon: string;
    }>(request);
    if (payload.collectorName.trim().length < 2) {
      return jsonError(422, "VALIDATION_ERROR", "Informe seu nome.", { collectorName: "Informe seu nome." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.collectorEmail.trim())) {
      return jsonError(422, "VALIDATION_ERROR", "Informe um e-mail válido.", { collectorEmail: "Informe um e-mail válido." });
    }
    const fingerprint = orderFingerprint(payload);
    const key = `${auth.profile.id}:${idempotencyKey}`;
    const previous = database.idempotency[key];
    if (previous) {
      if (previous.fingerprint !== fingerprint) return jsonError(409, "IDEMPOTENCY_CONFLICT", "Esta chave já foi utilizada em outra compra.");
      const existingOrder = database.orders[previous.orderId];
      return existingOrder ? HttpResponse.json(existingOrder) : jsonError(500, "ORDER_SNAPSHOT_MISSING", "O comprovante deste pedido não foi encontrado.");
    }
    const quoteRecord = database.quotes[payload.quoteId];
    if (!quoteRecord || quoteRecord.ownerId !== auth.profile.id) return jsonError(409, "QUOTE_EXPIRED", "A cotação expirou. Revise os valores antes de continuar.");
    const wallet = (database.wallets[auth.profile.id] ?? []).find((item) => item.id === payload.walletId);
    if (!wallet) return jsonError(422, "WALLET_REQUIRED", "Selecione uma carteira cadastrada.", { walletId: "Selecione uma carteira válida." });
    if (wallet.network !== payload.network) return jsonError(422, "NETWORK_MISMATCH", "Selecione uma carteira compatível com a rede.");

    const cart = safeCart(database, auth.profile.id);
    if (cart instanceof Response) return cart;
    const quote = quoteRecord.quote;
    const requestedItemsMatch = payload.items.length === quote.items.length && payload.items.every((item) =>
      quote.items.some((quoted) => quoted.artwork.id === item.artworkId && quoted.quantity === item.quantity),
    );
    if (database.scenario.name === "price-changed" || database.scenario.name === "edition-sold-out") {
      const changedItem = quote.items[0];
      const changedArtwork = changedItem && getCurrentArtwork(database, changedItem.artwork.id);
      if (changedArtwork) {
        if (database.scenario.name === "price-changed") changedArtwork.price = addEth(changedArtwork.price, "0.1");
        else changedArtwork.available = 0;
        changedArtwork.version += 1;
      }
      database.scenario.name = "default";
      saveDatabase(database);
    }
    const currentItemsMatch = quote.items.every((quoted) => {
      const current = getCurrentArtwork(database, quoted.artwork.id);
      const currentCartItem = cart.items.find((item) => item.artwork.id === quoted.artwork.id);
      return current &&
        current.version === quoted.artwork.version &&
        current.price === quoted.artwork.price &&
        current.available >= quoted.quantity &&
        currentCartItem?.quantity === quoted.quantity;
    });
    if (
      !requestedItemsMatch ||
      !currentItemsMatch ||
      cart.version !== quote.version
    ) {
      return jsonError(409, "QUOTE_STALE", "Preço ou disponibilidade mudou. Revise e confirme a nova cotação.");
    }
    if (database.scenario.name === "payment-timeout") return Response.error();

    const orderId = crypto.randomUUID();
    const status = database.scenario.name === "payment-pending"
      ? "pending"
      : database.scenario.paymentOutcome;
    const order: OrderReceipt = {
      id: orderId,
      idempotencyKey,
      ownerId: auth.profile.id,
      status,
      items: quote.items.map((item) => ({ artwork: { ...item.artwork }, quantity: item.quantity })),
      subtotal: quote.subtotal,
      discount: quote.discount,
      networkFee: quote.networkFee,
      total: quote.total,
      coupon: quote.coupon,
      transactionReference: `0x${crypto.randomUUID().replaceAll("-", "")}`,
      walletAddress: wallet.address,
      network: wallet.network,
      collectorName: payload.collectorName,
      collectorEmail: payload.collectorEmail,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    database.orders[order.id] = order;
    database.idempotency[key] = { fingerprint, orderId: order.id };
    database.scenario.timeoutConsumed = true;
    if (status === "confirmed") removePurchasedItems(database, auth.profile.id, order.items);
    saveDatabase(database);

    if (database.scenario.name === "checkout-timeout-once") {
      database.scenario.name = "default";
      saveDatabase(database);
      return Response.error();
    }
    return HttpResponse.json(order, { status: 201 });
  }),

  http.get("/api/orders/:orderId", ({ params, request }) => {
    const database = readDatabase();
    const auth = requireUser(database, request);
    if ("error" in auth) return auth.error;
    const order = database.orders[String(params.orderId)];
    if (!order || order.ownerId !== auth.profile.id) return jsonError(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
    return HttpResponse.json(order);
  }),
];

function walletErrors(wallet: Pick<Wallet, "name" | "address" | "network">) {
  const fields: Record<string, string> = {};
  if (wallet.name.trim().length < 2) fields.name = "Informe um nome para a carteira.";
  if (!/^0x[a-fA-F0-9.]{6,}$/.test(wallet.address)) fields.address = "Informe um endereço de carteira válido.";
  if (!["Ethereum", "Polygon", "Solana"].includes(wallet.network)) fields.network = "Selecione uma rede suportada.";
  return fields;
}
