const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ Intl });
for (const file of ['decimal-utils.js', 'catalog.js', 'time-utils.js', 'json-utils.js']) {
  vm.runInContext(readFileSync(join(__dirname, file), 'utf8'), context);
}
const { decimal: d, catalog, time } = vm.runInContext('({ decimal: AudenDecimal, catalog: AudenCatalog, time: AudenTime })', context);
const json = vm.runInContext('AudenJson', context);

test('decimal ties round half up without binary float errors', () => {
  assert.equal(d.round(d.add('0.1', '0.2'), 2), '0.30');
  assert.equal(d.round('1.005', 2), '1.01');
  assert.equal(d.round('2.675', 2), '2.68');
  assert.equal(d.round('-2.675', 2), '-2.68');
  assert.equal(d.round('-0.004', 2), '0.00');
  assert.equal(d.round('999.995', 2), '1000.00');
});

test('2500 CNY at the sample USD rate is exactly 350.425 before rounding', () => {
  const usd = catalog.currencies.find(currency => currency.code === 'USD');
  const value = d.multiply('2500', usd.rate);
  assert.equal(d.round(value, 3), '350.425');
  assert.equal(d.round(value, 2), '350.43');
  assert.equal(d.format(d.round(value, 2), 'en'), '350.43');
});

test('large amounts and fractions retain all digits through calculation and formatting', () => {
  assert.equal(d.round('9007199254740993.015', 2), '9007199254740993.02');
  assert.equal(d.format('9007199254740993.02', 'en'), '9,007,199,254,740,993.02');
  assert.equal(d.round(d.multiply(d.divide('1', '3'), '3'), 8), '1.00000000');
  assert.equal(d.round(d.divide('1', '3'), 8), '0.33333333');
  assert.equal(d.round('1.25e3', 2), '1250.00');
  assert.equal(d.round('5e-3', 2), '0.01');
});

test('currency cross-rates are exact until the final display boundary', () => {
  for (const from of catalog.currencies) for (const to of catalog.currencies) {
    assert.equal(typeof from.rate, 'string');
    const converted = d.multiply('123456789012345.6789', d.divide(to.rate, from.rate));
    const restored = d.multiply(converted, d.divide(from.rate, to.rate));
    assert.equal(d.round(restored, 4), '123456789012345.6789', `${from.code}/${to.code}`);
  }
  for (const code of ['JPY', 'KRW', 'VND']) {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
    assert.equal(digits, 0);
    assert.equal(d.round('123.5', digits), '124');
  }
  assert.equal(catalog.currencies.length, 24);
  assert.ok(!catalog.currencies.some(currency => currency.code === 'TWD'));
});

test('unit factors and temperature offsets preserve exact values', () => {
  assert.equal(d.round(d.multiply('1', '0.0254'), 8), '0.02540000');
  assert.equal(d.round(d.multiply('1', '0.45359237'), 8), '0.45359237');
  assert.equal(d.round(d.divide(d.subtract('98.6', '32'), '1.8'), 8), '37.00000000');
  assert.equal(d.round(d.subtract('273.15', '273.15'), 8), '0.00000000');
  assert.equal(d.format('37.00000000', 'ja', true), '37');
});

test('invalid and excessive numeric inputs fail explicitly', () => {
  for (const input of ['', 'NaN', 'Infinity', '1.2.3', '1,000', '1e101', '1e-101', '9'.repeat(201)]) assert.throws(() => d.parse(input));
  assert.throws(() => d.divide('1', '0'));
  assert.throws(() => d.round('1', 101));
});

test('time zones keep seconds, half-hour offsets and DST ambiguity', () => {
  const date = new Date('2026-07-15T12:34:56Z');
  for (const zone of ['UTC', ...catalog.cities.map(city => city.tz)]) {
    assert.ok(time.parse(time.format(date, zone), zone).some(candidate => candidate.getTime() === date.getTime()), zone);
  }
  assert.equal(time.format(date, 'Asia/Kolkata'), '2026-07-15T18:04:56');
  assert.equal(time.parse('2024-11-03T01:30:00', 'America/New_York').length, 2);
  assert.throws(() => time.parse('2024-03-10T02:30:00', 'America/New_York'));
  assert.throws(() => time.parse('2026-02-30T12:00:00', 'UTC'));
  assert.equal(time.parse('0001-01-01T00:00:01', 'UTC')[0].toISOString(), '0001-01-01T00:00:01.000Z');
  assert.equal(time.format(new Date('-000001-01-01T00:00:00Z'), 'UTC'), '-000001-01-01T00:00:00');
  const precise = new Date('2026-07-15T12:34:56.007Z');
  assert.equal(time.parse(time.format(precise, 'Asia/Shanghai', true), 'Asia/Shanghai')[0].getTime(), precise.getTime());
  assert.equal(time.parse('2026-07-15T12:34:56.1', 'UTC')[0].getUTCMilliseconds(), 100);
});

test('JSON formatting preserves large integers, precise decimals and original numeric notation', () => {
  const source = '{"id":9007199254740993,"amount":1.00000000000000000001,"huge":1e400,"zero":-0,"name":"金额 \\u4e2d","empty":[],"nested":[{},true,null]}';
  const formatted = json.format(source, 4);
  assert.ok(formatted.includes('\n    "id": 9007199254740993,'));
  assert.ok(formatted.includes('1.00000000000000000001'));
  assert.ok(formatted.includes('1e400'));
  assert.ok(formatted.includes('"zero": -0'));
  assert.equal(json.minify(formatted), source);
  assert.equal(json.format(' { "a": 1, "a": 2 } ', 0), '{"a":1,"a":2}');
  assert.throws(() => json.format('{"a":1,}'));
});
