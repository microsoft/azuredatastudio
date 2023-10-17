const glob = require('glob');
const path = require('path');

require('ts-node').register({ experimentalResolver: true, transpileOnly: true, compilerOptions: { module: 'commonjs' } }); // {{SQL CARBON EDIT}} Need to specify compilerOptions to resolve ts-node error: x Unable to compile TypeScript

// Re-export all .ts files as rules
const rules = {};
glob.sync(`${__dirname}/*.ts`).forEach((file) => {
	rules[path.basename(file, '.ts')] = require(file);
});

exports.rules = rules;
