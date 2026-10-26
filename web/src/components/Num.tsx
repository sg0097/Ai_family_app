import { useAnimatedNumber } from '../motion';

/** Renders a number that counts up; keeps one decimal when the value has one. */
export function Num({ value, decimals }: { value: number; decimals?: number }) {
  const v = useAnimatedNumber(value);
  const d = decimals ?? (Number.isInteger(value) ? 0 : 1);
  return <span className="num">{v.toFixed(d)}</span>;
}
