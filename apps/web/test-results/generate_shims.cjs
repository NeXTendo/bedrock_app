const fs = require('fs');
const path = require('path');

const shimsDir = path.resolve(__dirname, '../src/shims/es-toolkit/compat');
if (!fs.existsSync(shimsDir)) {
  fs.mkdirSync(shimsDir, { recursive: true });
}

const funcs = [
  'get',
  'uniqBy',
  'sortBy',
  'isPlainObject',
  'range',
  'last',
  'maxBy',
  'minBy',
  'throttle',
  'omit',
  'sumBy'
];

funcs.forEach(func => {
  const content = `import { ${func} } from 'es-toolkit/compat';\nexport default ${func};\n`;
  fs.writeFileSync(path.join(shimsDir, `${func}.ts`), content);
  console.log(`Generated shim for ${func}`);
});
