import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { AxiosError } from "axios";
import { ArrowLeft, Heart, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { addCartItem, updateFavorite } from "../api/client";
import { artworkDetailQuery, cartQuery, favoritesQuery, sessionQuery } from "../api/query";
import { RouteHeader, RouteLoading, RoutePage } from "../components/route-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useLiveStatus } from "../hooks/use-live-catalog";

function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export function ArtworkDetailPage() {
  const { artworkId } = useParams({ from: "/nft/$artworkId" });
  const queryClient = useQueryClient();
  const { data: artwork, isPending, isError, error, refetch } = useQuery(artworkDetailQuery(artworkId));
  const { data: session } = useQuery(sessionQuery);
  const { status } = useLiveStatus();
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");

  const favoriteQuery = useQuery({
    ...favoritesQuery(session?.user.id ?? "anonymous"),
    enabled: Boolean(session),
  });
  const isFavorite = Boolean(favoriteQuery.data?.includes(artworkId));

  const favoriteMutation = useMutation({
    mutationFn: (favorite: boolean) => updateFavorite(artworkId, favorite),
    onMutate: async (favorite) => {
      if (!session) return;
      const key = favoritesQuery(session.user.id).queryKey;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<string[]>(key) ?? [];
      queryClient.setQueryData<string[]>(key, favorite
        ? [...previous, artworkId]
        : previous.filter((id) => id !== artworkId));
      return { key, previous };
    },
    onError: (error, _favorite, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
      setFeedback(getErrorMessage(error));
    },
    onSettled: () => {
      if (session) void queryClient.invalidateQueries({ queryKey: favoritesQuery(session.user.id).queryKey });
    },
  });

  const addMutation = useMutation({
    mutationFn: () => addCartItem(artworkId, quantity),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cartQuery.queryKey });
      setFeedback("NFT adicionado ao carrinho.");
    },
    onError: (error) => setFeedback(getErrorMessage(error)),
  });

  if (isPending) return <><RouteHeader /><main className="page-shell route-page"><RouteLoading label="Carregando detalhes do NFT" /></main></>;
  if (isError) {
    const statusCode = error instanceof AxiosError ? error.response?.status : undefined;
    const apiMessage = error instanceof AxiosError
      ? (error.response?.data as { message?: string } | undefined)?.message
      : undefined;
    return (
      <RoutePage title={statusCode === 404 ? "NFT não encontrado" : "Não foi possível carregar o NFT"}>
        <Card><CardContent className="route-empty">
          <p>{statusCode === 404 ? "Este NFT não existe ou foi removido do catálogo." : apiMessage ?? (error instanceof Error ? error.message : "Tente novamente.")}</p>
          {statusCode !== 404 && <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>}
          <Button asChild variant="outline"><Link to="/">Voltar ao mercado</Link></Button>
        </CardContent></Card>
      </RoutePage>
    );
  }

  const favoriteControl = session ? (
    <Button
      variant="outline"
      aria-pressed={isFavorite}
      disabled={favoriteMutation.isPending || favoriteQuery.isError}
      onClick={() => favoriteMutation.mutate(!isFavorite)}
    >
      <Heart aria-hidden="true" fill={isFavorite ? "currentColor" : "none"} />
      {isFavorite ? "Remover dos favoritos" : "Favoritar"}
    </Button>
  ) : (
    <Button asChild variant="outline">
      <Link to="/login" search={(previous) => ({ ...previous, redirect: `/nft/${artworkId}` })}>
        <Heart aria-hidden="true" />Entrar para favoritar
      </Link>
    </Button>
  );

  return (
    <>
      <RouteHeader />
      <main className="page-shell detail-page">
        <Link className="back-link" to="/"><ArrowLeft aria-hidden="true" /> Voltar ao mercado</Link>
        <div className="detail-layout">
          <Card className="detail-artwork">
            <img src={artwork.image} alt={artwork.name} />
          </Card>
          <section className="detail-information" aria-labelledby="detail-title">
            <p className="eyebrow">{artwork.category} <span>·</span> {artwork.network}</p>
            <h1 id="detail-title">{artwork.name}</h1>
            <p className="detail-creator">Criado por <strong>Kurio Studio</strong></p>
            <p className="detail-description">
              Uma edição colecionável de arte digital, com procedência verificável e propriedade registrada.
            </p>
            <Card className="detail-edition">
              <CardContent>
                <span>Edição</span><strong>#{artwork.edition.toString().padStart(3, "0")}</strong>
                <span>Disponíveis</span><strong>{artwork.available}</strong>
                <span>Atualização em tempo real</span>
                <strong className={`live-badge ${status}`}>{status === "connected" ? "Conectado" : status === "disabled" ? "Indisponível" : "Reconectando"}</strong>
              </CardContent>
            </Card>
            <div className="detail-price">
              <span>Preço atual</span>
              <strong>{artwork.price} ETH</strong>
              {artwork.oldPrice && <s>{artwork.oldPrice} ETH</s>}
            </div>
            <label className="quantity-control" htmlFor="detail-quantity">
              Quantidade
              <input
                id="detail-quantity"
                type="number"
                min="1"
                max={artwork.available}
                value={quantity}
                disabled={artwork.available === 0}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isSafeInteger(next) && next >= 1 && next <= artwork.available) setQuantity(next);
                }}
              />
              <span>Máximo de {artwork.available} por compra</span>
            </label>
            <div className="detail-actions">
              <Button
                disabled={artwork.available === 0 || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                <ShoppingCart aria-hidden="true" />
                {artwork.available === 0 ? "Edição esgotada" : addMutation.isPending ? "Adicionando..." : "Adicionar ao carrinho"}
              </Button>
              {favoriteControl}
            </div>
            <p className={favoriteMutation.isError || addMutation.isError ? "form-error" : "live-feedback"} role={favoriteMutation.isError || addMutation.isError ? "alert" : "status"}>{feedback}</p>
            {favoriteQuery.isError && <p className="form-error" role="alert">Não foi possível carregar seus favoritos. Tente novamente.</p>}
            <Button asChild variant="ghost" size="sm"><Link to="/cart">Revisar carrinho</Link></Button>
          </section>
        </div>
      </main>
    </>
  );
}
