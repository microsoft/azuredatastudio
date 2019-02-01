/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as constants from '../constants';
import * as utils from '../utils';
import ControllerBase from './controllerBase';
import { OpenSparkJobSubmissionDialogCommand, OpenSparkJobSubmissionDialogFromFileCommand,
        OpenSparkJobSubmissionDialogTask } from './dialog/dialogCommands';
import { OpenSparkYarnHistoryTask } from './historyTask';

/**
 * The main controller class that initializes the extension
 */
export default class SparkFeatureController extends ControllerBase {

    public deactivate(): void {
        utils.logDebug('Main controller deactivated');
    }

    public activate(): Promise<boolean> {
        this.hookSparkJobSubmissionDialog(this.outputChannel);
        this.hookSparkYarnHistory();
        return Promise.resolve(true);
    }

    private hookSparkJobSubmissionDialog(outputChannel: vscode.OutputChannel): void {
        this.extensionContext.subscriptions.push(new OpenSparkJobSubmissionDialogCommand(this.appContext, outputChannel));
        this.extensionContext.subscriptions.push(new OpenSparkJobSubmissionDialogFromFileCommand(this.appContext, outputChannel));
        this.apiWrapper.registerTaskHandler(constants.livySubmitSparkJobTask, (profile: sqlops.IConnectionProfile) => {
            new OpenSparkJobSubmissionDialogTask(this.appContext, outputChannel).execute(profile);
        });
    }

    private hookSparkYarnHistory(): void {
        this.apiWrapper.registerTaskHandler(constants.livyOpenSparkHistory, (profile: sqlops.IConnectionProfile) => {
            new OpenSparkYarnHistoryTask(this.appContext).execute(profile, true);
        });
        this.apiWrapper.registerTaskHandler(constants.livyOpenYarnHistory, (profile: sqlops.IConnectionProfile) => {
            new OpenSparkYarnHistoryTask(this.appContext).execute(profile, false);
        });
    }
}
