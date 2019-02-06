/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
const localize = nls.loadMessageBundle();

import { ICommandViewContext, Command, ICommandObjectExplorerContext, ICommandUnknownContext } from '../../objectExplorerNodeProvider/command';
import { SparkJobSubmissionDialog } from './sparkJobSubmission/sparkJobSubmissionDialog';
import { AppContext } from '../../appContext';
import { getErrorMessage } from '../../utils';
import * as constants from '../../constants';
import { HdfsFileSourceNode } from '../../objectExplorerNodeProvider/hdfsProvider';
import { getNode } from '../../objectExplorerNodeProvider/hdfsCommands';
import * as LocalizedConstants from '../../localizedConstants';
import * as SqlClusterLookUp from '../../sqlClusterLookUp';
import { SqlClusterConnection } from '../../objectExplorerNodeProvider/connection';

export class OpenSparkJobSubmissionDialogCommand extends Command {
	constructor(appContext: AppContext, private outputChannel: vscode.OutputChannel) {
		super(constants.mssqlClusterLivySubmitSparkJobCommand, appContext);
	}

	protected async preExecute(context: ICommandUnknownContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandUnknownContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let sqlClusterConnection: SqlClusterConnection = undefined;
			if (context.type === constants.ObjectExplorerService) {
				sqlClusterConnection = SqlClusterLookUp.findSqlClusterConnection(context, this.appContext);
			}
			if (!sqlClusterConnection) {
				sqlClusterConnection = await this.selectConnection();
			}

			let dialog = new SparkJobSubmissionDialog(sqlClusterConnection, this.appContext, this.outputChannel);
			await dialog.openDialog();
		} catch (error) {
			this.appContext.apiWrapper.showErrorMessage(getErrorMessage(error));
		}
	}

	private async selectConnection(): Promise<SqlClusterConnection> {
		let connectionList: sqlops.connection.Connection[] = await this.apiWrapper.getActiveConnections();
		let displayList: string[] = new Array();
		let connectionMap: Map<string, sqlops.connection.Connection> = new Map();
		if (connectionList && connectionList.length > 0) {
			connectionList.forEach(conn => {
				if (conn.providerName === constants.sqlProviderName) {
					displayList.push(conn.options.host);
					connectionMap.set(conn.options.host, conn);
				}
			});
		}

		let selectedHost: string = await vscode.window.showQuickPick(displayList, {
			placeHolder:
				localize('sparkJobSubmission_PleaseSelectSqlWithCluster',
					'Please select SQL Server with Big Data Cluster. ')
		});
		let errorMsg = localize('sparkJobSubmission_NoSqlSelected', 'No Sql Server is selected.');
		if (!selectedHost) { throw new Error(errorMsg); }

		let sqlConnection = connectionMap.get(selectedHost);
		if (!sqlConnection) { throw new Error(errorMsg); }

		let sqlClusterConnection = await SqlClusterLookUp.getSqlClusterConnection(sqlConnection);
		if (!sqlClusterConnection) {
			throw new Error(LocalizedConstants.sparkJobSubmissionNoSqlBigDataClusterFound);
		}

		return new SqlClusterConnection(sqlClusterConnection);
	}
}

// Open the submission dialog for a specific file path.
export class OpenSparkJobSubmissionDialogFromFileCommand extends Command {
	constructor(appContext: AppContext, private outputChannel: vscode.OutputChannel) {
		super(constants.mssqlClusterLivySubmitSparkJobFromFileCommand, appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		let path: string = undefined;
		try {
			let node = await getNode<HdfsFileSourceNode>(context, this.appContext);
			if (node && node.hdfsPath) {
				path = node.hdfsPath;
			} else {
				this.apiWrapper.showErrorMessage(LocalizedConstants.msgMissingNodeContext);
				return;
			}
		} catch (err) {
			this.apiWrapper.showErrorMessage(localize('sparkJobSubmission_GetFilePathFromSelectedNodeFailed', 'Error Get File Path: {0}', err));
			return;
		}

		try {
			let sqlClusterConnection: SqlClusterConnection = undefined;
			if (context.type === constants.ObjectExplorerService) {
				sqlClusterConnection = await SqlClusterLookUp.findSqlClusterConnection(context, this.appContext);
			}
			if (!sqlClusterConnection) {
				throw new Error(LocalizedConstants.sparkJobSubmissionNoSqlBigDataClusterFound);
			}
			let dialog = new SparkJobSubmissionDialog(sqlClusterConnection, this.appContext, this.outputChannel);
			await dialog.openDialog(path);
		} catch (error) {
			this.appContext.apiWrapper.showErrorMessage(getErrorMessage(error));
		}
	}
}

export class OpenSparkJobSubmissionDialogTask {
	constructor(private appContext: AppContext, private outputChannel: vscode.OutputChannel) {
	}

	async execute(profile: sqlops.IConnectionProfile, ...args: any[]): Promise<void> {
		try {
			let sqlClusterConnection = SqlClusterLookUp.findSqlClusterConnection(profile, this.appContext);
			if (!sqlClusterConnection) {
				throw new Error(LocalizedConstants.sparkJobSubmissionNoSqlBigDataClusterFound);
			}
			let dialog = new SparkJobSubmissionDialog(sqlClusterConnection, this.appContext, this.outputChannel);
			await dialog.openDialog();
		} catch (error) {
			this.appContext.apiWrapper.showErrorMessage(getErrorMessage(error));
		}
	}
}
