/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
import * as os from 'os';

import * as Constants from './constants';
import ContextProvider from './contextProvider';
import * as Utils from './utils';
import { AppContext } from './appContext';
import { UploadFilesCommand, MkDirCommand, SaveFileCommand, PreviewFileCommand, CopyPathCommand, DeleteFilesCommand, ManageAccessCommand } from './objectExplorerNodeProvider/hdfsCommands';
import { IPrompter } from './prompts/question';
import CodeAdapter from './prompts/adapter';
import { IExtension } from './mssql';
import { OpenSparkJobSubmissionDialogCommand, OpenSparkJobSubmissionDialogFromFileCommand, OpenSparkJobSubmissionDialogTask } from './sparkFeature/dialog/dialogCommands';
import { OpenSparkYarnHistoryTask } from './sparkFeature/historyTask';
import { MssqlObjectExplorerNodeProvider, mssqlOutputChannel } from './objectExplorerNodeProvider/objectExplorerNodeProvider';
import { registerSearchServerCommand } from './objectExplorerNodeProvider/command';
import { MssqlIconProvider } from './iconProvider';
import { registerServiceEndpoints, Endpoint } from './dashboard/serviceEndpoints';
import { getBookExtensionContributions } from './dashboard/bookExtensions';
import { registerBooksWidget } from './dashboard/bookWidget';
import { createMssqlApi } from './mssqlApiFactory';
import { AuthType } from './util/auth';
import { SqlToolsServer } from './sqlToolsServer';
import { promises as fs } from 'fs';
import { IconPathHelper } from './iconHelper';
import * as nls from 'vscode-nls';
import { INotebookConvertService } from './notebookConvert/notebookConvertService';

const localize = nls.loadMessageBundle();
const msgSampleCodeDataFrame = localize('msgSampleCodeDataFrame', "This sample code loads the file into a data frame and shows the first 10 results.");

export async function activate(context: vscode.ExtensionContext): Promise<IExtension> {
	// lets make sure we support this platform first
	let supported = await Utils.verifyPlatform();

	if (!supported) {
		vscode.window.showErrorMessage('Unsupported platform');
		return undefined;
	}

	// ensure our log path exists
	if (!(await Utils.exists(context.logPath))) {
		await fs.mkdir(context.logPath);
	}

	IconPathHelper.setExtensionContext(context);

	let prompter: IPrompter = new CodeAdapter();
	let appContext = new AppContext(context);

	let nodeProvider = new MssqlObjectExplorerNodeProvider(prompter, appContext);
	azdata.dataprotocol.registerObjectExplorerNodeProvider(nodeProvider);
	let iconProvider = new MssqlIconProvider();
	azdata.dataprotocol.registerIconProvider(iconProvider);

	activateSparkFeatures(appContext);
	activateNotebookTask(appContext);

	registerSearchServerCommand(appContext);
	context.subscriptions.push(new ContextProvider());
	registerHdfsCommands(context, prompter, appContext);

	registerLogCommand(context);

	registerServiceEndpoints(context);
	// Get book contributions - in the future this will be integrated with the Books/Notebook widget to show as a dashboard widget
	const bookContributionProvider = getBookExtensionContributions(context);
	context.subscriptions.push(bookContributionProvider);

	registerBooksWidget(bookContributionProvider);

	// initialize client last so we don't have features stuck behind it
	const server = new SqlToolsServer();
	context.subscriptions.push(server);
	await server.start(appContext);

	vscode.commands.registerCommand('mssql.exportSqlAsNotebook', async (uri: vscode.Uri) => {
		const result = await appContext.getService<INotebookConvertService>(Constants.NotebookConvertService).convertSqlToNotebook(uri.toString());
		const title = findNextUntitledEditorName();
		const untitledUri = vscode.Uri.parse(`untitled:${title}`);
		await azdata.nb.showNotebookDocument(untitledUri, { initialContent: result.content });
	});

	vscode.commands.registerCommand('mssql.exportNotebookToSql', async (uri: vscode.Uri) => {
		// SqlToolsService doesn't currently store anything about Notebook documents so we have to pass the raw JSON to it directly
		// We use vscode.workspace.textDocuments here because the azdata.nb.notebookDocuments don't actually contain their contents
		// (they're left out for perf purposes)
		const doc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
		const result = await appContext.getService<INotebookConvertService>(Constants.NotebookConvertService).convertNotebookToSql(doc.getText());

		const sqlDoc = await vscode.workspace.openTextDocument({ language: 'sql', content: result.content });
		await vscode.commands.executeCommand('vscode.open', sqlDoc.uri);
	});

	return createMssqlApi(appContext);
}

const logFiles = ['resourceprovider.log', 'sqltools.log', 'credentialstore.log'];
function registerLogCommand(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('mssql.showLogFile', async () => {
		const choice = await vscode.window.showQuickPick(logFiles);
		if (choice) {
			const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(context.logPath, choice)));
			if (document) {
				vscode.window.showTextDocument(document);
			}
		}
	}));
}

function registerHdfsCommands(context: vscode.ExtensionContext, prompter: IPrompter, appContext: AppContext) {
	context.subscriptions.push(new UploadFilesCommand(prompter, appContext));
	context.subscriptions.push(new MkDirCommand(prompter, appContext));
	context.subscriptions.push(new SaveFileCommand(prompter, appContext));
	context.subscriptions.push(new PreviewFileCommand(prompter, appContext));
	context.subscriptions.push(new CopyPathCommand(appContext));
	context.subscriptions.push(new DeleteFilesCommand(prompter, appContext));
	context.subscriptions.push(new ManageAccessCommand(appContext));
}

function activateSparkFeatures(appContext: AppContext): void {
	let extensionContext = appContext.extensionContext;
	let outputChannel: vscode.OutputChannel = mssqlOutputChannel;
	extensionContext.subscriptions.push(new OpenSparkJobSubmissionDialogCommand(appContext, outputChannel));
	extensionContext.subscriptions.push(new OpenSparkJobSubmissionDialogFromFileCommand(appContext, outputChannel));
	azdata.tasks.registerTask(Constants.mssqlClusterLivySubmitSparkJobTask, async (profile: azdata.IConnectionProfile) => {
		await new OpenSparkJobSubmissionDialogTask(appContext, outputChannel).execute(profile);
	});
	azdata.tasks.registerTask(Constants.mssqlClusterLivyOpenSparkHistory, async (profile: azdata.IConnectionProfile) => {
		await new OpenSparkYarnHistoryTask(appContext).execute(profile, true);
	});
	azdata.tasks.registerTask(Constants.mssqlClusterLivyOpenYarnHistory, async (profile: azdata.IConnectionProfile) => {
		await new OpenSparkYarnHistoryTask(appContext).execute(profile, false);
	});
}

function activateNotebookTask(appContext: AppContext): void {
	azdata.tasks.registerTask(Constants.mssqlClusterNewNotebookTask, (profile: azdata.IConnectionProfile) => {
		return saveProfileAndCreateNotebook(profile);
	});
	azdata.tasks.registerTask(Constants.mssqlClusterOpenNotebookTask, (profile: azdata.IConnectionProfile) => {
		return handleOpenNotebookTask(profile);
	});
	azdata.tasks.registerTask(Constants.mssqlOpenClusterDashboard, (profile: azdata.IConnectionProfile) => {
		return handleOpenClusterDashboardTask(profile, appContext);
	});
}

function saveProfileAndCreateNotebook(profile: azdata.IConnectionProfile): Promise<void> {
	return handleNewNotebookTask(undefined, profile);
}

function findNextUntitledEditorName(): string {
	let nextVal = 0;
	// Note: this will go forever if it's coded wrong, or you have inifinite Untitled notebooks!
	while (true) {
		let title = `Notebook-${nextVal}`;
		let hasNotebookDoc = azdata.nb.notebookDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1;
		if (!hasNotebookDoc) {
			return title;
		}
		nextVal++;
	}
}

async function handleNewNotebookTask(oeContext?: azdata.ObjectExplorerContext, profile?: azdata.IConnectionProfile): Promise<void> {
	// Ensure we get a unique ID for the notebook. For now we're using a different prefix to the built-in untitled files
	// to handle this. We should look into improving this in the future
	let title = findNextUntitledEditorName();
	let untitledUri = vscode.Uri.parse(`untitled:${title}`);
	let editor = await azdata.nb.showNotebookDocument(untitledUri, {
		connectionProfile: profile,
		preview: false
	});
	if (oeContext && oeContext.nodeInfo && oeContext.nodeInfo.nodePath) {
		// Get the file path after '/HDFS'
		let hdfsPath: string = oeContext.nodeInfo.nodePath.substring(oeContext.nodeInfo.nodePath.indexOf('/HDFS') + '/HDFS'.length);
		if (hdfsPath.length > 0) {
			let analyzeCommand = '#' + msgSampleCodeDataFrame + os.EOL + 'df = (spark.read.option("inferSchema", "true")'
				+ os.EOL + '.option("header", "true")' + os.EOL + '.csv("{0}"))' + os.EOL + 'df.show(10)';
			editor.edit(editBuilder => {
				editBuilder.replace(0, {
					cell_type: 'code',
					source: analyzeCommand.replace('{0}', hdfsPath)
				});
			});

		}
	}
}

async function handleOpenNotebookTask(profile: azdata.IConnectionProfile): Promise<void> {
	let notebookFileTypeName = localize('notebookFileType', "Notebooks");
	let filter: { [key: string]: string[] } = {};
	filter[notebookFileTypeName] = ['ipynb'];
	let uris = await vscode.window.showOpenDialog({
		filters: filter,
		canSelectFiles: true,
		canSelectMany: false
	});
	if (uris && uris.length > 0) {
		let fileUri = uris[0];
		// Verify this is a .ipynb file since this isn't actually filtered on Mac/Linux
		if (path.extname(fileUri.fsPath) !== '.ipynb') {
			// in the future might want additional supported types
			vscode.window.showErrorMessage(localize('unsupportedFileType', "Only .ipynb Notebooks are supported"));
		} else {
			await azdata.nb.showNotebookDocument(fileUri, {
				connectionProfile: profile,
				preview: false
			});
		}
	}
}

async function handleOpenClusterDashboardTask(profile: azdata.IConnectionProfile, appContext: AppContext): Promise<void> {
	const serverInfo = await azdata.connection.getServerInfo(profile.id);
	const controller = Utils.getClusterEndpoints(serverInfo).find(e => e.serviceName === Endpoint.controller);
	if (!controller) {
		vscode.window.showErrorMessage(localize('noController', "Could not find the controller endpoint for this instance"));
		return;
	}

	vscode.commands.executeCommand('bigDataClusters.command.manageController',
		{
			url: controller.endpoint,
			auth: profile.authenticationType === 'Integrated' ? AuthType.Integrated : AuthType.Basic,
			username: 'admin', // Default to admin as a best-guess, we'll prompt for re-entering credentials if that fails
			password: profile.password,
			rememberPassword: true
		}, /*addOrUpdateController*/true);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
}
