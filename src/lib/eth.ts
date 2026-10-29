import type { EthAmount } from "../types/artwork";

const decimals = 8n;
const scale = 10n ** decimals;

export function toUnits(value: EthAmount): bigint {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,8})?$/.test(normalized)) {
    throw new TypeError(`Invalid ETH decimal: ${value}`);
  }
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * scale + BigInt(fraction.padEnd(Number(decimals), "0"));
}

export function fromUnits(value: bigint): EthAmount {
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(Number(decimals), "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function addEth(...values: EthAmount[]) {
  return fromUnits(values.reduce((total, value) => total + toUnits(value), 0n));
}

export function multiplyEth(value: EthAmount, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError("ETH quantities must be non-negative integers.");
  }
  return fromUnits(toUnits(value) * BigInt(quantity));
}

export function subtractEth(value: EthAmount, deduction: EthAmount) {
  return fromUnits(toUnits(value) - toUnits(deduction));
}

export function formatEth(value: EthAmount) {
  const [whole, fraction = ""] = value.split(".");
  const visibleFraction = fraction.replace(/0+$/, "").padEnd(2, "0");
  return `${BigInt(whole).toLocaleString("pt-BR")},${visibleFraction} ETH`;
}
