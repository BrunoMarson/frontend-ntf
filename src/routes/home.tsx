import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronRight,
  CircleHelp,
  Headphones,
  Instagram,
  LogIn,
  Menu,
  Search,
  ShoppingCart,
  ShieldCheck,
  Twitter,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { artworkQuery, cartQuery, sessionQuery } from "../api/query";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useLiveStatus } from "../hooks/use-live-catalog";
import { artworkImages } from "../lib/artwork-images";
import type { ArtworkFilters, ArtworkListing, ArtworkSort } from "../types/artwork";

const initialFilters: ArtworkFilters = {
  search: "",
  category: "",
  network: "",
  listing: "Todos os NFTs",
  minPrice: "0.02",
  maxPrice: "12.3",
  sort: "recent",
  page: 1,
};

const categories = [
  ["Arte digital", 33],
  ["Fotografia", 12],
  ["Música", 65],
  ["Arte 3D", 39],
  ["Colecionáveis", 23],
  ["Generativa", 17],
  ["Jogos", 19],
  ["Assinaturas", 13],
  ["Utilidade", 18],
] as const;

const networks = [
  ["Ethereum", 119],
  ["Polygon", 78],
  ["Solana", 86],
] as const;

const artworkPaths = artworkImages;

const journalArticles = [
  {
    image: artworkPaths.neon,
    date: "12 de setembro",
    reading: "Leitura de 6 min",
    title: "Como funciona a propriedade de NFTs",
    description: "Aprenda a colecionar, negociar e verificar ativos digitais.",
  },
  {
    image: artworkPaths.emerald,
    date: "13 de setembro",
    reading: "Leitura de 2 min",
    title: "10 artistas digitais para acompanhar",
    description: "Conheça criadores que moldam a cultura digital.",
  },
  {
    image: artworkPaths.sage,
    date: "15 de setembro",
    reading: "Leitura de 3 min",
    title: "Raridade, atributos e procedência",
    description: "Entenda raridade, procedência, direitos autorais e utilidade.",
  },
  {
    image: artworkPaths.golden,
    date: "15 de setembro",
    reading: "Leitura de 2 min",
    title: "Como proteger sua carteira",
    description: "Proteja sua carteira, seus ativos e sua identidade.",
  },
];

function SiteHeader({
  onSearch,
  initialSearch,
}: {
  onSearch: (search: string) => void;
  initialSearch: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const sessionQueryResult = useQuery(sessionQuery);
  const cartQueryResult = useQuery(cartQuery);
  const user = sessionQueryResult.data?.user;
  const cartItemCount = cartQueryResult.data?.items.reduce((count, item) => count + item.quantity, 0) ?? 0;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(search);
    document.querySelector("#mercado")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <header className="site-header page-shell">
      <Link className="wordmark" to="/" aria-label="Kurio — início">KURIO</Link>
      <Button
        className="menu-toggle md:hidden"
        variant="ghost"
        size="icon"
        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuOpen}
        aria-controls="primary-nav"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </Button>
      <nav className={`primary-nav ${menuOpen ? "is-open" : ""}`} id="primary-nav" aria-label="Navegação principal">
        <a className="active" href="#inicio" onClick={() => setMenuOpen(false)}>Início</a>
        <a href="#mercado" onClick={() => setMenuOpen(false)}>Mercado</a>
        <a href="#criadores" onClick={() => setMenuOpen(false)}>Criadores</a>
        <a href="#aprenda" onClick={() => setMenuOpen(false)}>Aprenda</a>
      </nav>
      <div className="header-actions">
        <Button
          variant="ghost"
          size="icon"
          aria-label={searchOpen ? "Fechar busca" : "Abrir busca"}
          onClick={() => setSearchOpen((open) => !open)}
        >
          <Search aria-hidden="true" />
        </Button>
        <Button asChild className="cart-button" variant="ghost" size="icon" aria-label={`Carrinho, ${cartItemCount} itens`}>
          <Link to="/cart">
            <ShoppingCart aria-hidden="true" />
            <span className="cart-count">{cartItemCount}</span>
          </Link>
        </Button>
        <Button asChild className="login-button" size="sm">
          <Link to={user ? "/profile" : "/login"}>{user ? user.name : <><LogIn aria-hidden="true" />Entrar</>}</Link>
        </Button>
      </div>
      {searchOpen && (
        <form className="search-panel" role="search" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="site-search">Buscar no mercado</label>
          <Input
            id="site-search"
            type="search"
            placeholder="Buscar artistas e coleções..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              onSearch(event.target.value);
            }}
          />
          <Button type="submit" size="sm">Buscar</Button>
        </form>
      )}
    </header>
  );
}

function Hero() {
  const [selectedImage, setSelectedImage] = useState(0);
  const highlights = [
    { src: artworkPaths.emerald, alt: "Macaco Emerald Ape com óculos e jaqueta verde" },
    { src: artworkPaths.sage, alt: "Macaco Sage Nomad com chapéu de explorador" },
    { src: artworkPaths.neon, alt: "Macaco Neon Vessel com casaco claro" },
  ];

  return (
    <section className="hero page-shell" id="inicio" aria-label="Destaque">
      <div className="hero-copy">
        <p className="eyebrow">Bem-vindo à Kurio</p>
        <h1>SEJA DONO DO FUTURO<br />DA ARTE DIGITAL</h1>
        <p className="hero-description">
          Descubra NFTs selecionados de criadores emergentes e consagrados.
          Colecione arte digital rara, apoie artistas e tenha uma parte da
          cultura da internet.
        </p>
        <Button asChild className="button-primary">
          <Link to="/" hash="mercado">EXPLORAR</Link>
        </Button>
        <div className="hero-dots" aria-label="Escolha uma arte em destaque">
          {highlights.map((highlight, index) => (
            <button
              className={index === selectedImage ? "selected" : ""}
              type="button"
              key={highlight.src}
              aria-label={`Destaque ${index + 1}`}
              aria-pressed={index === selectedImage}
              onClick={() => setSelectedImage(index)}
            />
          ))}
        </div>
      </div>
      <div className="hero-art-wrap">
        <img className="hero-art" src={highlights[selectedImage].src} alt={highlights[selectedImage].alt} />
      </div>
    </section>
  );
}

function Filters({
  filters,
  onApply,
}: {
  filters: ArtworkFilters;
  onApply: (filters: ArtworkFilters) => void;
}) {
  const [pendingMinimum, setPendingMinimum] = useState(Number(filters.minPrice));
  const [pendingMaximum, setPendingMaximum] = useState(Number(filters.maxPrice));
  useEffect(() => {
    setPendingMinimum(Number(filters.minPrice));
    setPendingMaximum(Number(filters.maxPrice));
  }, [filters.minPrice, filters.maxPrice]);

  return (
    <aside className="filter-column" aria-label="Filtros do mercado">
      <Card className="filters-panel">
        <CardContent className="filters-content">
          <h2 className="filter-heading">Coleções</h2>
          <ul className="filter-list category-filters">
            {categories.map(([category, count]) => (
              <li key={category}>
                <button
                  type="button"
                  className={`filter-option ${filters.category === category ? "active" : ""}`}
                  aria-pressed={filters.category === category}
                  onClick={() => {
                    const nextFilters = { ...filters, category: filters.category === category ? "" : category };
                    onApply(nextFilters);
                  }}
                >
                  {category}<span>({count})</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="filter-group price-filter">
            <h2 className="filter-heading">Faixa de preço</h2>
            <div className="range-inputs">
              <input
                aria-label="Preço mínimo em ETH"
                type="range"
                min="0"
                max="12.3"
                step="0.01"
                value={pendingMinimum}
                onChange={(event) => setPendingMinimum(Math.min(Number(event.target.value), pendingMaximum))}
              />
              <input
                aria-label="Preço máximo em ETH"
                type="range"
                min="0"
                max="12.3"
                step="0.01"
                value={pendingMaximum}
                onChange={(event) => setPendingMaximum(Math.max(Number(event.target.value), pendingMinimum))}
              />
            </div>
            <p className="price-range-label">
              Preço: {pendingMinimum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} –{" "}
              {pendingMaximum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ETH
            </p>
            <Button size="sm" onClick={() => {
              const nextFilters = { ...filters, minPrice: pendingMinimum.toFixed(2), maxPrice: pendingMaximum.toFixed(2) };
              onApply(nextFilters);
            }}>Aplicar</Button>
          </div>

          <div className="filter-group network-filter">
            <h2 className="filter-heading">Rede</h2>
            <ul className="filter-list">
              {networks.map(([network, count]) => (
                <li key={network}>
                  <button
                    className={`filter-option ${filters.network === network ? "active" : ""}`}
                    type="button"
                    aria-pressed={filters.network === network}
                    onClick={() => {
                      const nextFilters = { ...filters, network: filters.network === network ? "" : network };
                      onApply(nextFilters);
                    }}
                  >
                    {network}<span>({count})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <a className="featured-nft" href="#criadores">
        <span className="featured-kicker">NFT EM DESTAQUE</span>
        <span className="featured-title">OFERTA LIMITADA</span>
        <img src={artworkPaths.sage} alt="Sage Nomad, macaco com chapéu de explorador" loading="lazy" />
      </a>
    </aside>
  );
}

function ProductGrid({ filters }: { filters: ArtworkFilters }) {
  const { data, isPending, isError, error, refetch } = useQuery(artworkQuery(filters));

  if (isPending) {
    return (
      <div className="product-grid skeleton-grid" role="status" aria-label="Carregando obras" aria-busy="true">
        {Array.from({ length: 9 }, (_, index) => (
          <div className="product-card product-skeleton" key={index}>
            <span className="skeleton skeleton-image" />
            <div className="product-info">
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line short" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="empty-state error-state" role="alert">
        <p>Não foi possível carregar as obras.</p>
        <p className="error-detail">{error instanceof Error ? error.message : "Erro desconhecido na API."}</p>
        <Button type="button" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
      </div>
    );
  }
  if (data.items.length === 0) {
    return <p className="empty-state">Nenhum NFT encontrado com esses filtros.</p>;
  }

  return (
    <div className="product-grid" aria-live="polite">
      {data.items.map((artwork) => (
        <Card className="product-card" key={artwork.id}>
          <Link className="product-art-link" to="/nft/$artworkId" params={{ artworkId: artwork.id }} aria-label={`Ver ${artwork.name}`}>
            <img src={artwork.image} alt={artwork.name} loading="lazy" />
          </Link>
          <CardContent className="product-info">
            <p className="product-name">{artwork.name}</p>
            <div className="product-prices">
              <span>{artwork.price} ETH</span>
              {artwork.oldPrice && <span className="old-price">{artwork.oldPrice} ETH</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Market() {
  const routeSearch = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const filters = {
    ...initialFilters,
    ...routeSearch,
    listing: routeSearch.listing as ArtworkListing,
    sort: routeSearch.sort as ArtworkSort,
  } satisfies ArtworkFilters;
  const { data: collection } = useQuery(artworkQuery(filters));
  const { status, errorMessage } = useLiveStatus();
  const updateFilters = (nextFilters: Partial<ArtworkFilters>) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...nextFilters,
        page: nextFilters.page ?? 1,
      }),
    });
  };
  const listings: ArtworkListing[] = ["Todos os NFTs", "Novos lançamentos", "Em alta"];

  return (
    <section className="market-layout page-shell" id="mercado">
      <Filters
        filters={filters}
        onApply={(next) => updateFilters(next)}
      />
      <div className="market-content">
        <div className="market-toolbar">
          <div className="market-toolbar-row">
            <div className="market-tabs" role="tablist" aria-label="Tipo de listagem">
              {listings.map((listing) => (
                <button
                  type="button"
                  key={listing}
                  className={`market-tab ${filters.listing === listing ? "active" : ""}`}
                  role="tab"
                  aria-selected={filters.listing === listing}
                  onClick={() => updateFilters({ listing })}
                >{listing}</button>
              ))}
            </div>
            <div className="live-status" data-status={status} title={errorMessage || `Socket.IO: ${status}`}>
              <span className="live-dot" />
              {status === "connected" ? "Ao vivo" : status === "connecting" ? "Conectando" : status === "disabled" ? "Tempo real indisponível" : "Reconectando"}
            </div>
          </div>
          <label className="sort-control">
            <span>Ordenar por:</span>
            <select
              aria-label="Ordenar NFTs"
              value={filters.sort}
              onChange={(event) => updateFilters({ sort: event.target.value as ArtworkSort })}
            >
              <option value="recent">Listados recentemente</option>
              <option value="low">Menor preço</option>
              <option value="high">Maior preço</option>
            </select>
          </label>
        </div>
        <ProductGrid filters={filters} />
        <nav className="pagination" aria-label="Paginação do mercado">
          {Array.from({ length: Math.max(1, Math.ceil((collection?.total ?? 0) / (collection?.pageSize ?? 9))) }, (_, index) => index + 1).map((page) => (
            <Button
              className={filters.page === page ? "current" : ""}
              variant={filters.page === page ? "default" : "outline"}
              size="sm"
              key={page}
              aria-current={filters.page === page ? "page" : undefined}
              onClick={() => updateFilters({ page })}
            >{page}</Button>
          ))}
          <Button className="next-page" variant="outline" size="icon" aria-label="Próxima página" disabled={filters.page >= Math.ceil((collection?.total ?? 0) / (collection?.pageSize ?? 9))} onClick={() => updateFilters({ page: filters.page + 1 })}><ChevronRight /></Button>
        </nav>
      </div>
      <span className="sr-only" aria-live="polite">{filters.search ? `Busca por ${filters.search}` : ""}</span>
    </section>
  );
}

function PromoCards() {
  return (
    <section className="promo-grid page-shell" id="criadores" aria-label="Destaques da Kurio">
      <article className="promo-card">
        <img src={artworkPaths.emerald} alt="" loading="lazy" />
        <div className="promo-copy">
          <h2>Lançamentos gênesis<br />de edição limitada</h2>
          <p>Colecione edições escassas diretamente dos criadores antes da revelação pública.</p>
          <Button asChild size="sm"><a href="#mercado">Explorar <ArrowRight aria-hidden="true" /></a></Button>
        </div>
      </article>
      <article className="promo-card">
        <img src={artworkPaths.neon} alt="" loading="lazy" />
        <div className="promo-copy">
          <h2>Arte digital selecionada<br />e muito mais</h2>
          <p>Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.</p>
          <Button asChild size="sm"><a href="#mercado">Explorar <ArrowRight aria-hidden="true" /></a></Button>
        </div>
      </article>
    </section>
  );
}

function Journal() {
  return (
    <section className="journal page-shell" id="aprenda">
      <div className="section-heading">
        <h2>Diário da Cunhagem</h2>
        <p>Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </div>
      <div className="journal-grid">
        {journalArticles.map((article) => (
          <Card className="journal-card" key={article.title}>
            <img src={article.image} alt="" loading="lazy" />
            <CardContent className="journal-copy">
              <p className="journal-meta">{article.date}<span>|</span>{article.reading}</p>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
              <a href="#aprenda">Ler mais →</a>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function SiteFooter() {
  const [newsletterMessage, setNewsletterMessage] = useState("");

  function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewsletterMessage("E-mail cadastrado. Obrigado!");
    event.currentTarget.reset();
  }

  return (
    <footer className="site-footer page-shell">
      <div className="footer-benefits">
        <article className="benefit">
          <span className="benefit-icon"><ShieldCheck aria-hidden="true" /></span>
          <h2>Segurança da carteira</h2>
          <p>Proteja sua carteira e colecione arte digital verificada com confiança.</p>
        </article>
        <article className="benefit">
          <span className="benefit-icon">C</span>
          <h2>Criadores em destaque</h2>
          <p>Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.</p>
        </article>
        <article className="benefit">
          <span className="benefit-icon">D</span>
          <h2>Alertas de lançamentos</h2>
          <p>Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.</p>
        </article>
        <form className="newsletter" onSubmit={subscribe}>
          <label htmlFor="newsletter-email">Antecipe-se ao próximo lançamento</label>
          <div className="newsletter-input">
            <Input id="newsletter-email" type="email" placeholder="digite seu e-mail..." required />
            <Button type="submit" size="sm">Enviar</Button>
          </div>
          <p>Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
          <span className="newsletter-status" aria-live="polite">{newsletterMessage}</span>
        </form>
      </div>
      <div className="footer-contact">
        <Link className="wordmark" to="/">KURIO</Link>
        <p>Feito para colecionadores,<br />criadores e cultura.</p>
        <a href="mailto:contato@email.com">contato@email.com</a>
        <a href="tel:+551140028922">+55 11 4002 8922</a>
      </div>
      <div className="footer-links">
        <div>
          <h2>Meu perfil</h2>
          <a href="#inicio">Meu perfil</a><a href="#mercado">Minha coleção</a><a href="#mercado">Atividade</a>
          <a href="#criadores">Estúdio do criador</a><a href="#mercado">Lista de interesse</a>
        </div>
        <div>
          <h2>Central de ajuda</h2>
          <a href="#aprenda">Central de ajuda</a><a href="#aprenda">Como comprar NFTs</a><a href="#aprenda">Carteira e segurança</a>
          <a href="#aprenda">Política do mercado</a><a href="#aprenda">Denunciar item</a>
        </div>
        <div>
          <h2>Coleções</h2>
          <a href="#mercado">Arte digital</a><a href="#mercado">Fotografia</a><a href="#mercado">Música</a>
          <a href="#mercado">Arte 3D</a><a href="#mercado">Utilidade</a>
        </div>
        <div className="social-links">
          <h2>Redes sociais</h2>
          <div className="social-icons">
            <a href="#inicio" aria-label="Instagram"><Instagram aria-hidden="true" /></a>
            <a href="#inicio" aria-label="Twitter"><Twitter aria-hidden="true" /></a>
            <a href="#inicio" aria-label="Ajuda"><CircleHelp aria-hidden="true" /></a>
            <a href="#inicio" aria-label="Suporte"><Headphones aria-hidden="true" /></a>
          </div>
          <h2 className="wallet-heading">Carteiras compatíveis</h2>
          <p className="wallets"><WalletCards aria-hidden="true" /> METAMASK · WALLETCONNECT · COINBASE</p>
        </div>
      </div>
      <p className="copyright">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  );
}

export function HomePage() {
  const navigate = useNavigate({ from: "/" });
  const routeSearch = useSearch({ from: "/" });

  return (
    <>
      <SiteHeader
        initialSearch={routeSearch.search}
        onSearch={(search) => {
          void navigate({ search: (previous) => ({ ...previous, search, page: 1 }) });
        }}
      />
      <main>
        <Hero />
        <Market />
        <PromoCards />
        <Journal />
      </main>
      <SiteFooter />
    </>
  );
}
