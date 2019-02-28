/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as path from 'path';
import * as shelljs from 'shelljs';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { IConfig, ServerProvider } from 'service-downloader';
import { Telemetry } from './telemetry';
import * as utils from './utils';

const baseConfig = require('./config.json');
const localize = nls.loadMessageBundle();

let exePath:string;

export function activate(context: vscode.ExtensionContext): Promise<void> {

    // Only supported on Win32 currently, display error message if not that until extensions are able to block install
    // based on conditions
    if(process.platform === 'win32') {
        let config: IConfig = JSON.parse(JSON.stringify(baseConfig));
        config.installDirectory = path.join(context.extensionPath, config.installDirectory);
        config.proxy = utils.getConfiguration('http').get('proxy');
        config.strictSSL = utils.getConfiguration('http').get('proxyStrictSSL') || true;

        const serverdownloader = new ServerProvider(config);
        const installationStart = Date.now();

        return new Promise((resolve, reject) => {
            serverdownloader.getOrDownloadServer().then(e => {
                const installationComplete = Date.now();

                Telemetry.sendTelemetryEvent('startup/ExtensionStarted', {
                    installationTime: String(installationComplete - installationStart),
                    beginningTimestamp: String(installationStart)
                });
                serverdownloader.getServerPath().then(path =>
                    {
                        // Don't register the command if we couldn't find the EXE since it won't be able to do anything
                        if(path) {
                            exePath = path;
                            context.subscriptions.push(
                                vscode.commands.registerCommand('adsWindowsSupport.launchSsmsDialog', handleLaunchSsmsDialogCommand));
                        }
                        resolve();
                    });
            }, e => {
                Telemetry.sendTelemetryEvent('startup/ExtensionInitializationFailed');
                // Just resolve to avoid unhandled promise. We show the error to the user.
                resolve();
            });
        });
    } else {
        vscode.window.showErrorMessage(localize('adsWindowsSupport.onlySupportedOnWindows', 'The ADS Windows Support Extension is only supported on Windows platforms.'));
    }
}

/**
 * Handler for the commmand to launch an SSMS dialog using SsmsMin.exe
 * @param params The params used to construct the command
 */
function handleLaunchSsmsDialogCommand(params: sqlops.adsWindowsSupport.LaunchSsmsDialogParams) {
    Telemetry.sendTelemetryEvent('LaunchSsmsDialog', { 'action': params.action});
    let args = buildSsmsMinCommandArgs(params);
    var proc = shelljs.exec(
        /*command*/`"${exePath}" ${args}`,
        /*options*/'',
        (code, stdout, stderr) => {
            Telemetry.sendTelemetryEvent('LaunchSsmsDialogResult', {
                'action': params.action,
                'returnCode': code
            });
        });

    // If we're not using AAD the tool prompts for a password on stdin
    if(params.useAad !== true) {
        proc.stdin.end(params.password ? params.password : '');
    }
}

/**
 * Builds the command arguments to pass to SsmsMin.exe
 * @param params The params used to build up the command parameter string
 */
function buildSsmsMinCommandArgs(params: sqlops.adsWindowsSupport.LaunchSsmsDialogParams): string {
    return `${params.action ? '-a "' + params.action + '"' : ''}\
    ${params.server ? '-S "' + params.server + '"' : ''} \
    ${params.database ? '-D "' + params.database + '"' : ''} \
    ${params.useAad !== true ? '-U "' + params.user + '"' : ''} \
    ${params.useAad === true ? '-G': ''} \
    ${params.urn ? '-u "' + params.urn + '"' : ''}`;
}
