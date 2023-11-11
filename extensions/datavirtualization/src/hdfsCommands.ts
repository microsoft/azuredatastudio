/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { ICommandViewContext, ICommandObjectExplorerContext } from './command';
import * as constants from './constants';
import * as LocalizedConstants from './localizedConstants';
import { AppContext } from './appContext';
import { TreeNode } from './treeNodes';
import { MssqlExtensionApi } from './typings/mssqlapis';


export async function getNodeFromMssqlProvider<T extends TreeNode>(context: ICommandViewContext | ICommandObjectExplorerContext, appContext: AppContext): Promise<T> {
	let node: T = undefined;
	if (context && context.type === constants.ViewType && context.node) {
		node = context.node as T;
	} else if (context && context.type === constants.ObjectExplorerService) {
		let extensionApi: MssqlExtensionApi = vscode.extensions.getExtension('Microsoft.mssql').exports;
		let mssqlObjectExplorerBrowser = extensionApi.getMssqlObjectExplorerBrowser();
		node = <T><any>await mssqlObjectExplorerBrowser.getNode(context.explorerContext);
	} else {
		throw new Error(LocalizedConstants.msgMissingNodeContext);
	}
	return node;
}
