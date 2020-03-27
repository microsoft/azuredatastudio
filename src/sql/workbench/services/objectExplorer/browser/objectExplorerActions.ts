/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecuteCommandAction } from 'vs/platform/actions/common/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';

import * as azdata from 'azdata';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { TreeSelectionHandler } from 'sql/workbench/services/objectExplorer/browser/treeSelectionHandler';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';

export class ObjectExplorerActionsContext implements azdata.ObjectExplorerContext {
	public connectionProfile: azdata.IConnectionProfile;
	public nodeInfo: azdata.NodeInfo;
	public isConnectionNode: boolean = false;
}

export async function getTreeNode(context: ObjectExplorerActionsContext, objectExplorerService: IObjectExplorerService): Promise<TreeNode> {
	if (context.isConnectionNode) {
		return Promise.resolve(undefined);
	}
	return await objectExplorerService.getTreeNode(context.connectionProfile.id, context.nodeInfo.nodePath);
}


export class OEAction extends ExecuteCommandAction {
	private _treeSelectionHandler: TreeSelectionHandler;

	constructor(
		id: string, label: string,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ICommandService commandService: ICommandService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
		super(id, label, commandService);
	}

	public async run(actionContext: any): Promise<boolean> {
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);

		let profile: IConnectionProfile;
		if (actionContext instanceof ObjectExplorerActionsContext) {
			if (actionContext.isConnectionNode) {
				profile = new ConnectionProfile(this._capabilitiesService, actionContext.connectionProfile);
			} else {
				// Get the "correct" version from the tree
				let treeNode = await getTreeNode(actionContext, this._objectExplorerService);
				profile = TreeUpdateUtils.getConnectionProfile(treeNode);
			}
		}
		this._treeSelectionHandler.onTreeActionStateChange(true);

		return super.run(profile).then(() => {
			this._treeSelectionHandler.onTreeActionStateChange(false);
			return true;
		});
	}
}
