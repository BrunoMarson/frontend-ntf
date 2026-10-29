import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { io } from "socket.io-client";
import { sessionQuery } from "../api/query";
import type { Artwork, Cart, OrderReceipt } from "../types/artwork";

export type LiveStatus = "connecting" | "connected" | "disconnected" | "disabled";
const useLocalSocket = import.meta.env.DEV && import.meta.env.VITE_API_MOCKING !== "disabled";
interface LiveContextValue {
  status: LiveStatus;
  errorMessage: string;
}

const LiveContext = createContext<LiveContextValue>({
  status: "connecting",
  errorMessage: "",
});

export function LiveCatalogProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>(
    useLocalSocket || import.meta.env.VITE_SOCKET_URL ? "connecting" : "disabled",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || (useLocalSocket ? window.location.origin : "");
    if (!socketUrl) {
      setStatus("disabled");
      return;
    }

    const socket = io(socketUrl, {
      reconnection: true,
      timeout: 10_000,
      ...(useLocalSocket ? { transports: ["websocket"] } : {}),
    });
    const currentUserId = () => queryClient.getQueryData(sessionQuery.queryKey)?.user.id;
    const onConnect = () => {
      setStatus("connected");
      setErrorMessage("");
      const userId = currentUserId();
      if (userId) socket.emit("session.subscribe", { userId });
      void queryClient.invalidateQueries({ queryKey: ["artworks"] });
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-quote"] });
      if (userId) void queryClient.invalidateQueries({ queryKey: ["orders", userId] });
    };
    const onDisconnect = () => setStatus("disconnected");
    const onConnectError = (error: Error) => {
      setStatus("disconnected");
      setErrorMessage(error.message);
    };
    const onArtworkUpdated = (payload: { id: string; artwork: Artwork; version: number }) => {
      if (!payload?.id || !Number.isSafeInteger(payload.version)) return;
      const updateArtwork = (current: Artwork | undefined) => {
        if (!current || current.id !== payload.id || current.version >= payload.version) return current;
        return { ...current, ...payload.artwork, version: payload.version };
      };

      queryClient.setQueriesData({ queryKey: ["artworks"] }, (current: unknown) => {
        if (!current || typeof current !== "object" || !("items" in current)) return current;
        const collection = current as { items: Artwork[] };
        return {
          ...collection,
          items: collection.items.map((item) => updateArtwork(item) ?? item),
        };
      });
      queryClient.setQueryData<Artwork>(["artwork", payload.id], updateArtwork);
      queryClient.setQueryData<Cart>(["cart"], (cart) => {
        if (!cart) return cart;
        return {
          ...cart,
          items: cart.items.map((item) => ({
            ...item,
            artwork: updateArtwork(item.artwork) ?? item.artwork,
          })),
        };
      });
      void queryClient.invalidateQueries({ queryKey: ["artworks"] });
      void queryClient.invalidateQueries({ queryKey: ["artwork", payload.id] });
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-quote"] });
    };
    const onOrderUpdated = (payload: {
      id: string;
      ownerId: string;
      status: OrderReceipt["status"];
      version: number;
    }) => {
      if (!payload?.id || !payload.ownerId || !Number.isSafeInteger(payload.version)) return;
      if (currentUserId() !== payload.ownerId) return;
      queryClient.setQueryData<OrderReceipt>(["order", payload.id], (current) => {
        if (!current || current.version >= payload.version || current.status === "confirmed" || current.status === "declined") {
          return current;
        }
        return { ...current, status: payload.status, version: payload.version };
      });
      void queryClient.invalidateQueries({ queryKey: ["orders", payload.ownerId] });
      if (payload.status === "confirmed") void queryClient.invalidateQueries({ queryKey: ["cart"] });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("nft.updated", onArtworkUpdated);
    socket.on("order.updated", onOrderUpdated);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("nft.updated", onArtworkUpdated);
      socket.off("order.updated", onOrderUpdated);
      socket.disconnect();
    };
  }, [queryClient]);

  return (
    <LiveContext.Provider value={{ status, errorMessage }}>
      {children}
    </LiveContext.Provider>
  );
}

export function useLiveStatus() {
  return useContext(LiveContext);
}
