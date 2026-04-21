import { readFileSync, writeFileSync } from 'fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (!pkg.pnpm) pkg.pnpm = {};
if (!pkg.pnpm.onlyBuiltDependencies) pkg.pnpm.onlyBuiltDependencies = [];
if (!pkg.pnpm.onlyBuiltDependencies.includes('sharp')) {
  pkg.pnpm.onlyBuiltDependencies.push('sharp');
}
writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('sharp added to onlyBuiltDependencies');
