import type { Artwork } from "../types/artwork";
import { artworkImages } from "../lib/artwork-images";

const image = {
  ...artworkImages,
  nomad: artworkImages.sage,
};

const source: Artwork[] = [
  { id: "emerald-042", name: "Emerald Ape #042", price: "1.19", image: image.emerald, category: "Arte digital", network: "Ethereum", listing: "Em alta", edition: 42, available: 8, version: 1 },
  { id: "sage-009", name: "Sage Nomad #009", price: "1.69", image: image.sage, category: "Arte digital", network: "Polygon", listing: "Novos lançamentos", edition: 9, available: 5, version: 1 },
  { id: "neon-552", name: "Neon Vessel #552", price: "1.99", oldPrice: "2.29", image: image.neon, category: "Colecionáveis", network: "Ethereum", listing: "Em alta", edition: 552, available: 3, version: 1 },
  { id: "cosmic-118", name: "Cosmic Bloom #118", price: "1.29", image: image.sage, category: "Fotografia", network: "Solana", listing: "Novos lançamentos", edition: 118, available: 12, version: 1 },
  { id: "violet-314", name: "Violet Nomad #314", price: "1.39", image: image.sage, category: "Arte 3D", network: "Polygon", listing: "Novos lançamentos", edition: 314, available: 7, version: 1 },
  { id: "ivory-088", name: "Ivory Baron #088", price: "1.79", image: image.neon, category: "Colecionáveis", network: "Ethereum", listing: "Em alta", edition: 88, available: 4, version: 1 },
  { id: "golden-beat-207", name: "Golden Beat #207", price: "0.99", image: image.golden, category: "Música", network: "Solana", listing: "Novos lançamentos", edition: 207, available: 12, version: 1 },
  { id: "golden-signal-160", name: "Golden Signal #160", price: "0.39", image: image.golden, category: "Arte digital", network: "Polygon", listing: "Novos lançamentos", edition: 160, available: 20, version: 1 },
  { id: "golden-icon-206", name: "Golden Icon #206", price: "1.49", image: image.golden, category: "Generativa", network: "Ethereum", listing: "Em alta", edition: 206, available: 6, version: 1 },
  { id: "deep-current-031", name: "Deep Current #031", price: "2.10", image: image.neon, category: "Arte digital", network: "Ethereum", listing: "Em alta", edition: 31, available: 2, version: 1 },
  { id: "moss-orbit-071", name: "Moss Orbit #071", price: "0.65", image: image.emerald, category: "Fotografia", network: "Polygon", listing: "Novos lançamentos", edition: 71, available: 9, version: 1 },
  { id: "soft-signal-055", name: "Soft Signal #055", price: "1.05", image: image.sage, category: "Música", network: "Solana", listing: "Em alta", edition: 55, available: 8, version: 1 },
  { id: "digital-pollen-024", name: "Digital Pollen #024", price: "3.20", image: image.golden, category: "Arte 3D", network: "Ethereum", listing: "Novos lançamentos", edition: 24, available: 3, version: 1 },
  { id: "midnight-form-019", name: "Midnight Form #019", price: "2.45", image: image.neon, category: "Generativa", network: "Polygon", listing: "Em alta", edition: 19, available: 5, version: 1 },
  { id: "paper-sky-223", name: "Paper Sky #223", price: "0.82", image: image.sage, category: "Colecionáveis", network: "Solana", listing: "Novos lançamentos", edition: 223, available: 15, version: 1 },
  { id: "kinetic-grove-014", name: "Kinetic Grove #014", price: "4.10", image: image.emerald, category: "Arte 3D", network: "Ethereum", listing: "Em alta", edition: 14, available: 4, version: 1 },
  { id: "quiet-archive-103", name: "Quiet Archive #103", price: "0.45", image: image.nomad, category: "Fotografia", network: "Polygon", listing: "Novos lançamentos", edition: 103, available: 11, version: 1 },
  { id: "warm-frequency-087", name: "Warm Frequency #087", price: "1.25", image: image.golden, category: "Música", network: "Solana", listing: "Em alta", edition: 87, available: 5, version: 1 },
  { id: "woven-light-060", name: "Woven Light #060", price: "2.75", image: image.sage, category: "Generativa", network: "Ethereum", listing: "Novos lançamentos", edition: 60, available: 6, version: 1 },
  { id: "slow-motion-038", name: "Slow Motion #038", price: "0.72", image: image.neon, category: "Colecionáveis", network: "Polygon", listing: "Em alta", edition: 38, available: 9, version: 1 },
  { id: "petal-engine-112", name: "Petal Engine #112", price: "1.85", image: image.golden, category: "Arte digital", network: "Solana", listing: "Novos lançamentos", edition: 112, available: 7, version: 1 },
  { id: "soft-geometry-006", name: "Soft Geometry #006", price: "3.40", image: image.emerald, category: "Arte 3D", network: "Polygon", listing: "Em alta", edition: 6, available: 3, version: 1 },
  { id: "almost-golden-301", name: "Almost Golden #301", price: "0.58", image: image.golden, category: "Assinaturas", network: "Ethereum", listing: "Novos lançamentos", edition: 301, available: 18, version: 1 },
  { id: "new-world-404", name: "New World #404", price: "0.00", image: image.neon, category: "Utilidade", network: "Solana", listing: "Em alta", edition: 404, available: 0, version: 1 },
];

export const artworks: Artwork[] = source.map((artwork) => ({ ...artwork }));
