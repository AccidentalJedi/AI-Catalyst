const fs = require('fs');
const path = require('path');

// Create module-aliases.js file for production
const aliasesContent = `
const moduleAlias = require('module-alias');

// Setup module aliases for production
moduleAlias.addAliases({
  '@config': __dirname + '/config',
  '@controllers': __dirname + '/controllers',
  '@middleware': __dirname + '/middleware',
  '@models': __dirname + '/models',
  '@routes': __dirname + '/routes',
  '@services': __dirname + '/services',
  '@utils': __dirname + '/utils',
  '@types': __dirname + '/types',
  '@templates': __dirname + '/templates'
});

module.exports = moduleAlias;
`;

const distPath = path.join(__dirname, '../dist');
const aliasFilePath = path.join(distPath, 'module-aliases.js');

// Ensure dist directory exists
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

// Write the aliases file
fs.writeFileSync(aliasFilePath, aliasesContent.trim());

console.log('✅ Module aliases setup complete for production build');
