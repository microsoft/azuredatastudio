/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ClientSecretCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';
import { retry } from './retry';

function getEnv(name: string): string {
	const result = process.env[name];

	if (typeof result === 'undefined') {
		throw new Error('Missing env: ' + name);
	}

	return result;
}

interface Config {
	id: string;
	frozen: boolean;
}

function createDefaultConfig(quality: string): Config {
	return {
		id: quality,
		frozen: false
	};
}

async function getConfig(client: CosmosClient, quality: string): Promise<Config> {
	const query = `SELECT TOP 1 * FROM c WHERE c.id = "${quality}"`;

	const res = await client.database('builds').container('config').items.query(query).fetchAll();

	if (res.resources.length === 0) {
		return createDefaultConfig(quality);
	}

	return res.resources[0] as Config;
}

async function main(force: boolean): Promise<void> {
	const commit = getEnv('BUILD_SOURCEVERSION');
	const quality = getEnv('VSCODE_QUALITY');

	const aadCredentials = new ClientSecretCredential(process.env['AZURE_TENANT_ID']!, process.env['AZURE_CLIENT_ID']!, process.env['AZURE_CLIENT_SECRET']!);
	const client = new CosmosClient({ endpoint: process.env['AZURE_DOCUMENTDB_ENDPOINT']!, aadCredentials });

	if (!force) {
		const config = await getConfig(client, quality);

		console.log('Quality config:', config);

		if (config.frozen) {
			console.log(`Skipping release because quality ${quality} is frozen.`);
			return;
		}
	}

	console.log(`Releasing build ${commit}...`);

	const scripts = client.database('builds').container(quality).scripts;
	await retry(() => scripts.storedProcedure('releaseBuild').execute('', [commit]));
}

const [, , force] = process.argv;

console.log(process.argv);

main(/^true$/i.test(force)).then(() => {
	console.log('Build successfully released');
	process.exit(0);
}, err => {
	console.error(err);
	process.exit(1);
});
