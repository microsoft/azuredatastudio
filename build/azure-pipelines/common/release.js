/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const documentdb_1 = require("documentdb");
function createDefaultConfig(quality) {
    return {
        id: quality,
        frozen: false
    };
}
function getConfig(quality) {
    const client = new documentdb_1.DocumentClient(process.env['AZURE_DOCUMENTDB_ENDPOINT'], { masterKey: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
    const collection = 'dbs/builds/colls/config';
    const query = {
        query: `SELECT TOP 1 * FROM c WHERE c.id = @quality`,
        parameters: [
            { name: '@quality', value: quality }
        ]
    };
    return new Promise((c, e) => {
        client.queryDocuments(collection, query).toArray((err, results) => {
            if (err && err.code !== 409) {
                return e(err);
            }
            c(!results || results.length === 0 ? createDefaultConfig(quality) : results[0]);
        });
    });
}
function doRelease(commit, quality) {
    const client = new documentdb_1.DocumentClient(process.env['AZURE_DOCUMENTDB_ENDPOINT'], { masterKey: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
    const collection = 'dbs/builds/colls/' + quality;
    const query = {
        query: 'SELECT TOP 1 * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: commit }]
    };
    let updateTries = 0;
    function update() {
        updateTries++;
        return new Promise((c, e) => {
            client.queryDocuments(collection, query).toArray((err, results) => {
                if (err) {
                    return e(err);
                }
                if (results.length !== 1) {
                    return e(new Error('No documents'));
                }
                const release = results[0];
                release.isReleased = true;
                client.replaceDocument(release._self, release, err => {
                    if (err && err.code === 409 && updateTries < 5) {
                        return c(update());
                    }
                    if (err) {
                        return e(err);
                    }
                    console.log('Build successfully updated.');
                    c();
                });
            });
        });
    }
    return update();
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
