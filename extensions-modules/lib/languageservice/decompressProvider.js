/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const decompress = require('decompress');
class DecompressProvider {
    decompress(pkg, logger) {
        return new Promise((resolve, reject) => {
            decompress(pkg.tmpFile.name, pkg.installPath).then(files => {
                logger.appendLine(`Done! ${files.length} files unpacked.\n`);
                resolve();
            }).catch(decompressErr => {
                logger.appendLine(`[ERROR] ${decompressErr}`);
                reject(decompressErr);
            });
        });
    }
}
exports.default = DecompressProvider;
//# sourceMappingURL=decompressProvider.js.map