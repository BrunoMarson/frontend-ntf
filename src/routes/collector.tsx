import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { AxiosError } from "axios";
import { ArrowLeft, CheckCircle2, CircleAlert, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  changePassword,
  connectWallet,
  createOrder,
  recoverPendingOrder,
  removeCartItem,
  removeWallet,
  saveWallet,
  updateCartItem,
  updateProfile,
} from "../api/client";
import {
  cartQuery,
  cartQuoteQuery,
  orderQuery,
  ordersQuery,
  profileQuery,
  sessionQuery,
  walletsQuery,
} from "../api/query";
import { PENDING_ORDER_STORAGE_KEY } from "../lib/storage-keys";
import { formatEth, multiplyEth } from "../lib/eth";
import { artworkImages } from "../lib/artwork-images";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { RouteError, RouteLoading, RoutePage } from "../components/route-header";
import type { Cart, CartQuote, CollectorProfile, OrderReceipt, Wallet } from "../types/artwork";

interface ApiErrorBody {
  code?: string;
  message?: string;
  fields?: Record<string, string>;
}

function errorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    return body?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

function apiFieldErrors(error: unknown) {
  if (!(error instanceof AxiosError)) return {};
  const body = error.response?.data as ApiErrorBody | undefined;
  return body?.fields ?? {};
}

function useCurrentUserId() {
  const { data: session } = useQuery(sessionQuery);
  return session?.user.id ?? "";
}

function ArtworkLine({
  artwork,
  quantity,
  onChange,
  onRemove,
  busy,
}: {
  artwork: Cart["items"][number]["artwork"];
  quantity: number;
  onChange: (quantity: number) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <article className="cart-line">
      <img src={artwork.image} alt="" />
      <div className="cart-line-copy">
        <Link to="/nft/$artworkId" params={{ artworkId: artwork.id }} className="cart-artwork-name">{artwork.name}</Link>
        <span>{artwork.network} · {formatEth(artwork.price)}</span>
        {quantity > artwork.available && <span className="field-error">Disponibilidade atual: {artwork.available}</span>}
      </div>
      <label className="cart-quantity">
        <span className="sr-only">Quantidade de {artwork.name}</span>
        <Button type="button" variant="outline" size="sm" disabled={busy || quantity <= 1} aria-label={`Diminuir quantidade de ${artwork.name}`} onClick={() => onChange(quantity - 1)}>−</Button>
        <output>{quantity}</output>
        <Button type="button" variant="outline" size="sm" disabled={busy || quantity >= artwork.available} aria-label={`Aumentar quantidade de ${artwork.name}`} onClick={() => onChange(quantity + 1)}>+</Button>
      </label>
      <strong className="cart-line-total">{formatEth(multiplyEth(artwork.price, quantity))}</strong>
      <Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={`Remover ${artwork.name}`} onClick={onRemove}>
        <Trash2 aria-hidden="true" />
      </Button>
    </article>
  );
}

export function CartPage() {
  const queryClient = useQueryClient();
  const { data: cart, isPending, isError, error, refetch } = useQuery(cartQuery);
  const [couponDraft, setCouponDraft] = useState("");
  const [coupon, setCoupon] = useState(() => sessionStorage.getItem("kurio.cart.coupon.v1") ?? "");
  const [message, setMessage] = useState("");
  const cartMutation = useMutation({
    mutationFn: async (change: { artworkId: string; quantity?: number; remove?: boolean }) =>
      change.remove
        ? removeCartItem(change.artworkId)
        : updateCartItem(change.artworkId, change.quantity ?? 1),
    onSuccess: async (nextCart) => {
      queryClient.setQueryData(cartQuery.queryKey, nextCart);
      await queryClient.invalidateQueries({ queryKey: ["cart-quote"] });
      setMessage("");
    },
    onError: (mutationError) => setMessage(errorMessage(mutationError)),
  });
  const quote = useQuery({
    ...cartQuoteQuery(coupon),
    enabled: Boolean(cart?.items.length),
  });
  function applyCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = couponDraft.trim().toUpperCase();
    setCoupon(normalized);
    sessionStorage.setItem("kurio.cart.coupon.v1", normalized);
    setMessage("");
  }

  if (isPending) return (
    <RoutePage title="Seu carrinho">
      <div className="cart-layout" role="status" aria-label="Carregando carrinho" aria-busy="true">
        <div className="cart-items">
          {Array.from({ length: 3 }, (_, index) => <div className="cart-line cart-line-skeleton" key={index}>
            <span className="skeleton skeleton-image" />
            <div className="cart-line-copy"><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line short" /></div>
            <span className="skeleton skeleton-line" />
          </div>)}
        </div>
        <Card className="quote-card"><CardContent>
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line short" />
          <span className="skeleton skeleton-line" />
        </CardContent></Card>
      </div>
    </RoutePage>
  );
  if (isError) return <RoutePage title="Seu carrinho"><RouteError message={errorMessage(error)} /><Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></RoutePage>;

  const unavailable = cart.items.some((item) => item.quantity > item.artwork.available || item.artwork.available === 0);
  const totalCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <RoutePage title={`Seu carrinho (${totalCount})`}>
      {!cart.items.length ? (
        <Card><CardContent className="route-empty">
          <h2>Seu carrinho está vazio</h2>
          <p>Explore o mercado e encontre uma obra para sua coleção.</p>
          <Button asChild><Link to="/">Explorar NFTs</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="cart-layout">
          <section className="cart-items" aria-label="Itens do carrinho">
            {cart.items.map((item) => (
              <ArtworkLine
                key={item.artwork.id}
                artwork={item.artwork}
                quantity={item.quantity}
                busy={cartMutation.isPending}
                onChange={(quantity) => cartMutation.mutate({ artworkId: item.artwork.id, quantity })}
                onRemove={() => cartMutation.mutate({ artworkId: item.artwork.id, remove: true })}
              />
            ))}
            <Button asChild variant="ghost"><Link to="/"><ArrowLeft aria-hidden="true" /> Continuar comprando</Link></Button>
          </section>
          <Card className="quote-card">
            <CardContent>
              <h2>Resumo do pedido</h2>
              <form className="coupon-form" onSubmit={applyCoupon}>
                <label htmlFor="cart-coupon">Cupom de desconto</label>
                <div>
                  <Input id="cart-coupon" value={couponDraft} onChange={(event) => setCouponDraft(event.target.value)} placeholder="Digite seu cupom" />
                  <Button type="submit" variant="outline">Aplicar</Button>
                </div>
                {coupon && <Button type="button" variant="ghost" size="sm" onClick={() => {
                  setCoupon("");
                  setCouponDraft("");
                  sessionStorage.removeItem("kurio.cart.coupon.v1");
                }}>Remover cupom ({coupon})</Button>}
              </form>
              {quote.isPending && <div role="status" aria-label="Atualizando cotação"><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line" /></div>}
              {quote.isError && <><RouteError message={errorMessage(quote.error)} /><Button type="button" variant="outline" onClick={() => void quote.refetch()}>Tentar nova cotação</Button></>}
              {quote.data && <QuoteSummary quote={quote.data} />}
              {unavailable && <RouteError message="A quantidade de uma edição mudou. Ajuste os itens antes de continuar." />}
              {message && <RouteError message={message} />}
              {!quote.data || quote.isError || unavailable || cartMutation.isPending
                ? <Button type="button" className="checkout-button" disabled>Ir para o pagamento</Button>
                : <Button asChild className="checkout-button"><Link to="/checkout">Ir para o pagamento</Link></Button>}
              <p className="small-note">A cotação é confirmada novamente antes do pagamento.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </RoutePage>
  );
}

function QuoteSummary({ quote }: { quote: Pick<CartQuote, "subtotal" | "discount" | "networkFee" | "total"> }) {
  return (
    <dl className="quote-summary">
      <div><dt>Subtotal</dt><dd>{formatEth(quote.subtotal)}</dd></div>
      <div><dt>Desconto</dt><dd>− {formatEth(quote.discount)}</dd></div>
      <div><dt>Taxa de rede</dt><dd>{formatEth(quote.networkFee)}</dd></div>
      <div className="quote-total"><dt>Total</dt><dd>{formatEth(quote.total)}</dd></div>
    </dl>
  );
}

interface SavedPendingOrder {
  quoteId: string;
  key: string;
}

function readPendingOrder(): SavedPendingOrder | undefined {
  const value = localStorage.getItem(PENDING_ORDER_STORAGE_KEY);
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed && typeof parsed === "object" &&
      "quoteId" in parsed && typeof parsed.quoteId === "string" &&
      "key" in parsed && typeof parsed.key === "string"
    ) return parsed as SavedPendingOrder;
  } catch {
    localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  }
  return undefined;
}

export function CheckoutPage() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: cart, isPending: cartPending, isError: cartError, error: cartQueryError, refetch: refetchCart } = useQuery(cartQuery);
  const { data: profile, isPending: profilePending, isError: profileError, error: profileQueryError, refetch: refetchProfile } = useQuery({
    ...profileQuery(userId),
    enabled: Boolean(userId),
  });
  const { data: wallets = [], isPending: walletsPending, isError: walletsError, error: walletsQueryError, refetch: refetchWallets } = useQuery({
    ...walletsQuery(userId),
    enabled: Boolean(userId),
  });
  const [coupon] = useState(() => sessionStorage.getItem("kurio.cart.coupon.v1") ?? "");
  const quote = useQuery({
    ...cartQuoteQuery(coupon),
    enabled: Boolean(cart?.items.length),
  });
  const [pendingAttempt] = useState(readPendingOrder);
  const pendingRecovery = useQuery({
    queryKey: ["pending-order", userId, pendingAttempt?.key] as const,
    queryFn: () => recoverPendingOrder(pendingAttempt?.key ?? ""),
    enabled: Boolean(userId && pendingAttempt),
    retry: false,
  });
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [connectedWalletId, setConnectedWalletId] = useState("");
  const [collectorName, setCollectorName] = useState("");
  const [collectorEmail, setCollectorEmail] = useState("");
  const [acknowledgedQuote, setAcknowledgedQuote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [connectionMessage, setConnectionMessage] = useState("");

  useEffect(() => {
    if (profile) {
      setCollectorName(profile.name);
      setCollectorEmail(profile.email);
    }
  }, [profile]);
  useEffect(() => {
    if (!selectedWalletId && wallets.length) {
      setSelectedWalletId(wallets.find((wallet) => wallet.primary)?.id ?? wallets[0].id);
    }
  }, [selectedWalletId, wallets]);

  const selectedWallet = wallets.find((wallet) => wallet.id === selectedWalletId);
  const availabilityChanged = Boolean(cart?.items.some((item) =>
    item.artwork.available < item.quantity || item.artwork.available === 0,
  ));
  const connectionMutation = useMutation({
    mutationFn: ({ walletId, action }: { walletId: string; action: "connect" | "disconnect" }) =>
      connectWallet(walletId, action),
    onSuccess: async (result, variables) => {
      setConnectedWalletId(result.status === "connected" ? variables.walletId : "");
      setConnectionMessage(result.status === "connected"
        ? "Carteira conectada para esta sessão."
        : "Carteira desconectada.");
      await queryClient.invalidateQueries({ queryKey: walletsQuery(userId).queryKey });
    },
    onError: (error) => {
      setConnectedWalletId("");
      setConnectionMessage(errorMessage(error));
    },
  });
  const orderMutation = useMutation({
    mutationFn: async (values: { quote: CartQuote; wallet: Wallet; name: string; email: string }) => {
      const request = {
        quoteId: values.quote.quoteId,
        walletId: values.wallet.id,
        network: values.wallet.network,
        collectorName: values.name.trim(),
        collectorEmail: values.email.trim(),
        items: values.quote.items.map((item) => ({ artworkId: item.artwork.id, quantity: item.quantity })),
        coupon: values.quote.coupon,
      };
      let attempt = readPendingOrder();
      if (!attempt || attempt.quoteId !== values.quote.quoteId) {
        attempt = { quoteId: values.quote.quoteId, key: crypto.randomUUID() };
        localStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify(attempt));
      }
      const recovered = await recoverPendingOrder(attempt.key);
      if (recovered) return recovered;
      try {
        return await createOrder(request, attempt.key);
      } catch (requestError) {
        const recoveredAfterTimeout = await recoverPendingOrder(attempt.key);
        if (recoveredAfterTimeout) return recoveredAfterTimeout;
        throw requestError;
      }
    },
    onSuccess: async (order) => {
      localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
      await queryClient.invalidateQueries({ queryKey: cartQuery.queryKey });
      await navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
    },
    onError: async (error) => {
      setFieldErrors(apiFieldErrors(error));
      const code = error instanceof AxiosError
        ? (error.response?.data as ApiErrorBody | undefined)?.code
        : undefined;
      if (code === "QUOTE_STALE" || code === "QUOTE_EXPIRED" || code === "AVAILABILITY_CHANGED") {
        setAcknowledgedQuote("");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: cartQuery.queryKey }),
          queryClient.invalidateQueries({ queryKey: ["cart-quote"] }),
          queryClient.invalidateQueries({ queryKey: ["artworks"] }),
          queryClient.invalidateQueries({ queryKey: ["artwork"] }),
        ]);
      }
    },
  });

  useEffect(() => {
    const order = pendingRecovery.data;
    if (!order) return;
    localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
    void navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
  }, [navigate, pendingRecovery.data]);

  function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    if (!quote.data || !selectedWallet) return;
    if (connectedWalletId !== selectedWallet.id) {
      setConnectionMessage("Conecte a carteira selecionada antes de pagar.");
      return;
    }
    if (acknowledgedQuote !== quote.data.quoteId) {
      setConnectionMessage("Revise e confirme a cotação atual antes de pagar.");
      return;
    }
    const validation: Record<string, string> = {};
    if (collectorName.trim().length < 2) validation.collectorName = "Informe seu nome.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(collectorEmail.trim())) validation.collectorEmail = "Informe um e-mail válido.";
    if (Object.keys(validation).length) {
      setFieldErrors(validation);
      return;
    }
    orderMutation.mutate({ quote: quote.data, wallet: selectedWallet, name: collectorName, email: collectorEmail });
  }

  if (cartPending || profilePending || walletsPending) return <RoutePage title="Pagamento"><RouteLoading label="Preparando pagamento" /></RoutePage>;
  if (cartError || profileError || walletsError) {
    const failedQuery = cartError
      ? { message: errorMessage(cartQueryError), retry: refetchCart }
      : profileError
        ? { message: errorMessage(profileQueryError), retry: refetchProfile }
        : { message: errorMessage(walletsQueryError), retry: refetchWallets };
    return <RoutePage title="Pagamento"><RouteError message={failedQuery.message} /><Button variant="outline" onClick={() => void failedQuery.retry()}>Tentar novamente</Button></RoutePage>;
  }
  if (!cart?.items.length) {
    return <RoutePage title="Pagamento"><Card><CardContent className="route-empty">
      <p>Seu carrinho está vazio.</p><Button asChild><Link to="/"><ArrowLeft aria-hidden="true" /> Voltar ao mercado</Link></Button>
    </CardContent></Card></RoutePage>;
  }

  return (
    <RoutePage title="Finalizar compra">
      <Link to="/cart" className="back-link"><ArrowLeft aria-hidden="true" /> Voltar ao carrinho</Link>
      <form className="checkout-layout" onSubmit={submitPayment}>
        <div className="checkout-main">
          <Card><CardContent className="checkout-section">
            <h2>Dados do colecionador</h2>
            <label htmlFor="collector-name">Nome completo</label>
            <Input id="collector-name" autoComplete="name" value={collectorName} onChange={(event) => setCollectorName(event.target.value)} aria-invalid={Boolean(fieldErrors.collectorName)} aria-describedby={fieldErrors.collectorName ? "collector-name-error" : undefined} />
            {fieldErrors.collectorName && <span className="field-error" id="collector-name-error">{fieldErrors.collectorName}</span>}
            <label htmlFor="collector-email">E-mail para o recibo</label>
            <Input id="collector-email" type="email" autoComplete="email" value={collectorEmail} onChange={(event) => setCollectorEmail(event.target.value)} aria-invalid={Boolean(fieldErrors.collectorEmail)} aria-describedby={fieldErrors.collectorEmail ? "collector-email-error" : undefined} />
            {fieldErrors.collectorEmail && <span className="field-error" id="collector-email-error">{fieldErrors.collectorEmail}</span>}
          </CardContent></Card>
          <Card><CardContent className="checkout-section">
            <div className="section-title-row"><h2>Carteira e rede</h2><Button asChild type="button" variant="outline" size="sm"><Link to="/wallets"><Plus aria-hidden="true" /> Gerenciar carteiras</Link></Button></div>
            {!wallets.length ? (
              <p>Cadastre uma carteira antes de continuar.</p>
            ) : (
              <>
                <label htmlFor="checkout-wallet">Carteira</label>
                <select id="checkout-wallet" value={selectedWalletId} onChange={(event) => {
                  setSelectedWalletId(event.target.value);
                  setConnectedWalletId("");
                  setConnectionMessage("");
                }}>
                  {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.network}{wallet.primary ? " · principal" : ""}</option>)}
                </select>
                {selectedWallet && <p className="wallet-address">{selectedWallet.address}</p>}
                <Button type="button" variant="outline" disabled={!selectedWallet || connectionMutation.isPending} onClick={() => selectedWallet && connectionMutation.mutate({
                  walletId: selectedWallet.id,
                  action: connectedWalletId === selectedWallet.id ? "disconnect" : "connect",
                })}>
                  {connectionMutation.isPending ? "Atualizando conexão..." : connectedWalletId === selectedWallet?.id ? "Desconectar carteira" : "Conectar carteira"}
                </Button>
              </>
            )}
            {connectionMessage && <p className="live-feedback" role="status">{connectionMessage}</p>}
            {fieldErrors.walletId && <RouteError message={fieldErrors.walletId} />}
          </CardContent></Card>
          <Card><CardContent className="checkout-section">
            <h2>Confirme sua cotação</h2>
            {quote.isPending && <div role="status" aria-label="Atualizando preços e disponibilidade"><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line short" /></div>}
            {quote.isError && <><RouteError message={errorMessage(quote.error)} /><Button type="button" variant="outline" onClick={() => void quote.refetch()}>Tentar nova cotação</Button></>}
            {quote.data && <>
              <QuoteSummary quote={quote.data} />
              <label className="quote-confirmation">
                <input
                  type="checkbox"
                  checked={acknowledgedQuote === quote.data.quoteId}
                  onChange={(event) => {
                    setAcknowledgedQuote(event.target.checked ? quote.data.quoteId : "");
                    if (event.target.checked) orderMutation.reset();
                  }}
                />
                Revisei os valores e a disponibilidade desta cotação.
              </label>
              {acknowledgedQuote && acknowledgedQuote !== quote.data.quoteId && (
                <p className="stale-quote" role="alert">A cotação foi atualizada. Revise e confirme os novos valores.</p>
              )}
            </>}
            {availabilityChanged && <RouteError message="A disponibilidade mudou. Volte ao carrinho para ajustar as quantidades." />}
            {fieldErrors.quoteId && <RouteError message={fieldErrors.quoteId} />}
            {orderMutation.isError && <RouteError message={errorMessage(orderMutation.error)} />}
            {pendingRecovery.isError && <>
              <RouteError message="Não foi possível verificar se o pedido anterior foi concluído. Tente recuperar antes de enviar outro pagamento." />
              <Button type="button" variant="outline" onClick={() => void pendingRecovery.refetch()}>Tentar recuperar pedido</Button>
            </>}
          </CardContent></Card>
        </div>
        <aside className="checkout-aside">
          <Card><CardContent>
            <h2>Seu pedido</h2>
            {cart.items.map((item) => <div className="checkout-line" key={item.artwork.id}>
              <span>{item.quantity} × {item.artwork.name}</span><strong>{formatEth(multiplyEth(item.artwork.price, item.quantity))}</strong>
            </div>)}
            {quote.data && <QuoteSummary quote={quote.data} />}
            <Button type="submit" className="checkout-button" disabled={
              !quote.data || quote.isFetching || !selectedWallet || wallets.length === 0 ||
              connectedWalletId !== selectedWallet?.id || acknowledgedQuote !== quote.data?.quoteId ||
              availabilityChanged || orderMutation.isPending || pendingRecovery.isFetching || pendingRecovery.isError
            }>
              {orderMutation.isPending ? <><LoaderCircle className="spin" aria-hidden="true" /> Processando...</> : "Pagar agora"}
            </Button>
            {!selectedWallet && wallets.length === 0 && <p className="small-note">Adicione uma carteira para continuar.</p>}
            {connectionMutation.isError && <p className="form-error" role="alert">{errorMessage(connectionMutation.error)}</p>}
          </CardContent></Card>
        </aside>
      </form>
    </RoutePage>
  );
}

export function OrderPage() {
  const userId = useCurrentUserId();
  const { orderId } = useParams({ from: "/_authenticated/orders/$orderId" });
  const { data: order, isPending, isError, error, refetch } = useQuery(orderQuery(orderId));
  const queryClient = useQueryClient();

  useEffect(() => {
    if (order && userId) void queryClient.invalidateQueries({ queryKey: ordersQuery(userId).queryKey });
  }, [order?.id, order?.status, order?.version, queryClient, userId]);

  if (isPending) return <RoutePage title="Comprovante"><RouteLoading label="Carregando pedido" /></RoutePage>;
  if (isError || !order) return <RoutePage title="Comprovante"><RouteError message={isError ? errorMessage(error) : "Pedido não encontrado."} /><Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></RoutePage>;

  const statusText = {
    pending: "Pagamento em processamento",
    confirmed: "Compra confirmada",
    declined: "Pagamento não aprovado",
  }[order.status];
  const StatusIcon = order.status === "confirmed" ? CheckCircle2 : CircleAlert;

  return (
    <RoutePage title="Comprovante do pedido">
      <Card className="receipt-card"><CardContent>
        <div className={`receipt-status ${order.status}`}>
          <StatusIcon aria-hidden="true" /><h2>{statusText}</h2>
        </div>
        {order.status === "pending" && <p role="status">Estamos aguardando a confirmação da rede. Esta página será atualizada automaticamente.</p>}
        {order.status === "declined" && <p>O pedido não foi concluído e os itens continuam no seu carrinho.</p>}
        <dl className="receipt-details">
          <div><dt>Número do pedido</dt><dd>{order.id}</dd></div>
          <div><dt>Data</dt><dd>{new Date(order.createdAt).toLocaleString("pt-BR")}</dd></div>
          <div><dt>Colecionador</dt><dd>{order.collectorName} · {order.collectorEmail}</dd></div>
          <div><dt>Carteira</dt><dd>{order.walletAddress} · {order.network}</dd></div>
          <div><dt>Referência da transação</dt><dd className="break-all">{order.transactionReference}</dd></div>
        </dl>
        <h3>Itens comprados</h3>
        {order.items.map((item) => <div className="checkout-line" key={item.artwork.id}>
          <span>{item.quantity} × {item.artwork.name}</span>
          <strong>{formatEth(multiplyEth(item.artwork.price, item.quantity))}</strong>
        </div>)}
        <QuoteSummary quote={order} />
        <div className="receipt-actions">
          {order.status === "pending" && <Button type="button" variant="outline" onClick={() => void refetch()}>Atualizar status</Button>}
          <Button asChild variant="outline"><Link to="/profile">Ver meus pedidos</Link></Button>
          <Button asChild><Link to="/">Voltar ao mercado</Link></Button>
        </div>
      </CardContent></Card>
    </RoutePage>
  );
}

export function ProfilePage() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const { data: profile, isPending, isError, error } = useQuery({
    ...profileQuery(userId),
    enabled: Boolean(userId),
  });
  const orders = useQuery({ ...ordersQuery(userId), enabled: Boolean(userId) });
  const [profileError, setProfileError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileFields, setProfileFields] = useState<Record<string, string>>({});
  const [passwordFields, setPasswordFields] = useState<Record<string, string>>({});
  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async (updatedProfile) => {
      queryClient.setQueryData(profileQuery(userId).queryKey, updatedProfile);
      queryClient.setQueryData(sessionQuery.queryKey, (session: { user: CollectorProfile; expiresAt: number } | null | undefined) =>
        session ? { ...session, user: updatedProfile } : session,
      );
      setProfileError("Perfil atualizado com sucesso.");
      setProfileFields({});
    },
    onError: (mutationError) => {
      setProfileError(errorMessage(mutationError));
      setProfileFields(apiFieldErrors(mutationError));
    },
  });
  const passwordMutation = useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) => changePassword(payload.currentPassword, payload.newPassword),
    onSuccess: () => {
      setPasswordMessage("Senha atualizada com sucesso.");
      setPasswordError("");
      setPasswordFields({});
    },
    onError: (mutationError) => {
      setPasswordError(errorMessage(mutationError));
      setPasswordFields(apiFieldErrors(mutationError));
    },
  });

  if (isPending) return <RoutePage title="Meu perfil"><RouteLoading label="Carregando perfil" /></RoutePage>;
  if (isError || !profile) return <RoutePage title="Meu perfil"><RouteError message={isError ? errorMessage(error) : "Perfil não encontrado."} /></RoutePage>;

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    updateMutation.mutate({
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      avatar: String(data.get("avatar") ?? profile?.avatar ?? ""),
    });
  }

  function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    passwordMutation.mutate({
      currentPassword: String(data.get("currentPassword") ?? ""),
      newPassword: String(data.get("newPassword") ?? ""),
    });
    event.currentTarget.reset();
  }

  return (
    <RoutePage title="Meu perfil">
      <div className="profile-layout">
        <Card><CardContent className="checkout-section">
          <h2>Dados da conta</h2>
          <form className="form-stack" onSubmit={saveProfile}>
            <label htmlFor="profile-name">Nome completo</label>
            <Input id="profile-name" name="name" defaultValue={profile.name} autoComplete="name" required minLength={2} aria-invalid={Boolean(profileFields.name)} aria-describedby={profileFields.name ? "profile-name-error" : undefined} />
            {profileFields.name && <span className="field-error" id="profile-name-error">{profileFields.name}</span>}
            <label htmlFor="profile-email">E-mail</label>
            <Input id="profile-email" name="email" type="email" defaultValue={profile.email} autoComplete="email" required aria-invalid={Boolean(profileFields.email)} aria-describedby={profileFields.email ? "profile-email-error" : undefined} />
            {profileFields.email && <span className="field-error" id="profile-email-error">{profileFields.email}</span>}
            <label htmlFor="profile-avatar">Avatar</label>
            <select id="profile-avatar" name="avatar" defaultValue={profile.avatar}>
              <option value={profile.avatar}>Manter avatar atual</option>
              <option value={artworkImages.emerald}>Emerald Ape</option>
              <option value={artworkImages.sage}>Sage Nomad</option>
              <option value={artworkImages.neon}>Neon Vessel</option>
              <option value={artworkImages.golden}>Golden Beat</option>
            </select>
            {profileError && <p className={updateMutation.isError ? "form-error" : "live-feedback"} role={updateMutation.isError ? "alert" : "status"}>{profileError}</p>}
            <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Salvando..." : "Salvar perfil"}</Button>
          </form>
        </CardContent></Card>
        <Card><CardContent className="checkout-section">
          <h2>Alterar senha</h2>
          <form className="form-stack" onSubmit={savePassword}>
            <label htmlFor="current-password">Senha atual</label>
            <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required aria-invalid={Boolean(passwordFields.currentPassword)} aria-describedby={passwordFields.currentPassword ? "current-password-error" : undefined} />
            {passwordFields.currentPassword && <span className="field-error" id="current-password-error">{passwordFields.currentPassword}</span>}
            <label htmlFor="new-password">Nova senha</label>
            <Input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={8} required aria-invalid={Boolean(passwordFields.newPassword)} aria-describedby={passwordFields.newPassword ? "new-password-error" : undefined} />
            {passwordFields.newPassword && <span className="field-error" id="new-password-error">{passwordFields.newPassword}</span>}
            {passwordError && <RouteError message={passwordError} />}
            {passwordMessage && <p className="live-feedback" role="status">{passwordMessage}</p>}
            <Button type="submit" disabled={passwordMutation.isPending}>{passwordMutation.isPending ? "Atualizando..." : "Atualizar senha"}</Button>
          </form>
        </CardContent></Card>
      </div>
      <section className="orders-section" aria-labelledby="orders-heading">
        <h2 id="orders-heading">Meus pedidos</h2>
        {orders.isPending && <p role="status">Carregando pedidos...</p>}
        {orders.isError && <RouteError message={errorMessage(orders.error)} />}
        {orders.data?.length === 0 && <p>Você ainda não fez nenhum pedido.</p>}
        {orders.data?.map((order) => <OrderListItem key={order.id} order={order} />)}
      </section>
    </RoutePage>
  );
}

function OrderListItem({ order }: { order: OrderReceipt }) {
  return (
    <Link className="order-list-item" to="/orders/$orderId" params={{ orderId: order.id }}>
      <span>{order.id.slice(0, 8)} · {new Date(order.createdAt).toLocaleDateString("pt-BR")}</span>
      <span className={`order-status ${order.status}`}>{order.status === "confirmed" ? "Confirmado" : order.status === "pending" ? "Pendente" : "Recusado"}</span>
      <strong>{formatEth(order.total)}</strong>
    </Link>
  );
}

const walletNetworks = ["Ethereum", "Polygon", "Solana"];

export function WalletsPage() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const { data: wallets = [], isPending, isError, error } = useQuery({
    ...walletsQuery(userId),
    enabled: Boolean(userId),
  });
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState(walletNetworks[0]);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNetwork, setEditNetwork] = useState(walletNetworks[0]);
  const invalidateWallets = () => queryClient.invalidateQueries({ queryKey: walletsQuery(userId).queryKey });
  const saveMutation = useMutation({
    mutationFn: saveWallet,
    onSuccess: async () => {
      setName("");
      setAddress("");
      setMessage("Carteira adicionada.");
      setFieldErrors({});
      await invalidateWallets();
    },
    onError: (mutationError) => {
      setMessage(errorMessage(mutationError));
      setFieldErrors(apiFieldErrors(mutationError));
    },
  });
  const removeMutation = useMutation({
    mutationFn: removeWallet,
    onSuccess: async () => {
      setMessage("Carteira removida.");
      await invalidateWallets();
    },
    onError: (mutationError) => setMessage(errorMessage(mutationError)),
  });
  const editMutation = useMutation({
    mutationFn: saveWallet,
    onSuccess: async () => {
      setEditingId("");
      setMessage("Carteira atualizada.");
      setFieldErrors({});
      await invalidateWallets();
    },
    onError: (mutationError) => {
      setMessage(errorMessage(mutationError));
      setFieldErrors(apiFieldErrors(mutationError));
    },
  });
  const primaryMutation = useMutation({
    mutationFn: (wallet: Wallet) => saveWallet({ ...wallet, primary: true }),
    onSuccess: async () => {
      setMessage("Carteira principal atualizada.");
      await invalidateWallets();
    },
    onError: (mutationError) => setMessage(errorMessage(mutationError)),
  });
  const walletMutationError = saveMutation.isError || editMutation.isError || removeMutation.isError || primaryMutation.isError;

  function submitWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    saveMutation.mutate({ name, address, network, primary: wallets.length === 0 });
  }

  function startEditing(wallet: Wallet) {
    setEditingId(wallet.id);
    setEditName(wallet.name);
    setEditAddress(wallet.address);
    setEditNetwork(wallet.network);
    setMessage("");
    setFieldErrors({});
  }

  function submitEdit(event: FormEvent<HTMLFormElement>, wallet: Wallet) {
    event.preventDefault();
    editMutation.mutate({
      ...wallet,
      name: editName,
      address: editAddress,
      network: editNetwork,
    });
  }

  if (isPending) return <RoutePage title="Minhas carteiras"><RouteLoading label="Carregando carteiras" /></RoutePage>;
  if (isError) return <RoutePage title="Minhas carteiras"><RouteError message={errorMessage(error)} /></RoutePage>;

  return (
    <RoutePage title="Minhas carteiras">
      <div className="wallet-layout">
        <section className="wallet-list" aria-label="Carteiras cadastradas">
          {!wallets.length && <Card><CardContent><p>Nenhuma carteira cadastrada.</p></CardContent></Card>}
          {wallets.map((wallet) => <Card key={wallet.id}><CardContent className="wallet-card">
            {editingId === wallet.id ? (
              <form className="wallet-edit-form" onSubmit={(event) => submitEdit(event, wallet)}>
                <label htmlFor={`wallet-edit-name-${wallet.id}`}>Nome</label>
                <Input id={`wallet-edit-name-${wallet.id}`} value={editName} onChange={(event) => setEditName(event.target.value)} required minLength={2} />
                <label htmlFor={`wallet-edit-address-${wallet.id}`}>Endereço</label>
                <Input id={`wallet-edit-address-${wallet.id}`} value={editAddress} onChange={(event) => setEditAddress(event.target.value)} required />
                {fieldErrors.address && <span className="field-error">{fieldErrors.address}</span>}
                <label htmlFor={`wallet-edit-network-${wallet.id}`}>Rede</label>
                <select id={`wallet-edit-network-${wallet.id}`} value={editNetwork} onChange={(event) => setEditNetwork(event.target.value)}>
                  {walletNetworks.map((option) => <option key={option}>{option}</option>)}
                </select>
                {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
                {fieldErrors.network && <span className="field-error">{fieldErrors.network}</span>}
                {message && !Object.keys(fieldErrors).length && <RouteError message={message} />}
                <div className="wallet-actions">
                  <Button type="submit" size="sm" disabled={editMutation.isPending}>{editMutation.isPending ? "Salvando..." : "Salvar"}</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId("")}>Cancelar</Button>
                </div>
              </form>
            ) : <div>
              <h2>{wallet.name} {wallet.primary && <span className="primary-label">Principal</span>}</h2>
              <p>{wallet.address}</p><span>{wallet.network}</span>
            </div>}
            <div className="wallet-actions">
              {editingId !== wallet.id && <Button type="button" variant="outline" size="sm" disabled={Boolean(editingId)} onClick={() => startEditing(wallet)} aria-label={`Editar ${wallet.name}`}><Pencil aria-hidden="true" />Editar</Button>}
              {!wallet.primary && <Button type="button" variant="outline" size="sm" disabled={primaryMutation.isPending} onClick={() => primaryMutation.mutate(wallet)}>Definir principal</Button>}
              <Button type="button" variant="ghost" size="icon" disabled={removeMutation.isPending || (wallet.primary && wallets.length > 1)} title={wallet.primary && wallets.length > 1 ? "Defina outra carteira principal antes de remover" : "Remover carteira"} aria-label={`Remover ${wallet.name}`} onClick={() => removeMutation.mutate(wallet.id)}><Trash2 aria-hidden="true" /></Button>
            </div>
          </CardContent></Card>)}
        </section>
        <Card><CardContent className="checkout-section">
          <h2>Adicionar carteira</h2>
          <form className="form-stack" onSubmit={submitWallet}>
            <label htmlFor="wallet-name">Nome</label>
            <Input id="wallet-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} aria-invalid={Boolean(fieldErrors.name)} />
            {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            <label htmlFor="wallet-address">Endereço</label>
            <Input id="wallet-address" value={address} onChange={(event) => setAddress(event.target.value)} required placeholder="0x..." aria-invalid={Boolean(fieldErrors.address)} />
            {fieldErrors.address && <span className="field-error">{fieldErrors.address}</span>}
            <label htmlFor="wallet-network">Rede</label>
            <select id="wallet-network" value={network} onChange={(event) => setNetwork(event.target.value)}>
              {walletNetworks.map((option) => <option key={option}>{option}</option>)}
            </select>
            {fieldErrors.network && <span className="field-error">{fieldErrors.network}</span>}
            {message && <p className={walletMutationError ? "form-error" : "live-feedback"} role={walletMutationError ? "alert" : "status"}>{message}</p>}
            <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Adicionar carteira"}</Button>
          </form>
        </CardContent></Card>
      </div>
    </RoutePage>
  );
}
