/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Host } from './host';
import { FS } from '../utility/fs';
import { Shell, ShellResult } from '../utility/shell';
import * as binutil from './binutil';
import { Errorable } from '../interfaces';
import * as compatibility from './compatibility';
import { getToolPath } from '../config/config';

export interface Kubectl {
    checkPresent(errorMessageMode: CheckPresentMessageMode): Promise<boolean>;
    asJson<T>(command: string): Promise<Errorable<T>>;
}

interface Context {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    readonly installDependenciesCallback: () => void;
    binFound: boolean;
    binPath: string;
}

class KubectlImpl implements Kubectl {
    constructor(host: Host, fs: FS, shell: Shell, installDependenciesCallback: () => void, kubectlFound: boolean) {
        this.context = { host : host, fs : fs, shell : shell, installDependenciesCallback : installDependenciesCallback, binFound : kubectlFound, binPath : 'kubectl' };
    }

    private readonly context: Context;

    checkPresent(errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
        return checkPresent(this.context, errorMessageMode);
    }
    asJson<T>(command: string): Promise<Errorable<T>> {
        return asJson(this.context, command);
    }
}

export function create(host: Host, fs: FS, shell: Shell, installDependenciesCallback: () => void): Kubectl {
    return new KubectlImpl(host, fs, shell, installDependenciesCallback, false);
}

export enum CheckPresentMessageMode {
    Command,
    Activation,
    Silent,
}

async function checkPresent(context: Context, errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
    if (context.binFound) {
        return true;
    }

    return await checkForKubectlInternal(context, errorMessageMode);
}

async function checkForKubectlInternal(context: Context, errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
    const binName = 'kubectl';
    const bin = getToolPath(context.host, context.shell, binName);

    const contextMessage = getCheckKubectlContextMessage(errorMessageMode);
    const inferFailedMessage = `Could not find "${binName}" binary.${contextMessage}`;
    const configuredFileMissingMessage = `${bin} is not installed. ${contextMessage}`;

    return await binutil.checkForBinary(context, bin, binName, inferFailedMessage, configuredFileMissingMessage, errorMessageMode !== CheckPresentMessageMode.Silent);
}

function getCheckKubectlContextMessage(errorMessageMode: CheckPresentMessageMode): string {
    if (errorMessageMode === CheckPresentMessageMode.Activation) {
        return ' SQL Server Big data cluster requires kubernetes.';
    } else if (errorMessageMode === CheckPresentMessageMode.Command) {
        return ' Cannot execute command.';
    }
    return '';
}

async function invokeAsync(context: Context, command: string, stdin?: string): Promise<ShellResult | undefined> {
    if (await checkPresent(context, CheckPresentMessageMode.Command)) {
        const bin = baseKubectlPath(context);
        const cmd = `${bin} ${command}`;
        const sr = await context.shell.exec(cmd, stdin);
        if (sr && sr.code !== 0) {
            checkPossibleIncompatibility(context);
        }
        return sr;
    } else {
        return { code: -1, stdout: '', stderr: '' };
    }
}

// TODO: invalidate this when the context changes or if we know kubectl has changed (e.g. config)
let checkedCompatibility = false;  // We don't want to spam the user (or CPU!) repeatedly running the version check

async function checkPossibleIncompatibility(context: Context): Promise<void> {
    if (checkedCompatibility) {
        return;
    }
    checkedCompatibility = true;
    const compat = await compatibility.check((cmd) => asJson<compatibility.Version>(context, cmd));
    if (!compatibility.isGuaranteedCompatible(compat) && compat.didCheck) {
        const versionAlert = `kubectl version ${compat.clientVersion} may be incompatible with cluster Kubernetes version ${compat.serverVersion}`;
        context.host.showWarningMessage(versionAlert);
    }
}


function baseKubectlPath(context: Context): string {
    let bin = getToolPath(context.host, context.shell, 'kubectl');
    if (!bin) {
        bin = 'kubectl';
    }
    return bin;
}

async function asJson<T>(context: Context, command: string): Promise<Errorable<T>> {
    const shellResult = await invokeAsync(context, command);
    if (!shellResult) {
        return { succeeded: false, error: [`Unable to run command (${command})`] };
    }

    if (shellResult.code === 0) {
        return { succeeded: true, result: JSON.parse(shellResult.stdout.trim()) as T };

    }
    return { succeeded: false, error: [ shellResult.stderr ] };
}