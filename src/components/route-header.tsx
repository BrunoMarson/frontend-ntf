import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, ShoppingCart } from "lucide-react";
import { useState, type PropsWithChildren, type ReactNode } from "react";
import { logout } from "../api/client";
import { cartQuery, sessionQuery } from "../api/query";
import { Button } from "./ui/button";

export function RouteHeader() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: session } = useQuery(sessionQuery);
  const { data: cart } = useQuery(cartQuery);
  const [logoutError, setLogoutError] = useState("");
  const itemCount = cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0;
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: "/" });
    },
    onError: (error) => setLogoutError(error instanceof Error ? error.message : "Não foi possível sair da conta."),
  });

  return (
    <header className="site-header page-shell">
      <Link className="wordmark" to="/">KURIO</Link>
      <nav className="route-nav" aria-label="Navegação principal">
        <Link to="/">Início</Link>
        <Link to="/cart">Carrinho</Link>
        {session && <Link to="/profile">Meu perfil</Link>}
        {session && <Link to="/wallets">Carteiras</Link>}
        {!session && <Link to="/login" search={{ redirect: "/" }}>Entrar</Link>}
      </nav>
      <div className="route-header-actions">
        <Button asChild variant="outline" size="sm">
          <Link to="/cart" aria-label={`Carrinho, ${itemCount} itens`}>
            <ShoppingCart aria-hidden="true" />
            {itemCount}
          </Link>
        </Button>
        {session && <Button type="button" variant="ghost" size="sm" disabled={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>
          <LogOut aria-hidden="true" />{logoutMutation.isPending ? "Saindo..." : "Sair"}
        </Button>}
      </div>
      {logoutError && <p className="header-error" role="alert">{logoutError}</p>}
    </header>
  );
}

export function RoutePage({
  title,
  children,
  actions,
}: PropsWithChildren<{ title: string; actions?: ReactNode }>) {
  return (
    <>
      <RouteHeader />
      <main className="page-shell route-page">
        <div className="route-title-row">
          <h1>{title}</h1>
          {actions}
        </div>
        {children}
      </main>
    </>
  );
}

export function RouteError({ message }: { message: string }) {
  return <p className="form-error" role="alert">{message}</p>;
}

export function RouteLoading({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="detail-skeleton" role="status" aria-label={label}>
      <span className="skeleton skeleton-image" />
      <div className="skeleton-copy">
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line short" />
        <span className="skeleton skeleton-line" />
      </div>
    </div>
  );
}
