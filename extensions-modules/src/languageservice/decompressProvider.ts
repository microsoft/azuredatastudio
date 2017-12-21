/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDecompressProvider, IPackage } from './interfaces';
import  { ILogger } from '../models/interfaces';
const decompress = require('decompress');

export default class DecompressProvider implements IDecompressProvider {
    public decompress(pkg: IPackage, logger: ILogger): Promise<void> {
        return new Promise<void>((resolve, reject) => {
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
