/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { Event } from 'vs/base/common/event';
import { ObjectExplorerNodeEventArgs, IObjectExplorerService, NodeExpandInfoWithProviderId, IServerTreeView } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';

export type ObjectExplorerServiceMockOptions = {
	/**
	 * Return value for getServerTreeView
	 */
	serverTreeView?: IServerTreeView;
	/**
	 * Return value for getTreeNode
	 */
	treeNode?: TreeNode;
};

/**
 *
 * @param options Options to use for setting up functions on the mock to return various values
 */
export function createObjectExplorerServiceMock(options: ObjectExplorerServiceMockOptions): IObjectExplorerService {
	const objectExplorerService = TypeMoq.Mock.ofType(TestObjectExplorerService);

	if (options.treeNode) {
		objectExplorerService.setup(x => x.getTreeNode(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(options.treeNode!));
	}

	if (options.serverTreeView) {
		objectExplorerService.setup(x => x.getServerTreeView()).returns(() => options.serverTreeView!);
	}

	return objectExplorerService.object;
}

/**
 * A basic implementation of IObjectExplorerService to use for testing
 */
export class TestObjectExplorerService implements IObjectExplorerService {

	public _serviceBrand: undefined;

	constructor() { }

	public getSession(sessionId: string): azdata.ObjectExplorerSession { throw new Error('Method not implemented'); }

	public providerRegistered(providerId: string): boolean { return true; }

	public get onUpdateObjectExplorerNodes(): Event<ObjectExplorerNodeEventArgs> { throw new Error('Method not implemented'); }

	public get onSelectionOrFocusChange(): Event<void> { throw new Error('Method not implemented'); }

	public async updateObjectExplorerNodes(connection: IConnectionProfile): Promise<void> { }

	public async deleteObjectExplorerNode(connection: IConnectionProfile): Promise<void> { }

	public onNodeExpanded(expandResponse: NodeExpandInfoWithProviderId): void { }

	public onSessionCreated(handle: number, session: azdata.ObjectExplorerSession): void { }

	public async onSessionDisconnected(handle: number, session: azdata.ObjectExplorerSession): Promise<void> { }

	public getObjectExplorerNode(connection: IConnectionProfile): TreeNode { throw new Error('Method not implemented'); }

	public async createNewSession(providerId: string, connection: ConnectionProfile): Promise<azdata.ObjectExplorerSessionResponse> { throw new Error('Method not implemented'); }

	public async expandNode(providerId: string, session: azdata.ObjectExplorerSession, nodePath: string): Promise<azdata.ObjectExplorerExpandInfo> { throw new Error('Method not implemented'); }

	public async refreshNode(providerId: string, session: azdata.ObjectExplorerSession, nodePath: string): Promise<azdata.ObjectExplorerExpandInfo> { throw new Error('Method not implemented'); }

	public async closeSession(providerId: string, session: azdata.ObjectExplorerSession): Promise<azdata.ObjectExplorerCloseSessionResponse> { throw new Error('Method not implemented'); }

	public registerProvider(providerId: string, provider: azdata.ObjectExplorerProvider): void { }

	public registerNodeProvider(nodeProvider: azdata.ObjectExplorerNodeProvider): void { }

	public async resolveTreeNodeChildren(session: azdata.ObjectExplorerSession, parentTree: TreeNode): Promise<TreeNode[]> { throw new Error('Method not implemented'); }

	public async refreshTreeNode(session: azdata.ObjectExplorerSession, parentTree: TreeNode): Promise<TreeNode[]> { throw new Error('Method not implemented'); }

	public registerServerTreeView(view: IServerTreeView): void { }

	public getSelectedProfileAndDatabase(): { profile: ConnectionProfile, databaseName: string } | undefined { return undefined; }

	public isFocused(): boolean { return true; }

	public getServerTreeView(): IServerTreeView { throw new Error('Method not implemented'); }

	public async findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames?: string[]): Promise<azdata.NodeInfo[]> { throw new Error('Method not implemented'); }

	public getActiveConnectionNodes(): TreeNode[] { throw new Error('Method not implemented'); }

	public async getNodeActions(connectionId: string, nodePath: string): Promise<string[]> { throw new Error('Method not implemented'); }

	public async refreshNodeInView(connectionId: string, nodePath: string): Promise<TreeNode> { throw new Error('Method not implemented'); }

	public getSessionConnectionProfile(sessionId: string): azdata.IConnectionProfile { throw new Error('Method not implemented'); }

	public async getTreeNode(connectionId: string, nodePath: string): Promise<TreeNode> { throw new Error('Method not implemented'); }
}
