/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { ControllerTreeDataProvider } from './bigDataCluster/tree/controllerTreeDataProvider';
import { IconPath } from './bigDataCluster/constants';
import { TreeNode } from './bigDataCluster/tree/treeNode';
import { AddControllerDialogModel, AddControllerDialog } from './bigDataCluster/dialog/addControllerDialog';
import { ControllerNode } from './bigDataCluster/tree/controllerTreeNode';

const localize = nls.loadMessageBundle();

export function activate(extensionContext: vscode.ExtensionContext) {
	IconPath.setExtensionContext(extensionContext);
	let treeDataProvider = new ControllerTreeDataProvider();

	registerTreeDataProvider(treeDataProvider);
	registerCommands(treeDataProvider);
}

export function deactivate() {
}

function registerTreeDataProvider(treeDataProvider: ControllerTreeDataProvider): void {
	vscode.window.registerTreeDataProvider('sqlBigDataCluster', treeDataProvider);
}

function registerCommands(treeDataProvider: ControllerTreeDataProvider): void {
	vscode.commands.registerCommand('bigDataClusters.command.addController', (node?: TreeNode) => {
		addBdcControllerCommand(treeDataProvider, node);
	});

	vscode.commands.registerCommand('bigDataClusters.command.deleteController', (node: TreeNode) => {
		deleteBdcControllerCommand(treeDataProvider, node);
	});

	vscode.commands.registerCommand('bigDataClusters.command.refreshController', (node: TreeNode) => {
		if (!node) {
			return;
		}
		treeDataProvider.notifyNodeChanged(node);
	});
}

function addBdcControllerCommand(treeDataProvider: ControllerTreeDataProvider, node?: TreeNode): void {
	let model = new AddControllerDialogModel(treeDataProvider, node);
	let dialog = new AddControllerDialog(model);
	dialog.showDialog();
}

function deleteBdcControllerCommand(treeDataProvider: ControllerTreeDataProvider, node: TreeNode): void {
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

	vscode.window.showQuickPick(Object.keys(choices), options).then(result => {
		let remove: boolean = !!(result && choices[result]);
		if (remove) {
			deleteControllerInternal(treeDataProvider, controllerNode);
		}
		return remove;
	});
}

function deleteControllerInternal(treeDataProvider: ControllerTreeDataProvider, controllerNode: ControllerNode): void {
	let deleted = treeDataProvider.deleteController(controllerNode.url, controllerNode.username);
	if (deleted) {
		treeDataProvider.saveControllers();
	}
}
