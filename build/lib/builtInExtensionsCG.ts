/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import got from 'got';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import ansiColors = require('ansi-colors');
import { IExtensionDefinition } from './builtInExtensions';

const root = path.dirname(path.dirname(__dirname));
const rootCG = path.join(root, 'extensionsCG');
const productjson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../product.json'), 'utf8'));
const builtInExtensions = <IExtensionDefinition[]>productjson.builtInExtensions || [];
const webBuiltInExtensions = <IExtensionDefinition[]>productjson.webBuiltInExtensions || [];
const token = process.env['VSCODE_MIXIN_PASSWORD'] || process.env['GITHUB_TOKEN'] || undefined;

const contentBasePath = 'raw.githubusercontent.com';
const contentFileNames = ['package.json', 'package-lock.json', 'yarn.lock'];

async function downloadExtensionDetails(extension: IExtensionDefinition): Promise<void> {
	const extensionLabel = `${extension.name}@${extension.version}`;
	const repository = url.parse(extension.repo).path!.substr(1);
	const repositoryContentBaseUrl = `https://${token ? `${token}@` : ''}${contentBasePath}/${repository}/v${extension.version}`;

	const promises = [];
	for (const fileName of contentFileNames) {
		promises.push(new Promise<{ fileName: string, body: Buffer | undefined | null }>(resolve => {
			got(`${repositoryContentBaseUrl}/${fileName}`)
				.then(response => {
					resolve({ fileName, body: response.rawBody });
				})
				.catch(error => {
					if (error.response.statusCode === 404) {
						resolve({ fileName, body: undefined });
					} else {
						resolve({ fileName, body: null });
					}
				});
		}));
	}

	console.log(extensionLabel);
	const results = await Promise.all(promises);
	for (const result of results) {
		if (result.body) {
			const extensionFolder = path.join(rootCG, extension.name);
			fs.mkdirSync(extensionFolder, { recursive: true });
			fs.writeFileSync(path.join(extensionFolder, result.fileName), result.body);
			console.log(`  - ${result.fileName} ${ansiColors.green('✔︎')}`);
		} else if (result.body === undefined) {
			console.log(`  - ${result.fileName} ${ansiColors.yellow('⚠️')}`);
		} else {
			console.log(`  - ${result.fileName} ${ansiColors.red('🛑')}`);
		}
	}

	// Validation
	if (!results.find(r => r.fileName === 'package.json')?.body) {
		// throw new Error(`The "package.json" file could not be found for the built-in extension - ${extensionLabel}`);
	}
	if (!results.find(r => r.fileName === 'package-lock.json')?.body &&
		!results.find(r => r.fileName === 'yarn.lock')?.body) {
		// throw new Error(`The "package-lock.json"/"yarn.lock" could not be found for the built-in extension - ${extensionLabel}`);
	}
}

async function main(): Promise<void> {
	for (const extension of [...builtInExtensions, ...webBuiltInExtensions]) {
		await downloadExtensionDetails(extension);
	}
}

main().then(() => {
	console.log(`Built-in extensions component data downloaded ${ansiColors.green('✔︎')}`);
	process.exit(0);
}, err => {
	console.log(`Built-in extensions component data could not be downloaded ${ansiColors.red('🛑')}`);
	console.error(err);
	process.exit(1);
});
