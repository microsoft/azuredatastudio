/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { ControllerTreeDataProvider } from './bigDataCluster/tree/controllerTreeDataProvider';
import { IconPathHelper } from './bigDataCluster/constants';
import { TreeNode } from './bigDataCluster/tree/treeNode';
import { AddControllerDialogModel, AddControllerDialog } from './bigDataCluster/dialog/addControllerDialog';
import { ControllerNode } from './bigDataCluster/tree/controllerTreeNode';
import { BdcDashboard } from './bigDataCluster/dialog/bdcDashboard';
import { BdcDashboardModel } from './bigDataCluster/dialog/bdcDashboardModel';
import { MountHdfsDialogModel as MountHdfsModel, MountHdfsProperties, MountHdfsDialog, DeleteMountDialog, DeleteMountModel, RefreshMountDialog, RefreshMountModel } from './bigDataCluster/dialog/mountHdfsDialog';
import { getControllerEndpoint } from './bigDataCluster/utils';

const localize = nls.loadMessageBundle();

const AddControllerCommand = 'bigDataClusters.command.addController';
const DeleteControllerCommand = 'bigDataClusters.command.deleteController';
const RefreshControllerCommand = 'bigDataClusters.command.refreshController';
const ManageControllerCommand = 'bigDataClusters.command.manageController';
const MountHdfsCommand = 'bigDataClusters.command.mount';
const RefreshMountCommand = 'bigDataClusters.command.refreshmount';
const DeleteMountCommand = 'bigDataClusters.command.deletemount';

const endpointNotFoundError = localize('mount.error.endpointNotFound', "Controller endpoint information was not found");

let throttleTimers: { [key: string]: any } = {};

export function activate(extensionContext: vscode.ExtensionContext) {
	IconPathHelper.setExtensionContext(extensionContext);
	let treeDataProvider = new ControllerTreeDataProvider(extensionContext.globalState);
	registerTreeDataProvider(treeDataProvider);
	registerCommands(extensionContext, treeDataProvider);
}

export function deactivate() {
}

function registerTreeDataProvider(treeDataProvider: ControllerTreeDataProvider): void {
	vscode.window.registerTreeDataProvider('sqlBigDataCluster', treeDataProvider);
}

function registerCommands(context: vscode.ExtensionContext, treeDataProvider: ControllerTreeDataProvider): void {
	vscode.commands.registerCommand(AddControllerCommand, (node?: TreeNode) => {
		runThrottledAction(AddControllerCommand, () => addBdcController(treeDataProvider, node));
	});

	vscode.commands.registerCommand(DeleteControllerCommand, (node: TreeNode) => {
		deleteBdcController(treeDataProvider, node);
	});

	vscode.commands.registerCommand(RefreshControllerCommand, (node: TreeNode) => {
		if (!node) {
			return;
		}
		treeDataProvider.notifyNodeChanged(node);
	});

	vscode.commands.registerCommand(ManageControllerCommand, async (node: ControllerNode) => {
		const title: string = `${localize('bdc.dashboard.title', "Big Data Cluster Dashboard -")} ${ControllerNode.toIpAndPort(node.url)}`;
		const dashboard: BdcDashboard = new BdcDashboard(title, new BdcDashboardModel(node.url, node.auth, node.username, node.password));
		dashboard.showDashboard();
	});

	vscode.commands.registerCommand(MountHdfsCommand, e => mountHdfs(e).catch(error => {
		vscode.window.showErrorMessage(error instanceof Error ? error.message : error);
	}));
	vscode.commands.registerCommand(RefreshMountCommand, e => refreshMount(e).catch(error => {
		vscode.window.showErrorMessage(error instanceof Error ? error.message : error);
	}));
	vscode.commands.registerCommand(DeleteMountCommand, e => deleteMount(e).catch(error => {
		vscode.window.showErrorMessage(error instanceof Error ? error.message : error);
	}));
}

async function mountHdfs(explorerContext?: azdata.ObjectExplorerContext): Promise<void> {
	let mountProps = await getMountProps(explorerContext);
	if (mountProps) {
		let dialog = new MountHdfsDialog(new MountHdfsModel(mountProps));
		dialog.showDialog();
	}
}

async function refreshMount(explorerContext?: azdata.ObjectExplorerContext): Promise<void> {
	let mountProps = await getMountProps(explorerContext);
	if (mountProps) {
		let dialog = new RefreshMountDialog(new RefreshMountModel(mountProps));
		dialog.showDialog();
	}
}

async function deleteMount(explorerContext?: azdata.ObjectExplorerContext): Promise<void> {
	let mountProps = await getMountProps(explorerContext);
	if (mountProps) {
		let dialog = new DeleteMountDialog(new DeleteMountModel(mountProps));
		dialog.showDialog();
	}
}

async function getMountProps(explorerContext?: azdata.ObjectExplorerContext): Promise<MountHdfsProperties | undefined> {
	let endpoint = await lookupController(explorerContext);
	if (!endpoint) {
		vscode.window.showErrorMessage(endpointNotFoundError);
		return undefined;
	}
	let profile = explorerContext.connectionProfile;
	let mountProps: MountHdfsProperties = {
		url: endpoint,
		auth: profile.authenticationType === 'SqlLogin' ? 'basic' : 'integrated',
		username: profile.userName,
		password: profile.password,
		hdfsPath: getHdsfPath(explorerContext.nodeInfo.nodePath)
	};
	return mountProps;
}

function getHdsfPath(nodePath: string): string {
	const hdfsNodeLabel = '/HDFS';
	let index = nodePath.indexOf(hdfsNodeLabel);
	if (index >= 0) {
		let subPath = nodePath.substring(index + hdfsNodeLabel.length);
		return subPath.length > 0 ? subPath : '/';
	}
	// Use the root
	return '/';
}

async function lookupController(explorerContext?: azdata.ObjectExplorerContext): Promise<string | undefined> {
	if (!explorerContext) {
		return undefined;
	}

	let serverInfo = await azdata.connection.getServerInfo(explorerContext.connectionProfile.id);
	if (!serverInfo || !serverInfo.options) {
		vscode.window.showErrorMessage(endpointNotFoundError);
		return undefined;
	}
	return getControllerEndpoint(serverInfo);
}

function addBdcController(treeDataProvider: ControllerTreeDataProvider, node?: TreeNode): void {
	let model = new AddControllerDialogModel(treeDataProvider, node);
	let dialog = new AddControllerDialog(model);
	dialog.showDialog();
}

async function deleteBdcController(treeDataProvider: ControllerTreeDataProvider, node: TreeNode): Promise<boolean> {
	if (!node && !(node instanceof ControllerNode)) {
		return;
	}

	let controllerNode = node as ControllerNode;

	let choices: { [id: string]: boolean } = {};
	choices[localize('textYes', 'Yes')] = true;
	choices[localize('textNo', 'No')] = false;

	let options = {
		ignoreFocusOut: false,
		placeHolder: localize('textConfirmDeleteController', 'Are you sure you want to delete \'{0}\'?', controllerNode.label)
	};

	let result = await vscode.window.showQuickPick(Object.keys(choices), options);
	let remove: boolean = !!(result && choices[result]);
	if (remove) {
		deleteControllerInternal(treeDataProvider, controllerNode);
	}
	return remove;
}

function deleteControllerInternal(treeDataProvider: ControllerTreeDataProvider, controllerNode: ControllerNode): void {
	let deleted = treeDataProvider.deleteController(controllerNode.url, controllerNode.auth, controllerNode.username);
	if (deleted) {
		treeDataProvider.saveControllers();
	}
}

/**
 * Throttles actions to avoid bug where on clicking in tree, action gets called twice
 * instead of once. Any right-click action is safe, just the default on-click action in a tree
 */
function runThrottledAction(id: string, action: () => void) {
	let timer = throttleTimers[id];
	if (!timer) {
		throttleTimers[id] = timer = setTimeout(() => {
			action();
			clearTimeout(timer);
			throttleTimers[id] = undefined;
		}, 150);
	}
	// else ignore this as we got an identical action in the last 150ms
}
