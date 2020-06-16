/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import { handleOeRefreshCommand } from 'sql/workbench/contrib/scripting/browser/scriptingActions';
import { ObjectExplorerActionsContext } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { ServerTreeView } from 'sql/workbench/contrib/objectExplorer/browser/serverTreeView';
import { createObjectExplorerServiceMock } from 'sql/workbench/services/objectExplorer/test/browser/testObjectExplorerService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { TestTree } from 'sql/workbench/test/treeMock';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';

const connection: azdata.IConnectionProfile = {
	options: [],
	connectionName: '',
	serverName: 'server1',
	databaseName: 'database',
	userName: 'user',
	password: 'password',
	authenticationType: '',
	providerName: mssqlProviderName,
	groupId: '',
	groupFullName: '',
	savePassword: true,
	saveProfile: true,
	id: 'server1'
};

const nodeInfo: azdata.NodeInfo = {
	nodePath: 'MyServer',
	nodeStatus: '',
	nodeSubType: '',
	nodeType: 'Server',
	isLeaf: false,
	label: 'MyServer',
	metadata: undefined,
	errorMessage: ''
};

const treeNode = new TreeNode(NodeType.Database, 'db node', false, '', '', '', undefined, undefined, undefined, undefined);
const oeActionArgs: ObjectExplorerActionsContext = { connectionProfile: connection, isConnectionNode: false, nodeInfo: nodeInfo };

let instantiationService: IInstantiationService;
let logServiceMock: TypeMoq.Mock<ILogService>;
let treeMock: TypeMoq.Mock<ITree>;

suite('Scripting Actions', () => {

	setup(() => {
		const collection = new ServiceCollection();
		instantiationService = new InstantiationService(collection);
		const capabilitiesService = new TestCapabilitiesService();
		const connectionManagementServiceMock = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Loose);
		const serverTreeViewMock = TypeMoq.Mock.ofType(ServerTreeView, TypeMoq.MockBehavior.Loose, connectionManagementServiceMock.object, instantiationService, undefined, undefined, undefined, undefined, capabilitiesService);
		treeMock = TypeMoq.Mock.ofType(TestTree);
		serverTreeViewMock.setup(x => x.tree).returns(() => treeMock.object);
		collection.set(IObjectExplorerService, createObjectExplorerServiceMock({ serverTreeView: serverTreeViewMock.object, treeNode: treeNode }).object);
		logServiceMock = TypeMoq.Mock.ofInstance(new NullLogService());
		collection.set(ILogService, logServiceMock.object);
		collection.set(INotificationService, new TestNotificationService());
	});

	suite('objectExplorer.refreshNode', () => {

		test('refresh should be called when action is invoked', async () => {
			await instantiationService.invokeFunction(handleOeRefreshCommand, oeActionArgs);
			treeMock.verify(x => x.refresh(TypeMoq.It.isAny()), TypeMoq.Times.once());
		});

		test('errors should be logged when refresh throws', async () => {
			treeMock.setup(x => x.refresh(TypeMoq.It.isAny())).throws(new Error());
			await instantiationService.invokeFunction(handleOeRefreshCommand, oeActionArgs);
			treeMock.verify(x => x.refresh(TypeMoq.It.isAny()), TypeMoq.Times.once());
			logServiceMock.verify(x => x.error(TypeMoq.It.isAny()), TypeMoq.Times.once());
		});
	});
});
