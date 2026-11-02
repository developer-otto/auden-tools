/* Exact decimal/rational arithmetic for amounts and units. Round only at the output boundary. */
const AudenDecimal = (() => {
  function ratio(n, d = 1n) {
    if (d === 0n) throw new RangeError('Division by zero');
    if (d < 0n) { n = -n; d = -d; }
    let a = n < 0n ? -n : n, b = d;
    while (b) [a, b] = [b, a % b];
    return { n: n / a, d: d / a };
  }
  function parse(input) {
    const value = String(input).trim();
    // Limit user input before constructing BigInts or powers of ten.
    if (value.length > 220) throw new RangeError('Decimal input too long');
    const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d{1,3}))?$/i.exec(value);
    if (!match) throw new TypeError('Invalid decimal');
    const fraction = match[3] ?? match[4] ?? '', exponent = Number(match[5] || 0);
    if (Math.abs(exponent) > 100) throw new RangeError('Decimal exponent out of range');
    const digits = (match[2] || '0') + fraction;
    if (digits.length > 200) throw new RangeError('Decimal input too long');
    const n = BigInt(digits) * (match[1] === '-' ? -1n : 1n), scale = fraction.length - exponent;
    return scale >= 0 ? ratio(n, 10n ** BigInt(scale)) : ratio(n * 10n ** BigInt(-scale));
  }
  const asRatio = value => typeof value === 'object' && value !== null ? value : parse(value);
  function add(left, right) { const a = asRatio(left), b = asRatio(right); return ratio(a.n * b.d + b.n * a.d, a.d * b.d); }
  function subtract(left, right) { const b = asRatio(right); return add(left, { n: -b.n, d: b.d }); }
  function multiply(left, right) { const a = asRatio(left), b = asRatio(right); return ratio(a.n * b.n, a.d * b.d); }
  function divide(left, right) { const a = asRatio(left), b = asRatio(right); return ratio(a.n * b.d, a.d * b.n); }
  function round(value, digits = 2) {
    if (!Number.isInteger(digits) || digits < 0 || digits > 100) throw new RangeError('Invalid precision');
    const { n, d } = asRatio(value), magnitude = (n < 0n ? -n : n) * 10n ** BigInt(digits);
    let rounded = magnitude / d;
    if ((magnitude % d) * 2n >= d) rounded += 1n; // Half up; ties away from zero.
    const text = rounded.toString().padStart(digits + 1, '0');
    return `${n < 0n && rounded !== 0n ? '-' : ''}${digits ? text.slice(0, -digits) + '.' + text.slice(-digits) : text}`;
  }
  function format(decimal, locale, trim = false) {
    const [integer, rawFraction = ''] = decimal.split('.');
    const fraction = trim ? rawFraction.replace(/0+$/, '') : rawFraction;
    const negative = integer.startsWith('-'), magnitude = BigInt(negative ? integer.slice(1) : integer);
    const sign = negative ? new Intl.NumberFormat(locale).formatToParts(-1).find(part => part.type === 'minusSign').value : '';
    const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal').value;
    return sign + new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(magnitude) + (fraction ? separator + fraction : '');
  }
  return { parse, add, subtract, multiply, divide, round, format };
})();
