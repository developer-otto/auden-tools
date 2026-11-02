/* Validate JSON, then format the original tokens so numbers never pass through Number/stringify. */
const AudenJson = (() => {
  function format(source, spaces = 2) {
    JSON.parse(source); // Syntax validation only. Do not serialize this parsed value.
    const tokens = source.match(/"(?:\\.|[^"\\])*"|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g);
    if (spaces === 0) return tokens.join('');
    const indent = ' '.repeat(spaces);
    let depth = 0, output = '';
    const line = () => '\n' + indent.repeat(depth);
    tokens.forEach((token, index) => {
      if (token === '{' || token === '[') {
        output += token;
        depth += 1;
        if (tokens[index + 1] !== (token === '{' ? '}' : ']')) output += line();
      } else if (token === '}' || token === ']') {
        depth -= 1;
        if (tokens[index - 1] !== (token === '}' ? '{' : '[')) output += line();
        output += token;
      } else if (token === ',') output += ',' + line();
      else if (token === ':') output += ': ';
      else output += token;
    });
    return output;
  }
  return { format, minify: source => format(source, 0) };
})();
