/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as shelljs from 'shelljs';
import * as path from 'path';
import { getActiveKubeconfig, getToolPath } from '../config/config';
import { host } from '../kubectl/host';

export enum Platform {
    Windows,
    MacOS,
    Linux,
    Unsupported,
}

export interface ExecCallback extends shelljs.ExecCallback {}

export interface Shell {
    isWindows(): boolean;
    isUnix(): boolean;
    platform(): Platform;
    home(): string;
    combinePath(basePath: string, relativePath: string): string;
    fileUri(filePath: string): vscode.Uri;
    execOpts(): any;
    exec(cmd: string, stdin?: string): Promise<ShellResult | undefined>;
    execCore(cmd: string, opts: any, stdin?: string): Promise<ShellResult>;
    unquotedPath(path: string): string;
    which(bin: string): string | null;
    cat(path: string): string;
    ls(path: string): string[];
}

export const shell: Shell = {
    isWindows : isWindows,
    isUnix : isUnix,
    platform : platform,
    home : home,
    combinePath : combinePath,
    fileUri : fileUri,
    execOpts : execOpts,
    exec : exec,
    execCore : execCore,
    unquotedPath : unquotedPath,
    which: which,
    cat: cat,
    ls: ls,
};

const WINDOWS: string = 'win32';

export interface ShellResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

export type ShellHandler = (code: number, stdout: string, stderr: string) => void;

function isWindows(): boolean {
    return (process.platform === WINDOWS);
}

function isUnix(): boolean {
    return !isWindows();
}

function platform(): Platform {
    switch (process.platform) {
        case 'win32': return Platform.Windows;
        case 'darwin': return Platform.MacOS;
        case 'linux': return Platform.Linux;
        default: return Platform.Unsupported;
    }
}

function concatIfBoth(s1: string | undefined, s2: string | undefined): string | undefined {
    return s1 && s2 ? s1.concat(s2) : undefined;
}

function home(): string {
    return process.env['HOME'] ||
        concatIfBoth(process.env['HOMEDRIVE'], process.env['HOMEPATH']) ||
        process.env['USERPROFILE'] ||
        '';
}

function combinePath(basePath: string, relativePath: string) {
    let separator = '/';
    if (isWindows()) {
        relativePath = relativePath.replace(/\//g, '\\');
        separator = '\\';
    }
    return basePath + separator + relativePath;
}

function isWindowsFilePath(filePath: string) {
    return filePath[1] === ':' && filePath[2] === '\\';
}

function fileUri(filePath: string): vscode.Uri {
    if (isWindowsFilePath(filePath)) {
        return vscode.Uri.parse('file:///' + filePath.replace(/\\/g, '/'));
    }
    return vscode.Uri.parse('file://' + filePath);
}

function execOpts(): any {
    let env = process.env;
    if (isWindows()) {
        env = Object.assign({ }, env, { HOME: home() });
    }
    env = shellEnvironment(env);
    const opts = {
        cwd: vscode.workspace.rootPath,
        env: env,
        async: true
    };
    return opts;
}

async function exec(cmd: string, stdin?: string): Promise<ShellResult | undefined> {
    try {
        return await execCore(cmd, execOpts(), stdin);
    } catch (ex) {
        vscode.window.showErrorMessage(ex);
        return undefined;
    }
}

function execCore(cmd: string, opts: any, stdin?: string): Promise<ShellResult> {
    return new Promise<ShellResult>((resolve) => {
        const proc = shelljs.exec(cmd, opts, (code, stdout, stderr) => resolve({code : code, stdout : stdout, stderr : stderr}));
        if (stdin) {
            proc.stdin.end(stdin);
        }
    });
}

function unquotedPath(path: string): string {
    if (isWindows() && path && path.length > 1 && path.startsWith('"') && path.endsWith('"')) {
        return path.substring(1, path.length - 1);
    }
    return path;
}

export function shellEnvironment(baseEnvironment: any): any {
    const env = Object.assign({}, baseEnvironment);
    const pathVariable = pathVariableName(env);
    for (const tool of ['kubectl']) {
        const toolPath = getToolPath(host, shell, tool);
        if (toolPath) {
            const toolDirectory = path.dirname(toolPath);
            const currentPath = env[pathVariable];
            env[pathVariable] = toolDirectory + (currentPath ? `${pathEntrySeparator()}${currentPath}` : '');
        }
    }

    const kubeconfig = getActiveKubeconfig();
    if (kubeconfig) {
        env['KUBECONFIG'] = kubeconfig;
    }

    return env;
}

function pathVariableName(env: any): string {
    if (isWindows()) {
        for (const v of Object.keys(env)) {
            if (v.toLowerCase() === "path") {
                return v;
            }
        }
    }
    return "PATH";
}

function pathEntrySeparator() {
    return isWindows() ? ';' : ':';
}

function which(bin: string): string | null {
    return shelljs.which(bin);
}

function cat(path: string): string {
    return shelljs.cat(path);
}

function ls(path: string): string[] {
    return shelljs.ls(path);
}

export function shellMessage(sr: ShellResult | undefined, invocationFailureMessage: string): string {
    if (!sr) {
        return invocationFailureMessage;
    }
    return sr.code === 0 ? sr.stdout : sr.stderr;
}
