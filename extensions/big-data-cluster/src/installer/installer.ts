/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as download from './download';
import * as fs from 'fs';
import mkdirp = require('mkdirp');
import * as path from 'path';
import { Shell, Platform } from '../utility/shell';
import { Errorable, failed } from '../interfaces';
import { addPathToConfig, toolPathBaseKey } from '../config/config';

export async function installKubectl(shell: Shell): Promise<Errorable<null>> {
    const tool = 'kubectl';
    const binFile = (shell.isUnix()) ? 'kubectl' : 'kubectl.exe';
    const os = platformUrlString(shell.platform());

    const version = await getStableKubectlVersion();
    if (failed(version)) {
        return { succeeded: false, error: version.error };
    }

    const installFolder = getInstallFolder(shell, tool);
    mkdirp.sync(installFolder);

    const kubectlUrl = `https://storage.googleapis.com/kubernetes-release/release/${version.result.trim()}/bin/${os}/amd64/${binFile}`;
    const downloadFile = path.join(installFolder, binFile);
    const downloadResult = await download.to(kubectlUrl, downloadFile);
    if (failed(downloadResult)) {
        return { succeeded: false, error: [`Failed to download kubectl: ${downloadResult.error[0]}`] };
    }

    if (shell.isUnix()) {
        fs.chmodSync(downloadFile, '0777');
    }

    await addPathToConfig(toolPathBaseKey(tool), downloadFile);
    return { succeeded: true, result: null };
}

async function getStableKubectlVersion(): Promise<Errorable<string>> {
    const downloadResult = await download.toTempFile('https://storage.googleapis.com/kubernetes-release/release/stable.txt');
    if (failed(downloadResult)) {
        return { succeeded: false, error: [`Failed to establish kubectl stable version: ${downloadResult.error[0]}`] };
    }
    const version = fs.readFileSync(downloadResult.result, 'utf-8');
    fs.unlinkSync(downloadResult.result);
    return { succeeded: true, result: version };
}

export function getInstallFolder(shell: Shell, tool: string): string {
    return path.join(shell.home(), `.mssql-bdc/tools/${tool}`);
}

function platformUrlString(platform: Platform, supported?: Platform[]): string | null {
    if (supported && supported.indexOf(platform) < 0) {
        return null;
    }
    switch (platform) {
        case Platform.Windows: return 'windows';
        case Platform.MacOS: return 'darwin';
        case Platform.Linux: return 'linux';
        default: return null;
    }
}


