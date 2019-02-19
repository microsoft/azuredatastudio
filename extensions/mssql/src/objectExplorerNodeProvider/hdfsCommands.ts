/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import * as fs from 'fs';
import * as fspath from 'path';
import * as clipboardy from 'clipboardy';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ApiWrapper } from '../apiWrapper';
import { Command, ICommandViewContext, ProgressCommand, ICommandObjectExplorerContext } from './command';
import { IHdfsOptions, HdfsFileSource, File, IFile, joinHdfsPath, FileSourceFactory } from './fileSources';
import { HdfsProvider, FolderNode, FileNode, HdfsFileSourceNode } from './hdfsProvider';
import { IPrompter, IQuestion, QuestionTypes } from '../prompts/question';
import * as constants from '../constants';
import * as LocalizedConstants from '../localizedConstants';
import * as utils from '../utils';
import { SqlClusterConnection } from './connection';
import { AppContext } from '../appContext';
import { TreeNode } from './treeNodes';
import { MssqlObjectExplorerNodeProvider } from './objectExplorerNodeProvider';

function getSaveableUri(apiWrapper: ApiWrapper, fileName: string, isPreview?: boolean): vscode.Uri {
	let root = utils.getUserHome();
	let workspaceFolders = apiWrapper.workspaceFolders;
	if (workspaceFolders && workspaceFolders.length > 0) {
		root = workspaceFolders[0].uri.fsPath;
	}
	// Cannot preview with a file path that already exists, so keep looking for a valid path that does not exist
	if (isPreview) {
		let fileNum = 1;
		let fileNameWithoutExtension = fspath.parse(fileName).name;
		let fileExtension = fspath.parse(fileName).ext;
		while (fs.existsSync(fspath.join(root, fileName))) {
			fileName = `${fileNameWithoutExtension}-${fileNum}${fileExtension}`;
			fileNum++;
		}
	}
	return vscode.Uri.file(fspath.join(root, fileName));
}

export async function getNode<T extends TreeNode>(context: ICommandViewContext | ICommandObjectExplorerContext, appContext: AppContext): Promise<T> {
	let node: T = undefined;
	if (context && context.type === constants.ViewType && context.node) {
		node = context.node as T;
	} else if (context && context.type === constants.ObjectExplorerService) {
		let oeNodeProvider = appContext.getService<MssqlObjectExplorerNodeProvider>(constants.ObjectExplorerService);
		if (oeNodeProvider) {
			node = await oeNodeProvider.findSqlClusterNodeByContext<T>(context);
		}
	} else {
		throw new Error(LocalizedConstants.msgMissingNodeContext);
	}
	return node;
}

export class UploadFilesCommand extends ProgressCommand {

	constructor(prompter: IPrompter, appContext: AppContext) {
		super('mssqlCluster.uploadFiles', prompter, appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let folderNode = await getNode<FolderNode>(context, this.appContext);
			const allFilesFilter = localize('allFiles', 'All Files');
			let filter = {};
			filter[allFilesFilter] = '*';
			if (folderNode) {
				let options: vscode.OpenDialogOptions = {
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: true,
					openLabel: localize('lblUploadFiles', 'Upload'),
					filters: filter
				};
				let fileUris: vscode.Uri[] = await this.apiWrapper.showOpenDialog(options);
				if (fileUris) {
					let files: IFile[] = fileUris.map(uri => uri.fsPath).map(this.mapPathsToFiles());
					await this.executeWithProgress(
						async (cancelToken: vscode.CancellationTokenSource) => this.writeFiles(files, folderNode, cancelToken),
						localize('uploading', 'Uploading files to HDFS'), true,
						() => this.apiWrapper.showInformationMessage(localize('uploadCanceled', 'Upload operation was canceled')));
					if (context.type === constants.ObjectExplorerService) {
						let objectExplorerNode = await sqlops.objectexplorer.getNode(context.explorerContext.connectionProfile.id, folderNode.getNodeInfo().nodePath);
						await objectExplorerNode.refresh();
					}
				}
			}
		} catch (err) {
			this.apiWrapper.showErrorMessage(localize('uploadError', 'Error uploading files: {0}', utils.getErrorMessage(err)));
		}
	}

	private mapPathsToFiles(): (value: string, index: number, array: string[]) => File {
		return (path: string) => {
			let isDir = fs.lstatSync(path).isDirectory();
			return new File(path, isDir);
		};
	}

	private async writeFiles(files: IFile[], folderNode: FolderNode, cancelToken: vscode.CancellationTokenSource): Promise<void> {
		for (let file of files) {
			if (cancelToken.token.isCancellationRequested) {
				// Throw here so that all recursion is ended
				throw new Error('Upload canceled');
			}
			if (file.isDirectory) {
				let dirName = fspath.basename(file.path);
				let subFolder = await folderNode.mkdir(dirName);
				let children: IFile[] = fs.readdirSync(file.path)
					.map(childFileName => joinHdfsPath(file.path, childFileName))
					.map(this.mapPathsToFiles());
				this.writeFiles(children, subFolder, cancelToken);
			} else {
				await folderNode.writeFile(file);
			}
		}
	}
}
export class MkDirCommand extends ProgressCommand {

	constructor(prompter: IPrompter, appContext: AppContext) {
		super('mssqlCluster.mkdir', prompter, appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let folderNode = await getNode<FolderNode>(context, this.appContext);

			if (folderNode) {
				let fileName: string = await this.getDirName();
				if (fileName && fileName.length > 0) {
					await this.executeWithProgress(
						async (cancelToken: vscode.CancellationTokenSource) => this.mkDir(fileName, folderNode, cancelToken),
						localize('makingDir', 'Creating directory'), true,
						() => this.apiWrapper.showInformationMessage(localize('mkdirCanceled', 'Operation was canceled')));
					if (context.type === constants.ObjectExplorerService) {
						let objectExplorerNode = await sqlops.objectexplorer.getNode(context.explorerContext.connectionProfile.id, folderNode.getNodeInfo().nodePath);
						await objectExplorerNode.refresh();
					}
				}
			}
		} catch (err) {
			this.apiWrapper.showErrorMessage(localize('uploadError', 'Error uploading files: {0}', utils.getErrorMessage(err)));
		}
	}

	private async getDirName(): Promise<string> {
		return await this.prompter.promptSingle(<IQuestion>{
			type: QuestionTypes.input,
			name: 'enterDirName',
			message: localize('enterDirName', 'Enter directory name'),
			default: ''
		}).then(confirmed => <string>confirmed);
	}

	private async mkDir(fileName, folderNode: FolderNode, cancelToken: vscode.CancellationTokenSource): Promise<void> {
		let subFolder = await folderNode.mkdir(fileName);
	}
}

export class DeleteFilesCommand extends Command {

	constructor(private prompter: IPrompter, appContext: AppContext) {
		super('mssqlCluster.deleteFiles', appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let node = await getNode<TreeNode>(context, this.appContext);
			if (node) {
				// TODO ideally would let node define if it's deletable
				// TODO also, would like to change this to getNodeInfo as OE is the primary use case now
				let treeItem = await node.getTreeItem();
				let oeNodeToRefresh: sqlops.objectexplorer.ObjectExplorerNode = undefined;
				if (context.type === constants.ObjectExplorerService) {
					let oeNodeToDelete = await sqlops.objectexplorer.getNode(context.explorerContext.connectionProfile.id, node.getNodeInfo().nodePath);
					oeNodeToRefresh = await oeNodeToDelete.getParent();
				}
				switch (treeItem.contextValue) {
					case constants.MssqlClusterItems.Folder:
						await this.deleteFolder(<FolderNode>node);
						break;
					case constants.MssqlClusterItems.File:
						await this.deleteFile(<FileNode>node);
						break;
					default:
						return;
				}
				if (oeNodeToRefresh) {
					await oeNodeToRefresh.refresh();
				}
			} else {
				this.apiWrapper.showErrorMessage(LocalizedConstants.msgMissingNodeContext);
			}
		} catch (err) {
			this.apiWrapper.showErrorMessage(localize('deleteError', 'Error deleting files {0}', utils.getErrorMessage(err)));
		}
	}

	private async confirmDelete(deleteMsg: string): Promise<boolean> {
		return await this.prompter.promptSingle(<IQuestion>{
			type: QuestionTypes.confirm,
			message: deleteMsg,
			default: false
		}).then(confirmed => <boolean>confirmed);
	}

	private async deleteFolder(node: FolderNode): Promise<void> {
		if (node) {
			let confirmed = await this.confirmDelete(localize('msgDeleteFolder', 'Are you sure you want to delete this folder and its contents?'));
			if (confirmed) {
				// TODO prompt for recursive delete if non-empty?
				await node.delete(true);
			}
		}
	}

	private async deleteFile(node: FileNode): Promise<void> {
		if (node) {
			let confirmed = await this.confirmDelete(localize('msgDeleteFile', 'Are you sure you want to delete this file?'));
			if (confirmed) {
				await node.delete();
			}
		}
	}
}

export class SaveFileCommand extends ProgressCommand {

	constructor(prompter: IPrompter, appContext: AppContext) {
		super('mssqlCluster.saveFile', prompter, appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let fileNode = await getNode<FileNode>(context, this.appContext);
			if (fileNode) {
				let defaultUri = getSaveableUri(this.apiWrapper, fspath.basename(fileNode.hdfsPath));
				let fileUri: vscode.Uri = await this.apiWrapper.showSaveDialog({
					defaultUri: defaultUri
				});
				if (fileUri) {
					await this.executeWithProgress(
						async (cancelToken: vscode.CancellationTokenSource) => this.doSaveAndOpen(fileUri, fileNode, cancelToken),
						localize('saving', 'Saving HDFS Files'), true,
						() => this.apiWrapper.showInformationMessage(localize('saveCanceled', 'Save operation was canceled')));
				}
			} else {
				this.apiWrapper.showErrorMessage(LocalizedConstants.msgMissingNodeContext);
			}
		} catch (err) {
			this.apiWrapper.showErrorMessage(localize('saveError', 'Error saving file: {0}', utils.getErrorMessage(err)));
		}
	}

	private async doSaveAndOpen(fileUri: vscode.Uri, fileNode: FileNode, cancelToken: vscode.CancellationTokenSource): Promise<void> {
		await fileNode.writeFileContentsToDisk(fileUri.fsPath, cancelToken);
		await this.apiWrapper.executeCommand('vscode.open', fileUri);
	}
}

export class PreviewFileCommand extends ProgressCommand {
	public static readonly DefaultMaxSize = 30 * 1024 * 1024;

	constructor(prompter: IPrompter, appContext: AppContext) {
		super('mssqlCluster.previewFile', prompter, appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let fileNode = await getNode<FileNode>(context, this.appContext);
			if (fileNode) {
				await this.executeWithProgress(
					async (cancelToken: vscode.CancellationTokenSource) => {
						let contents = await fileNode.getFileContentsAsString(PreviewFileCommand.DefaultMaxSize);
						let doc = await this.openTextDocument(fspath.basename(fileNode.hdfsPath));
						let editor = await this.apiWrapper.showTextDocument(doc, vscode.ViewColumn.Active, false);
						await editor.edit(edit => {
							edit.insert(new vscode.Position(0, 0), contents);
						});
					},
					localize('previewing', 'Generating preview'),
					false);
			} else {
				this.apiWrapper.showErrorMessage(LocalizedConstants.msgMissingNodeContext);
			}
		} catch (err) {
			this.apiWrapper.showErrorMessage(localize('previewError', 'Error previewing file: {0}', utils.getErrorMessage(err)));
		}
	}

	private async openTextDocument(fileName: string): Promise<vscode.TextDocument> {
		let docUri: vscode.Uri = getSaveableUri(this.apiWrapper, fileName, true);
		if (docUri) {
			docUri = docUri.with({ scheme: constants.UNTITLED_SCHEMA });
			return await this.apiWrapper.openTextDocument(docUri);
		} else {
			// Can't reliably create a filename to save as so just use untitled
			let language = fspath.extname(fileName);
			if (language && language.length > 0) {
				// trim the '.'
				language = language.substring(1);
			}
			return await this.apiWrapper.openTextDocument({
				language: language
			});
		}
	}
}

export class CopyPathCommand extends Command {
	public static readonly DefaultMaxSize = 30 * 1024 * 1024;

	constructor(appContext: AppContext) {
		super('mssqlCluster.copyPath', appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let node = await getNode<HdfsFileSourceNode>(context, this.appContext);
			if (node) {
				let path = node.hdfsPath;
				clipboardy.writeSync(path);
			} else {
				this.apiWrapper.showErrorMessage(LocalizedConstants.msgMissingNodeContext);
			}
		} catch (err) {
			this.apiWrapper.showErrorMessage(localize('copyPathError', 'Error copying path: {0}', utils.getErrorMessage(err)));
		}
	}
}
