// IANA time zone conversions, with explicit handling of repeated/skipped wall times.
const AudenTime = (() => {
  const formatters = new Map();
  function parts(date, timeZone) {
    if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-GB', {
      timeZone, era: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
      minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }));
    const result = Object.fromEntries(formatters.get(timeZone).formatToParts(date).map(part => [part.type, part.value]));
    if (result.era === 'BC') result.year = String(1 - Number(result.year));
    return result;
  }
  function format(date, timeZone = 'Asia/Shanghai', milliseconds = false) {
    const p = parts(date, timeZone);
    const year = Number(p.year);
    const yearText = year >= 0 && year <= 9999 ? p.year.padStart(4, '0') : `${year < 0 ? '-' : '+'}${String(Math.abs(year)).padStart(6, '0')}`;
    return `${yearText}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${milliseconds ? '.' + String(date.getUTCMilliseconds()).padStart(3, '0') : ''}`;
  }
  function utcValue(year, month, day, hour, minute, second) {
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, 0);
    return date;
  }
  function parse(value, timeZone) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
    if (!match) throw new Error('请输入完整的日期和时间。');
    const [year, month, day, hour, minute, second] = match.slice(1, 7).map(value => Number(value || 0));
    const milliseconds = Number((match[7] || '').padEnd(3, '0'));
    const wall = utcValue(year, month, day, hour, minute, second);
    if (year < 1 || wall.getUTCFullYear() !== year || wall.getUTCMonth() + 1 !== month ||
      wall.getUTCDate() !== day || wall.getUTCHours() !== hour || wall.getUTCMinutes() !== minute || wall.getUTCSeconds() !== second) {
      throw new Error('日期或时间无效，请检查输入。');
    }
    const expected = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}`;
    const offsets = new Set();
    // Inspect both sides of a transition; never assume a zone has a fixed UTC offset.
    for (let delta = -36; delta <= 36; delta += 6) {
      const probe = new Date(wall.getTime() + delta * 3600000);
      const p = parts(probe, timeZone);
      offsets.add(utcValue(Number(p.year), Number(p.month), Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)).getTime() - probe.getTime());
    }
    const candidates = [...offsets].map(offset => new Date(wall.getTime() - offset))
      .filter(date => format(date, timeZone) === expected).sort((a, b) => a - b);
    if (!candidates.length) throw new Error('该时区在此刻发生时钟跳转，这个当地时间不存在。请调整时间。');
    return candidates.map(date => new Date(date.getTime() + milliseconds));
  }
  return { parts, format, parse };
})();
