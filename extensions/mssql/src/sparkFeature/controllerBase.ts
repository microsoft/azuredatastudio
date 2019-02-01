/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

import * as Constants from '../constants';
import { ApiWrapper } from '../apiWrapper';
import { IPrompter } from '../prompts/question';
import { AppContext } from '../appContext';

export default abstract class ControllerBase implements vscode.Disposable {
    protected outputChannel: vscode.OutputChannel;
    protected prompter: IPrompter;

    public constructor(protected appContext: AppContext) {
        // Create an output channel
        this.outputChannel = this.appContext.apiWrapper.createOutputChannel(Constants.extensionOutputChannel);
    }

    protected get apiWrapper(): ApiWrapper {
        return this.appContext.apiWrapper;
    }

    public get extensionContext(): vscode.ExtensionContext {
        return this.appContext && this.appContext.extensionContext;
    }

    abstract activate(): Promise<boolean>;

    abstract deactivate(): void;

    public dispose(): void {
        this.deactivate();
    }
}

