/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const cosmos_1 = require("@azure/cosmos");
function createDefaultConfig(quality) {
    return {
        id: quality,
        frozen: false
    };
}
async function getConfig(quality) {
    const client = new cosmos_1.CosmosClient({ endpoint: process.env['AZURE_DOCUMENTDB_ENDPOINT'], key: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
    const query = {
        query: `SELECT TOP 1 * FROM c WHERE c.id = @quality`,
        parameters: [
            { name: '@quality', value: quality }
        ]
    };
    const res = await client.database('builds').container('config').items.query(query).fetchAll();
    if (res.resources.length === 0) {
        return createDefaultConfig(quality);
    }
    return res.resources[0];
}
async function doRelease(commit, quality) {
    const client = new cosmos_1.CosmosClient({ endpoint: process.env['AZURE_DOCUMENTDB_ENDPOINT'], key: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
    const query = {
        query: 'SELECT TOP 1 * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: commit }]
    };
    const res = await client.database('builds').container(quality).items.query(query).fetchAll();
    if (res.resources.length === 0) {
        throw new Error('No documents');
    }
    const release = res.resources[0];
    release.isReleased = true;
    await client.database('builds').container(quality).item(release.id).replace(release._self);
    console.log('Build successfully updated.');
}
async function release(commit, quality) {
    const config = await getConfig(quality);
    console.log('Quality config:', config);
    if (config.frozen) {
        console.log(`Skipping release because quality ${quality} is frozen.`);
        return;
    }
    await doRelease(commit, quality);
}
function env(name) {
    const result = process.env[name];
    if (!result) {
        throw new Error(`Skipping release due to missing env: ${name}`);
    }
    return result;
}
async function main() {
    const commit = env('BUILD_SOURCEVERSION');
    const quality = env('VSCODE_QUALITY');
    await release(commit, quality);
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
