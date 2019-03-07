/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

 import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { Shell } from '../utility/shell';
import { Host } from './host';
import { FS } from '../utility/fs';

export interface BinCheckContext {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    readonly installDependenciesCallback: () => void;
    binFound: boolean;
    binPath: string;
}

interface FindBinaryResult {
    err: number | null;
    output: string;
}

async function findBinary(shell: Shell, binName: string): Promise<FindBinaryResult> {
    let cmd = `which ${binName}`;

    if (shell.isWindows()) {
        cmd = `where.exe ${binName}.exe`;
    }

    const opts = {
        async: true,
        env: {
            HOME: process.env.HOME,
            PATH: process.env.PATH
        }
    };

    const execResult = await shell.execCore(cmd, opts);
    if (execResult.code) {
        return { err: execResult.code, output: execResult.stderr };
    }

    return { err: null, output: execResult.stdout };
}

export function execPath(shell: Shell, basePath: string): string {
    let bin = basePath;
    if (shell.isWindows() && bin && !(bin.endsWith('.exe'))) {
        bin = bin + '.exe';
    }
    return bin;
}

type CheckPresentFailureReason = 'inferFailed' | 'configuredFileMissing';
const installDependenciesAction = localize('installDependenciesAction','Install dependencies');
const learnMoreAction = localize('learnMoreAction','Learn more');
function alertNoBin(host: Host, binName: string, failureReason: CheckPresentFailureReason, message: string, installDependencies: () => void): void {
    switch (failureReason) {
        case 'inferFailed':
            host.showErrorMessage(message, installDependenciesAction, learnMoreAction).then(
                (str) => {
                    switch (str) {
                        case learnMoreAction:
                            host.showInformationMessage(localize('moreInfoMsg', 'Add {0} directory to path, or set "mssql-bdc.{0}-path" config to {0} binary.', binName));
                            break;
                        case installDependenciesAction:
                            installDependencies();
                            break;
                    }

                }
            );
            break;
        case 'configuredFileMissing':
            host.showErrorMessage(message, installDependenciesAction).then(
                (str) => {
                    if (str === installDependenciesAction) {
                        installDependencies();
                    }
                }
            );
            break;
    }
}

export async function checkForBinary(context: BinCheckContext, bin: string | undefined, binName: string, inferFailedMessage: string, configuredFileMissingMessage: string, alertOnFail: boolean): Promise<boolean> {
    if (!bin) {
        const fb = await findBinary(context.shell, binName);

        if (fb.err || fb.output.length === 0) {
            if (alertOnFail) {
                alertNoBin(context.host, binName, 'inferFailed', inferFailedMessage, context.installDependenciesCallback);
            }
            return false;
        }

        context.binFound = true;

        return true;
    }

    if (context.shell.isWindows) {
        context.binFound = context.fs.existsSync(bin);
    } else {
        const sr = await context.shell.exec(`ls ${bin}`);
        context.binFound = (!!sr && sr.code === 0);
    }
    if (context.binFound) {
        context.binPath = bin;
    } else {
        if (alertOnFail) {
            alertNoBin(context.host, binName, 'configuredFileMissing', configuredFileMissingMessage, context.installDependenciesCallback);
        }
    }

    return context.binFound;
}
