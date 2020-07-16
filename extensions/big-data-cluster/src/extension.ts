/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { ControllerTreeDataProvider } from './bigDataCluster/tree/controllerTreeDataProvider';
import { IconPathHelper } from './bigDataCluster/constants';
import { TreeNode } from './bigDataCluster/tree/treeNode';
import { AddControllerDialogModel, AddControllerDialog } from './bigDataCluster/dialog/addControllerDialog';
import { ControllerNode } from './bigDataCluster/tree/controllerTreeNode';
import { BdcDashboard } from './bigDataCluster/dialog/bdcDashboard';
import { BdcDashboardModel, BdcDashboardOptions } from './bigDataCluster/dialog/bdcDashboardModel';
import { MountHdfsDialogModel as MountHdfsModel, MountHdfsProperties, MountHdfsDialog, DeleteMountDialog, DeleteMountModel, RefreshMountDialog, RefreshMountModel } from './bigDataCluster/dialog/mountHdfsDialog';
import { getControllerEndpoint } from './bigDataCluster/utils';
import * as commands from './commands';
import { HdfsDialogCancelledError } from './bigDataCluster/dialog/hdfsDialogBase';
import { IExtension, AuthType, IClusterController } from 'bdc';
import { ClusterController } from './bigDataCluster/controller/clusterControllerApi';

const localize = nls.loadMessageBundle();

const endpointNotFoundError = localize('mount.error.endpointNotFound', "Controller endpoint information was not found");

let throttleTimers: { [key: string]: any } = {};

export async function activate(extensionContext: vscode.ExtensionContext): Promise<IExtension> {
	IconPathHelper.setExtensionContext(extensionContext);
	await vscode.commands.executeCommand('setContext', 'bdc.loaded', false);
	const treeDataProvider = new ControllerTreeDataProvider(extensionContext.globalState);
	vscode.window.registerTreeDataProvider('sqlBigDataCluster', treeDataProvider);
	registerCommands(extensionContext, treeDataProvider);
	return {
		getClusterController(url: string, authType: AuthType, username?: string, password?: string): IClusterController {
			return new ClusterController(url, authType, username, password);
		}
	};
}

export function deactivate() {
}

function registerCommands(context: vscode.ExtensionContext, treeDataProvider: ControllerTreeDataProvider): void {
	vscode.commands.registerCommand(commands.ConnectControllerCommand, (node?: TreeNode) => {
		runThrottledAction(commands.ConnectControllerCommand, () => addBdcController(treeDataProvider, node));
	});

	vscode.commands.registerCommand(commands.CreateControllerCommand, () => {
		runThrottledAction(commands.CreateControllerCommand, () => vscode.commands.executeCommand('azdata.resource.deploy', 'sql-bdc', ['sql-bdc']));
	});

	vscode.commands.registerCommand(commands.RemoveControllerCommand, async (node: TreeNode) => {
		await deleteBdcController(treeDataProvider, node);
	});

	vscode.commands.registerCommand(commands.RefreshControllerCommand, (node: TreeNode) => {
		if (!node) {
			return;
		}
		treeDataProvider.notifyNodeChanged(node);
	});

	vscode.commands.registerCommand(commands.ManageControllerCommand, async (info: ControllerNode | BdcDashboardOptions, addOrUpdateController: boolean = false) => {
		const title: string = `${localize('bdc.dashboard.title', "Big Data Cluster Dashboard -")} ${ControllerNode.toIpAndPort(info.url)}`;
		if (addOrUpdateController) {
			// The info may be wrong, but if it is then we'll prompt to reconnect when the dashboard is opened
			// and update with the correct info then
			treeDataProvider.addOrUpdateController(
				info.url,
				info.auth,
				info.username,
				info.password,
				info.rememberPassword);
			await treeDataProvider.saveControllers();
		}
		const dashboard: BdcDashboard = new BdcDashboard(title, new BdcDashboardModel(info, treeDataProvider));
		await dashboard.showDashboard();
	});

	vscode.commands.registerCommand(commands.MountHdfsCommand, e => mountHdfs(e).catch(error => {
		vscode.window.showErrorMessage(error instanceof Error ? error.message : error);
	}));
	vscode.commands.registerCommand(commands.RefreshMountCommand, e => refreshMount(e).catch(error => {
		vscode.window.showErrorMessage(error instanceof Error ? error.message : error);
	}));
	vscode.commands.registerCommand(commands.DeleteMountCommand, e => deleteMount(e).catch(error => {
		vscode.window.showErrorMessage(error instanceof Error ? error.message : error);
	}));
}

async function mountHdfs(explorerContext?: azdata.ObjectExplorerContext): Promise<void> {
	const mountProps = await getMountProps(explorerContext);
	if (mountProps) {
		const dialog = new MountHdfsDialog(new MountHdfsModel(mountProps));
		try {
			await dialog.showDialog();
		} catch (error) {
			if (!(error instanceof HdfsDialogCancelledError)) {
				throw error;
			}
		}

	}
}

async function refreshMount(explorerContext?: azdata.ObjectExplorerContext): Promise<void> {
	const mountProps = await getMountProps(explorerContext);
	if (mountProps) {
		const dialog = new RefreshMountDialog(new RefreshMountModel(mountProps));
		await dialog.showDialog();
	}
}

async function deleteMount(explorerContext?: azdata.ObjectExplorerContext): Promise<void> {
	const mountProps = await getMountProps(explorerContext);
	if (mountProps) {
		const dialog = new DeleteMountDialog(new DeleteMountModel(mountProps));
		await dialog.showDialog();
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
	let model = new AddControllerDialogModel(treeDataProvider, node as ControllerNode);
	let dialog = new AddControllerDialog(model);
	dialog.showDialog();
}

async function deleteBdcController(treeDataProvider: ControllerTreeDataProvider, node: TreeNode): Promise<boolean | undefined> {
	if (!node && !(node instanceof ControllerNode)) {
		return undefined;
	}

	let controllerNode = node as ControllerNode;

	let choices: { [id: string]: boolean } = {};
	choices[localize('textYes', "Yes")] = true;
	choices[localize('textNo', "No")] = false;

	let options = {
		ignoreFocusOut: false,
		placeHolder: localize('textConfirmRemoveController', "Are you sure you want to remove \'{0}\'?", controllerNode.label)
	};

	let result = await vscode.window.showQuickPick(Object.keys(choices), options);
	let remove: boolean = !!(result && choices[result]);
	if (remove) {
		await removeControllerInternal(treeDataProvider, controllerNode);
	}
	return remove;
}

async function removeControllerInternal(treeDataProvider: ControllerTreeDataProvider, controllerNode: ControllerNode): Promise<void> {
	const removed = treeDataProvider.removeController(controllerNode.url, controllerNode.auth, controllerNode.username);
	if (removed) {
		await treeDataProvider.saveControllers();
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
