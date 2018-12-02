/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { OutputChannel } from 'vscode';

import { ILogService } from '../interfaces';

export class AzureResourceLogService implements ILogService {
    constructor(outputChannel: OutputChannel) {
        this._outputChannel = outputChannel;
    }

    public logInfo(info: string) {
        if (!info)
        {
            return;
        }

        info.split(/\r?\n/).forEach((line) => {
            if (line.length === 0)
            {
                return;
            }

            this._outputChannel.appendLine(`[INFO]: ${line}`);
        });
    }

    public logError(error: any) {
        if (!error) {
            return;
        }

        if (error instanceof Error) {
            this._outputChannel.appendLine(`[ERROR]: [${error.name}] - ${error.message}`);
        } else if (error instanceof String) {
            error.split(/\r?\n/).forEach((line) => {
                if (line.length === 0)
                {
                    return;
                }

                this._outputChannel.appendLine(`[ERROR]: ${line}`);
            });
        } else {
            this._outputChannel.appendLine(`[ERROR]: ${error}`);
        }
    }

    private _outputChannel: OutputChannel = undefined;
}