import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page, destination: string) {
  await page.goto(`/login?redirect=${encodeURIComponent(destination)}`);
  await page.getByLabel("E-mail").fill("colecionador@kurio.test");
  await page.getByLabel("Senha").fill("Kurio123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

async function setScenario(page: import("@playwright/test").Page, scenario: Record<string, unknown>) {
  await page.evaluate(async (settings) => {
    await fetch("/__mock/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  }, scenario);
}

async function emitSocketEvent(
  page: import("@playwright/test").Page,
  event: "nft.updated" | "order.updated",
  payload: Record<string, unknown>,
  duplicateCount = 1,
) {
  const result = await page.evaluate(async (eventRequest) => {
    const response = await fetch("/__mock/socket-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventRequest),
    });
    return { status: response.status, body: await response.json() };
  }, { event, payload, duplicateCount });
  expect(result).toMatchObject({ status: 200, body: { emitted: duplicateCount } });
}

test("loads and filters the NFT catalog", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SEJA DONO DO FUTURO DA ARTE DIGITAL" })).toBeVisible();
  await expect(page.locator(".primary-nav a.active")).toHaveCount(1);
  await expect(page.locator(".product-card")).toHaveCount(9);
  await expect(page.getByText("Ao vivo")).toBeVisible();

  await page.getByRole("button", { name: /Música/ }).click();
  await expect(page.locator(".product-card")).toHaveCount(3);
  await expect(page.getByText("Golden Beat #207")).toBeVisible();

  await page.getByRole("button", { name: /Música/ }).click();
  await page.getByRole("tab", { name: "Em alta" }).click();
  await expect(page.locator(".product-card")).toHaveCount(9);
});

test("keeps combined catalog filters, sorting, pagination and history in the URL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.goBack();
  await expect(page).toHaveURL(/page=1/);

  await page.getByRole("button", { name: /Música/ }).click();
  await page.getByRole("button", { name: /Solana/ }).click();
  await page.getByLabel("Ordenar NFTs").selectOption("high");
  await expect(page).toHaveURL(/category=M%C3%BAsica/);
  await expect(page).toHaveURL(/network=Solana/);
  await expect(page).toHaveURL(/sort=high/);
  await expect(page.locator(".product-card .product-name")).toHaveText([
    "Warm Frequency #087",
    "Soft Signal #055",
    "Golden Beat #207",
  ]);
  await page.goBack();
  await expect(page).toHaveURL(/sort=recent/);
  await expect(page).toHaveURL(/category=M%C3%BAsica/);
});

test("opens an NFT, adds it to the cart and recalculates a coupon", async ({ page }) => {
  await page.goto("/nft/emerald-042");
  await expect(page.getByRole("heading", { name: "Emerald Ape #042" })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.getByRole("status")).toContainText("adicionado ao carrinho");

  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Seu carrinho (1)" })).toBeVisible();
  await page.getByLabel("Cupom de desconto").fill("kurio10");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("1,076 ETH")).toBeVisible();
  await page.getByLabel("Cupom de desconto").fill("EXPIRED");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("Este cupom expirou.")).toBeVisible();
  await page.getByRole("button", { name: /Remover cupom/ }).click();
  await page.getByLabel("Cupom de desconto").fill("KURIO10");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("1,076 ETH")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Seu carrinho (1)" })).toBeVisible();
  await expect(page.getByText("1,076 ETH")).toBeVisible();

  await page.getByRole("button", { name: "Aumentar quantidade de Emerald Ape #042" }).click();
  await expect(page.getByText("2,147 ETH")).toBeVisible();
  await page.getByRole("button", { name: /Remover Emerald Ape/ }).click();
  await expect(page.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
});

test("merges a guest cart at login and completes a confirmed purchase", async ({ page }) => {
  await page.goto("/nft/emerald-042");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.getByRole("status")).toContainText("adicionado ao carrinho");
  await page.goto("/cart");
  await page.getByRole("link", { name: "Ir para o pagamento" }).click();

  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("E-mail").fill("colecionador@kurio.test");
  await page.getByLabel("Senha").fill("Kurio123!");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("heading", { name: "Finalizar compra" })).toBeVisible();
  await page.getByRole("button", { name: "Conectar carteira" }).click();
  await expect(page.getByRole("status")).toContainText("Carteira conectada");
  await page.getByLabel("Revisei os valores e a disponibilidade desta cotação.").check();
  await page.getByRole("button", { name: "Pagar agora" }).click();

  await expect(page.getByRole("heading", { name: "Compra confirmada" })).toBeVisible();
  await expect(page.getByText("Emerald Ape #042")).toBeVisible();
  await expect(page.getByText("Referência da transação")).toBeVisible();
});

test("refreshes a stale quote before allowing payment", async ({ page }) => {
  await page.goto("/nft/emerald-042");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.getByRole("status")).toContainText("adicionado ao carrinho");
  await page.goto("/cart");
  await page.getByRole("link", { name: "Ir para o pagamento" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("E-mail").fill("colecionador@kurio.test");
  await page.getByLabel("Senha").fill("Kurio123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Finalizar compra" })).toBeVisible();
  await page.getByRole("button", { name: "Conectar carteira" }).click();
  await page.getByLabel("Revisei os valores e a disponibilidade desta cotação.").check();
  await page.evaluate(async () => {
    await fetch("/__mock/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "price-changed" }),
    });
  });
  await page.getByRole("button", { name: "Pagar agora" }).click();

  await expect(page.getByText("Preço ou disponibilidade mudou. Revise e confirme a nova cotação.")).toBeVisible();
  await expect(page.getByLabel("Revisei os valores e a disponibilidade desta cotação.")).not.toBeChecked();
  await page.getByLabel("Revisei os valores e a disponibilidade desta cotação.").check();
  await page.getByRole("button", { name: "Pagar agora" }).click();
  await expect(page.getByRole("heading", { name: "Compra confirmada" })).toBeVisible();
});

test("manages a collector profile and wallet", async ({ page }) => {
  await signIn(page, "/wallets");
  await expect(page.getByRole("heading", { name: "Minhas carteiras" })).toBeVisible();

  await page.getByLabel("Nome", { exact: true }).fill("Carteira de teste");
  await page.getByLabel("Endereço").fill("0xabcdef0123456789");
  await page.getByRole("button", { name: "Adicionar carteira" }).click();
  await expect(page.getByText("Carteira de teste")).toBeVisible();
  await page.getByLabel("Nome", { exact: true }).fill("Duplicada");
  await page.getByLabel("Endereço").fill("0xabcdef0123456789");
  await page.getByRole("button", { name: "Adicionar carteira" }).click();
  await expect(page.getByText("Esta carteira já está cadastrada.")).toBeVisible();
  await page.getByRole("button", { name: "Editar Carteira de teste" }).click();
  await page.locator(".wallet-edit-form input").first().fill("Carteira atualizada");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Carteira atualizada" })).toBeVisible();

  await page.goto("/profile");
  await page.getByLabel("Nome completo").fill("Alex Morgan Atualizado");
  await page.getByLabel("Avatar").selectOption({ label: "Neon Vessel" });
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByText("Perfil atualizado com sucesso.")).toBeVisible();
  await expect(page.getByLabel("Avatar")).toHaveValue(/9df2ff42dd27ba657621c304557d1a855a4be6a5\.png/);
  await page.getByLabel("Senha atual").fill("Kurio123!");
  await page.getByLabel("Nova senha").fill("KurioNova2026!");
  await page.getByRole("button", { name: "Atualizar senha" }).click();
  await expect(page.getByText("Senha atualizada com sucesso.")).toBeVisible();
});

test("recovers a timed-out checkout without creating duplicate orders", async ({ page }) => {
  await page.goto("/nft/emerald-042");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.getByRole("status")).toContainText("adicionado ao carrinho");
  await page.goto("/cart");
  await page.getByRole("link", { name: "Ir para o pagamento" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("E-mail").fill("colecionador@kurio.test");
  await page.getByLabel("Senha").fill("Kurio123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Finalizar compra" })).toBeVisible();
  await page.getByRole("button", { name: "Conectar carteira" }).click();
  await page.getByLabel("Revisei os valores e a disponibilidade desta cotação.").check();
  await page.evaluate(async () => {
    await fetch("/__mock/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "checkout-timeout-once" }),
    });
  });
  await page.getByRole("button", { name: "Pagar agora" }).click();
  await expect(page.getByRole("heading", { name: "Compra confirmada" })).toBeVisible();
  await page.goto("/profile");
  await expect(page.locator(".order-list-item")).toHaveCount(1);
});

test("supports registration, session expiry, logout and switching collectors", async ({ page }) => {
  const email = `collector-${Date.now()}@kurio.test`;
  await page.goto("/register?redirect=%2Fprofile");
  await page.getByLabel("Nome completo").fill("Novo Colecionador");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("Colecionador2026!");
  await setScenario(page, { name: "signup-conflict" });
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("alert")).toContainText("Este e-mail já possui uma conta.");
  await expect(page.getByText("Use outro e-mail.")).toBeVisible();
  await setScenario(page, { name: "default" });
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveValue(email);

  await page.evaluate(async () => {
    await fetch("/__mock/expire-session", { method: "POST" });
  });
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("E-mail").fill("colecionador@kurio.test");
  await page.getByLabel("Senha").fill("Kurio123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
  await page.goto("/login?redirect=%2Fwallets");
  await page.getByLabel("E-mail").fill("sara@kurio.test");
  await page.getByLabel("Senha").fill("Nft2026!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/wallets/);
  await expect(page.locator(".wallet-card").getByText("Polygon")).toBeVisible();
});

test("persists favorites per collector and rolls back a failed favorite update", async ({ page }) => {
  await signIn(page, "/nft/emerald-042");
  const favoriteButton = page.getByRole("button", { name: "Favoritar" });
  await expect(favoriteButton).toBeVisible();
  await setScenario(page, { name: "network-error" });
  await favoriteButton.click();
  await expect(page.getByRole("button", { name: "Favoritar" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("alert")).toContainText("Network Error");

  await setScenario(page, { name: "default" });
  await page.reload();
  await page.getByRole("button", { name: "Favoritar" }).click();
  await expect(page.getByRole("button", { name: "Remover dos favoritos" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Remover dos favoritos" })).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await page.goto("/login?redirect=%2Fnft%2Femerald-042");
  await page.getByLabel("E-mail").fill("sara@kurio.test");
  await page.getByLabel("Senha").fill("Nft2026!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Favoritar" })).toHaveAttribute("aria-pressed", "false");
});

test("applies Socket.IO NFT events and ignores duplicates and stale versions", async ({ page }) => {
  const socketFrames: string[] = [];
  page.on("websocket", (socket) => {
    socket.on("framereceived", (frame) => {
      socketFrames.push(typeof frame.payload === "string" ? frame.payload : frame.payload.toString());
    });
  });
  await page.goto("/nft/emerald-042");
  await expect(page.locator(".live-badge.connected")).toHaveText("Conectado");
  await expect(page.getByText("1.19 ETH")).toBeVisible();

  const eventResponse = await page.evaluate(async () => {
    const response = await fetch("/__mock/events/nft.updated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "emerald-042", price: "1.77", available: 4, duplicateCount: 2 }),
    });
    return { status: response.status, artwork: await response.json() };
  });
  expect(eventResponse).toMatchObject({ status: 200, artwork: { price: "1.77", available: 4 } });
  await emitSocketEvent(page, "nft.updated", {
    id: "emerald-042",
    artwork: eventResponse.artwork,
    version: eventResponse.artwork.version,
    resource: "nft",
  }, 2);
  await expect.poll(() => socketFrames.join("\n")).toContain("nft.updated");
  await expect(page.getByText("1.77 ETH")).toBeVisible();
  await expect(page.getByText("4", { exact: true })).toBeVisible();

  const staleResponse = await page.evaluate(async () => {
    const response = await fetch("/__mock/events/nft.updated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "emerald-042", price: "2.0", eventVersion: 1 }),
    });
    return response.json();
  });
  await emitSocketEvent(page, "nft.updated", {
    id: "emerald-042",
    artwork: { ...staleResponse, price: "2.0" },
    version: 1,
    resource: "nft",
  });
  await expect(page.getByText("1.77 ETH")).toBeVisible();
});

test("recovers pending orders from Socket.IO and does not regress on an old event", async ({ page }) => {
  await page.goto("/nft/emerald-042");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.getByRole("status")).toContainText("adicionado ao carrinho");
  await page.goto("/cart");
  await page.getByRole("link", { name: "Ir para o pagamento" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("E-mail").fill("colecionador@kurio.test");
  await page.getByLabel("Senha").fill("Kurio123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Finalizar compra" })).toBeVisible();
  await page.getByRole("button", { name: "Conectar carteira" }).click();
  await page.getByLabel("Revisei os valores e a disponibilidade desta cotação.").check();
  await setScenario(page, { name: "payment-pending" });
  await page.getByRole("button", { name: "Pagar agora" }).click();
  await expect(page.getByRole("heading", { name: "Pagamento em processamento" })).toBeVisible();
  const orderId = new URL(page.url()).pathname.split("/").pop();
  expect(orderId).toBeTruthy();

  const orderResponse = await page.evaluate(async (id) => {
    const response = await fetch("/__mock/events/order.updated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "confirmed", version: 2 }),
    });
    return response.json();
  }, orderId);
  await emitSocketEvent(page, "order.updated", {
    id: orderResponse.id,
    ownerId: orderResponse.ownerId,
    status: orderResponse.status,
    version: orderResponse.version,
    resource: "order",
  }, 2);
  await expect(page.getByRole("heading", { name: "Compra confirmada" })).toBeVisible();
  const staleOrderResponse = await page.evaluate(async (id) => {
    const response = await fetch("/__mock/events/order.updated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "pending", version: 1 }),
    });
    return response.json();
  }, orderId);
  await emitSocketEvent(page, "order.updated", {
    id: staleOrderResponse.id,
    ownerId: staleOrderResponse.ownerId,
    status: "pending",
    version: 1,
    resource: "order",
  }, 2);
  await expect(page.getByRole("heading", { name: "Compra confirmada" })).toBeVisible();
});

test("keeps a declined payment in the cart and handles wallet refusal and disconnect", async ({ page }) => {
  await page.goto("/nft/emerald-042");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.getByRole("status")).toContainText("adicionado ao carrinho");
  await page.goto("/cart");
  await page.getByRole("link", { name: "Ir para o pagamento" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("E-mail").fill("colecionador@kurio.test");
  await page.getByLabel("Senha").fill("Kurio123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Finalizar compra" })).toBeVisible();

  await setScenario(page, { name: "wallet-refused" });
  await page.getByRole("button", { name: "Conectar carteira" }).click();
  await expect(page.getByRole("alert")).toContainText("A conexão da carteira foi recusada.");
  await setScenario(page, { name: "default" });
  await page.getByRole("button", { name: "Conectar carteira" }).click();
  await expect(page.getByRole("status")).toContainText("Carteira conectada");
  await page.getByRole("button", { name: "Desconectar carteira" }).click();
  await expect(page.getByRole("status")).toContainText("Carteira desconectada");
  await page.getByRole("button", { name: "Conectar carteira" }).click();
  await page.getByLabel("Revisei os valores e a disponibilidade desta cotação.").check();
  await setScenario(page, { paymentOutcome: "declined" });
  await page.getByRole("button", { name: "Pagar agora" }).click();
  await expect(page.getByRole("heading", { name: "Pagamento não aprovado" })).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Seu carrinho (1)" })).toBeVisible();
});

test("shows direct-detail errors and a sold-out edition", async ({ page }) => {
  await page.goto("/nft/does-not-exist");
  await expect(page.getByRole("heading", { name: "NFT não encontrado" })).toBeVisible();
  await page.goto("/nft/new-world-404");
  await expect(page.getByRole("button", { name: "Edição esgotada" })).toBeDisabled();
});

test("keeps all required viewport widths free of horizontal overflow", async ({ page }) => {
  await page.goto("/");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth, `horizontal overflow at ${width}px`).toBe(dimensions.viewportWidth);
  }
});

test("supports keyboard navigation through account forms", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByLabel("E-mail");
  const password = page.getByLabel("Senha");
  for (let tab = 0; tab < 20 && !(await email.evaluate((element) => element === document.activeElement)); tab += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(email).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();
});

test("shows recoverable empty search results", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir busca" }).click();
  await page.getByRole("searchbox", { name: "Buscar no mercado" }).fill("nenhuma arte existe");

  await expect(page.getByText("Nenhum NFT encontrado com esses filtros.")).toBeVisible();

  await page.getByRole("searchbox", { name: "Buscar no mercado" }).fill("Emerald");
  await expect(page.getByText("Emerald Ape #042")).toBeVisible();
});

test("keeps the mobile layout within the viewport and toggles navigation", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile viewport only");
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.locator(".menu-toggle")).toHaveAttribute("aria-expanded", "true");

  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(documentWidth).toBe(viewportWidth);
});

test("@visual captures the desktop homepage for visual regression", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop visual baseline only");
  await page.goto("/");
  await expect(page.locator(".product-card")).toHaveCount(9);
  await page.evaluate(() => {
    for (const image of document.images) image.loading = "eager";
  });
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
  await expect(page).toHaveScreenshot("kurio-homepage.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
});
