// Safe calculator evaluation (no eval): numbers, + - * / %, parentheses, unary minus.
export function evaluate(expr: string): number {
  const s = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '').replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i];
  function num(): number {
    if (peek() === '(') { i++; const v = add(); if (s[i] !== ')') throw new Error('Missing )'); i++; return pct(v); }
    if (peek() === '-') { i++; return -num(); }
    if (peek() === '+') { i++; return num(); }
    const m = /^\d*\.?\d+|^\d+\./.exec(s.slice(i));
    if (!m) throw new Error('Invalid');
    i += m[0].length;
    return pct(parseFloat(m[0]));
  }
  function pct(v: number) { while (peek() === '%') { i++; v = v / 100; } return v; }
  function mul(): number {
    let v = num();
    while (peek() === '*' || peek() === '/') { const op = s[i++]; const r = num(); if (op === '/' && r === 0) throw new Error('Cannot divide by 0'); v = op === '*' ? v * r : v / r; }
    return v;
  }
  function add(): number {
    let v = mul();
    while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = mul(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  if (!s) throw new Error('Empty');
  const v = add();
  if (i !== s.length || !Number.isFinite(v)) throw new Error('Invalid');
  return Math.round(v * 1e10) / 1e10;
}
export const formatResult = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 10 });
