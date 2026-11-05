const digit = /[0-9۰-۹٠-٩]/;
const separators = /[,٬\s]/g;

// Keep invalid decimals/signs visible so validation never silently changes an amount.
export function formatMoneyInput(value: string, caret = value.length) {
  const dotGrouped = /^[0-9۰-۹٠-٩]{1,3}(?:\.[0-9۰-۹٠-٩]{3})+$/.test(value);
  const clean = value.replace(separators, "").replace(dotGrouped ? /\./g : /$^/g, "");
  if (!/^[0-9۰-۹٠-٩]*$/.test(clean)) return { value, caret };
  const formatted = clean.replace(/([0-9۰-۹٠-٩])(?=(?:[0-9۰-۹٠-٩]{3})+$)/g, "$1٬");
  const before = [...value.slice(0, caret)].filter(char => digit.test(char)).length;
  let position = 0, count = 0;
  while (position < formatted.length && count < before) {
    if (digit.test(formatted[position])) count++;
    position++;
  }
  return { value: formatted, caret: position };
}
