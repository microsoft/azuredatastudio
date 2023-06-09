/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

var https = require('https');
var fs = require('fs');

function download(filename, url) {
  var file = fs.createWriteStream(filename);
  var request = https.get(url, function (response) {
    response.pipe(file);
  });
}

console.log('Downloading azdata proposed typings');
download('typings/azdata.proposed.d.ts', 'https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/src/sql/azdata.proposed.d.ts');
