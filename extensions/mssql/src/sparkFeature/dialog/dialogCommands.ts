/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
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

interface MssqlOptions {
	server: string;
}

const timeout = (millis: number) => new Promise(c => setTimeout(c, millis));

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
			vscode.window.showErrorMessage(getErrorMessage(error));
		}
	}

	private async selectConnection(): Promise<SqlClusterConnection> {
		let connectionList: azdata.connection.Connection[] = await azdata.connection.getActiveConnections();
		let connectionMap: Map<string, azdata.connection.Connection> = new Map();
		let selectedHost: string = undefined;
		let showConnectionDialog = false;

		// Filter invalid connections
		if (connectionList && connectionList.length > 0) {
			connectionList = connectionList.filter(conn => conn.providerName === constants.sqlProviderName && (<MssqlOptions><any>conn.options).server);
		}
		// Prompt choice if we have active connections
		if (connectionList && connectionList.length > 0) {
			let selectConnectionMsg = localize('selectOtherServer', "Select other SQL Server");
			let displayList: string[] = [];
			connectionList.forEach(conn => {
				let options: MssqlOptions = <any>conn.options;
				displayList.push(options.server);
				connectionMap.set(options.server, conn);
			});
			displayList.push(selectConnectionMsg);

			selectedHost = await vscode.window.showQuickPick(displayList, {
				placeHolder:
					localize('sparkJobSubmission.PleaseSelectSqlWithCluster',
						"Please select SQL Server with Big Data Cluster.")
			});
			if (selectedHost === selectConnectionMsg) {
				showConnectionDialog = true;
				selectedHost = undefined;
			}
		} else {
			showConnectionDialog = true;
		}

		// Show connection dialog if still don't have a server
		if (showConnectionDialog) {
			let connection = await azdata.connection.openConnectionDialog([constants.sqlProviderName]);
			if (connection) {
				let options: MssqlOptions = <any>connection.options;
				connectionMap.set(options.server, connection);
				selectedHost = options.server;
				// Wait an appropriate timeout so that the serverInfo object can populate...
				await timeout(150);
			}
		}

		let errorMsg = localize('sparkJobSubmission.NoSqlSelected', "No SQL Server is selected.");
		if (!selectedHost) { throw new Error(errorMsg); }

		let sqlConnection = connectionMap.get(selectedHost);
		if (!sqlConnection) { throw new Error(errorMsg); }

		let sqlClusterConnection = await SqlClusterLookUp.getSqlClusterConnection(sqlConnection);
		if (!sqlClusterConnection) {
			throw new Error(localize('errorNotSqlBigDataCluster', "The selected server does not belong to a SQL Server Big Data Cluster"));
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
				vscode.window.showErrorMessage(LocalizedConstants.msgMissingNodeContext);
				return;
			}
		} catch (err) {
			vscode.window.showErrorMessage(localize('sparkJobSubmission.GetFilePathFromSelectedNodeFailed', "Error Get File Path: {0}", err));
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
			vscode.window.showErrorMessage(getErrorMessage(error));
		}
	}
}

export class OpenSparkJobSubmissionDialogTask {
	constructor(private appContext: AppContext, private outputChannel: vscode.OutputChannel) {
	}

	async execute(profile: azdata.IConnectionProfile, ...args: any[]): Promise<void> {
		try {
			let sqlClusterConnection = SqlClusterLookUp.findSqlClusterConnection(profile, this.appContext);
			if (!sqlClusterConnection) {
				throw new Error(LocalizedConstants.sparkJobSubmissionNoSqlBigDataClusterFound);
			}
			let dialog = new SparkJobSubmissionDialog(sqlClusterConnection, this.appContext, this.outputChannel);
			await dialog.openDialog();
		} catch (error) {
			vscode.window.showErrorMessage(getErrorMessage(error));
		}
	}
}
