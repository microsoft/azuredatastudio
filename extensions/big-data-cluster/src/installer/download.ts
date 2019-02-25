/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as stream from 'stream';
import * as tmp from 'tmp';

import { succeeded, Errorable } from '../interfaces';

type DownloadFunc =
    (url: string, destination?: string, options?: any)
         => Promise<Buffer> & stream.Duplex; // Stream has additional events - see https://www.npmjs.com/package/download

let download: DownloadFunc;

function ensureDownloadFunc() {
    if (!download) {
        const home = process.env['HOME'];
        download = require('download');
        if (home) {
            process.env['HOME'] = home;
        }
    }
}

export async function toTempFile(sourceUrl: string): Promise<Errorable<string>> {
    const tempFileObj = tmp.fileSync({ prefix: "mssql-bdc-autoinstall-" });
    const downloadResult = await to(sourceUrl, tempFileObj.name);
    if (succeeded(downloadResult)) {
        return { succeeded: true, result: tempFileObj.name };
    }
    return { succeeded: false, error: downloadResult.error };
}

export async function to(sourceUrl: string, destinationFile: string): Promise<Errorable<null>> {
    ensureDownloadFunc();
    try {
        await download(sourceUrl, path.dirname(destinationFile), { filename: path.basename(destinationFile) });
        return { succeeded: true, result: null };
    } catch (e) {
        return { succeeded: false, error: [e.message] };
    }
}
