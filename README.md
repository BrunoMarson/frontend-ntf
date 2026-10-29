# Kurio

Marketplace responsivo de NFTs reconstruído a partir da referência do Figma e dos requisitos do desafio.

## Stack

- React + TypeScript + Vite
- TanStack Router e TanStack Query
- Axios para a API REST
- Socket.IO para atualizações em tempo real
- Tailwind CSS v4 e componentes no padrão shadcn/ui
- MSW para simular a API REST
- Playwright para testes E2E e regressão visual
- Lighthouse para auditoria local de qualidade e performance

Veja [ARCHITECTURE.md](./ARCHITECTURE.md) para os fluxos, contratos REST, eventos e limitações do modo de demonstração.

## Executar localmente

```bash
npm install
npm run dev
```

Em desenvolvimento, o MSW simula a API e o Vite inicia um servidor Socket.IO local. A aplicação também inclui estas contas fictícias:

As imagens do catálogo ficam em `assets/` e são importadas pelo Vite, que as inclui na build de produção.

| E-mail | Senha |
|---|---|
| `colecionador@kurio.test` | `Kurio123!` |
| `sara@kurio.test` | `Nft2026!` |

Para usar serviços externos, configure `VITE_API_URL` e `VITE_SOCKET_URL` em `.env.local` e defina `VITE_API_MOCKING=disabled`. Consulte [.env.example](./.env.example).

## Publicar na Vercel

1. Crie no GitHub um repositório seu para este projeto e envie os arquivos do projeto, sem `node_modules` ou `dist`.
2. Na Vercel, escolha **Add New → Project**, conecte sua conta GitHub e importe esse repositório.
3. Use estas configurações de build:
   - Framework preset: **Vite**
   - Build command: `npm run build:mock`
   - Output directory: `dist`
   - Install command: `npm install`
4. Clique em **Deploy**. O `vercel.json` configura o fallback das rotas da aplicação; depois do deploy, a Vercel mostrará a URL pública.

Não é necessário cadastrar variáveis de ambiente para a demonstração: `build:mock` ativa a API simulada. Essa publicação usa dados e autenticação fictícios, não pagamentos reais nem Socket.IO de produção.

## Validação

```bash
npm run typecheck
npm run build
npm run test:e2e
npm run test:visual
```

Playwright executa os fluxos em Chromium desktop e mobile; dois cenários são ignorados intencionalmente por projeto. O baseline visual atual cobre a home desktop. Para atualizá-lo deliberadamente:

```bash
npm run test:visual -- --update-snapshots
```

Para uma build com MSW habilitado e auditoria Lighthouse local, execute `npm run build:mock`, depois `npm run preview` e, em outro terminal, `npm run audit:lighthouse`. O relatório é gerado em `lighthouse-report.html`.

Última medição local dessa build: Performance 89, Acessibilidade 100, Boas práticas 100 e SEO 100. Métricas: FCP 2,7 s, LCP 3,0 s, TBT 130 ms e CLS 0. Os resultados variam conforme o ambiente.

## Limites da demonstração

Os pagamentos, a conexão de carteira e os dados de conta são simulados no navegador; não há assinatura de transação, custódia, processamento financeiro ou backend de produção. Use um serviço real e revise autenticação, armazenamento e políticas operacionais antes de qualquer publicação.
