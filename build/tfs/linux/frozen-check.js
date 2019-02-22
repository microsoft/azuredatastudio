/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var documentdb_1 = require("documentdb");
function createDefaultConfig(quality) {
    return {
        id: quality,
        frozen: false
    };
}
function getConfig(quality) {
    var client = new documentdb_1.DocumentClient(process.env['AZURE_DOCUMENTDB_ENDPOINT'], { masterKey: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
    var collection = 'dbs/builds/colls/config';
    var query = {
        query: "SELECT TOP 1 * FROM c WHERE c.id = @quality",
        parameters: [
            { name: '@quality', value: quality }
        ]
    };
    return new Promise(function (c, e) {
        client.queryDocuments(collection, query).toArray(function (err, results) {
            if (err && err.code !== 409) {
                return e(err);
            }
            c(!results || results.length === 0 ? createDefaultConfig(quality) : results[0]);
        });
    });
}
getConfig(process.argv[2])
    .then(function (config) {
    console.log(config.frozen);
    process.exit(0);
})
    .catch(function (err) {
    console.error(err);
    process.exit(1);
});
