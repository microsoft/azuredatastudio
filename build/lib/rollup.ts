/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as rollup from 'rollup';
import * as path from 'path';

// getting around stupid import rules
const nodeResolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');

export interface IRollupOptions {
	moduleName: string;
	inputFile: string;
	outputDirectory: string;
	outputFileName: string;
	external?: string[];
}

async function rollupModule(options: IRollupOptions) {
	const moduleName = options.moduleName;
	try {
		const inputFile = options.inputFile;
		const outputDirectory = options.outputDirectory;

		await fs.promises.mkdir(outputDirectory, {
			recursive: true
		});

		const outputFileName = options.outputFileName;
		const outputMapName = `${outputFileName}.map`;
		const external = options.external || [];

		const outputFilePath = path.resolve(outputDirectory, outputFileName);
		const outputMapPath = path.resolve(outputDirectory, outputMapName);

		const bundle = await rollup.rollup({
			input: inputFile,
			plugins: [
				nodeResolve(),
				commonjs(),
			],
			external,
		});

		const generatedBundle = await bundle.generate({
			name: moduleName,
			format: 'umd',
			sourcemap: true
		});

		const result = generatedBundle.output[0];
		result.code = result.code + '\n//# sourceMappingURL=' + path.basename(outputMapName);

		await fs.promises.writeFile(outputFilePath, result.code);
		await fs.promises.writeFile(outputMapPath, result.map);

		return {
			name: moduleName,
			result: true
		};
	} catch (ex) {
		return {
			name: moduleName,
			result: false,
			exception: ex
		};
	}
}

export function rollupAngular(root: string): Promise<void> {
	return new Promise(async (resolve, reject) => {

		const modules = ['core', 'animations', 'common', 'compiler', 'forms', 'platform-browser', 'platform-browser-dynamic', 'router'];
		const tasks = modules.map((module) => {
			return rollupModule({
				moduleName: `ng.${module}`,
				inputFile: path.resolve(root, 'node_modules', '@angular', module, '@angular', `${module}.es5.js`),
				outputDirectory: path.resolve(root, 'node_modules', '@angular', module, 'bundles'),
				outputFileName: `${module}.umd.js`,
				external: modules.map(mn => `@angular/${mn}`)
			});
		});

		// array of booleans
		const x = await Promise.all(tasks);

		const result = x.reduce<{ fails: string[]; exceptions: string[]; result: boolean }>((prev, current) => {
			if (!current.result) {
				prev.fails.push(current.name);
				prev.exceptions.push(current.exception);
				prev.result = false;
			}
			return prev;
		}, {
			fails: [],
			exceptions: [],
			result: true,
		});

		if (!result.result) {
			return reject(`failures: ${result.fails} - exceptions: ${JSON.stringify(result.exceptions)}`);
		}
		resolve();
	});

}
