/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import {
	RefreshAction, EditConnectionAction, AddServerAction, DeleteConnectionAction, DisconnectConnectionAction,
	ActiveConnectionsFilterAction, RecentConnectionsFilterAction
}
	from 'sql/workbench/services/objectExplorer/browser/connectionTreeAction';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { TestErrorMessageService } from 'sql/platform/errorMessage/test/common/testErrorMessageService';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServerTreeView } from 'sql/workbench/contrib/objectExplorer/browser/serverTreeView';
import * as  LocalizedConstants from 'sql/workbench/services/connection/browser/localizedConstants';
import { ObjectExplorerService, ObjectExplorerNodeEventArgs } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { ServerTreeDataSource } from 'sql/workbench/services/objectExplorer/browser/serverTreeDataSource';
import { Emitter, Event } from 'vs/base/common/event';
import Severity from 'vs/base/common/severity';
import { ObjectExplorerActionsContext } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { IConnectionResult, IConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { TreeSelectionHandler } from 'sql/workbench/services/objectExplorer/browser/treeSelectionHandler';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { UNSAVED_GROUP_ID, mssqlProviderName } from 'sql/platform/connection/common/constants';
import { $ } from 'vs/base/browser/dom';
import { OEManageConnectionAction } from 'sql/workbench/contrib/dashboard/browser/dashboardActions';
import { IViewsService, IView, ViewContainerLocation, ViewContainer, IViewPaneContainer } from 'vs/workbench/common/views';
import { ConsoleLogService } from 'vs/platform/log/common/log';
import { IProgressIndicator } from 'vs/platform/progress/common/progress';
import { IPaneComposite } from 'vs/workbench/common/panecomposite';

suite('SQL Connection Tree Action tests', () => {
	let errorMessageService: TypeMoq.Mock<TestErrorMessageService>;
	let connectionResult: IConnectionResult = {
		connected: true,
		errorMessage: undefined,
		errorCode: undefined,
		callStack: undefined
	};
	let capabilitiesService = new TestCapabilitiesService();
	const logService = new ConsoleLogService();

	setup(() => {
		errorMessageService = TypeMoq.Mock.ofType(TestErrorMessageService, TypeMoq.MockBehavior.Loose);
		let nothing: void;
		errorMessageService.setup(x => x.showDialog(Severity.Error, TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => nothing);
	});

	function createConnectionManagementService(isConnectedReturnValue: boolean, profileToReturn: ConnectionProfile): TypeMoq.Mock<TestConnectionManagementService> {
		let connectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
		connectionManagementService.callBase = true;
		connectionManagementService.setup(x => x.isConnected(undefined, TypeMoq.It.isAny())).returns(() => isConnectedReturnValue);
		connectionManagementService.setup(x => x.connect(TypeMoq.It.isAny(), undefined, TypeMoq.It.isAny(), undefined)).returns(() => Promise.resolve(connectionResult));
		connectionManagementService.setup(x => x.disconnect(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		connectionManagementService.setup(x => x.findExistingConnection(TypeMoq.It.isAny())).returns(() => undefined);
		connectionManagementService.setup(x => x.showDashboard(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
		connectionManagementService.setup(x => x.isProfileConnected(TypeMoq.It.isAny())).returns(() => isConnectedReturnValue);
		connectionManagementService.setup(x => x.isProfileConnecting(TypeMoq.It.isAny())).returns(() => false);
		connectionManagementService.setup(x => x.showConnectionDialog(undefined, undefined, TypeMoq.It.isAny())).returns(() => new Promise<void>((resolve, reject) => resolve()));
		connectionManagementService.setup(x => x.onConnect).returns(() => new Emitter<IConnectionParams>().event);
		connectionManagementService.setup(x => x.onDisconnect).returns(() => new Emitter<any>().event);
		connectionManagementService.setup(x => x.deleteConnectionGroup(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
		connectionManagementService.setup(x => x.deleteConnection(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
		connectionManagementService.setup(x => x.getConnectionProfile(TypeMoq.It.isAny())).returns(() => profileToReturn);
		connectionManagementService.setup(x => x.showEditConnectionDialog(TypeMoq.It.isAny())).returns(() => new Promise<void>((resolve, reject) => resolve()));
		return connectionManagementService;
	}

	function createObjectExplorerService(connectionManagementService: TestConnectionManagementService, getTreeNodeReturnVal: TreeNode): TypeMoq.Mock<ObjectExplorerService> {
		let objectExplorerService = TypeMoq.Mock.ofType(ObjectExplorerService, TypeMoq.MockBehavior.Strict, connectionManagementService);
		objectExplorerService.callBase = true;
		objectExplorerService.setup(x => x.getTreeNode(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(getTreeNodeReturnVal));
		objectExplorerService.setup(x => x.getObjectExplorerNode(TypeMoq.It.isAny())).returns(() => new TreeNode('', '', false, '', '', '', undefined, undefined, undefined, undefined));
		objectExplorerService.setup(x => x.getObjectExplorerNode(undefined)).returns(() => new TreeNode('', '', false, '', '', '', undefined, undefined, undefined, undefined));
		objectExplorerService.setup(x => x.onUpdateObjectExplorerNodes).returns(() => new Emitter<ObjectExplorerNodeEventArgs>().event);

		objectExplorerService.setup(x => x.onUpdateObjectExplorerNodes).returns(() => new Emitter<ObjectExplorerNodeEventArgs>().event);
		return objectExplorerService;
	}

	test('ManageConnectionAction - test if connect is called for manage action if not already connected', () => {
		let isConnectedReturnValue: boolean = false;
		let connection: ConnectionProfile = new ConnectionProfile(capabilitiesService, {
			connectionName: 'Test',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'integrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: 'testId'
		});
		let connectionManagementService = createConnectionManagementService(isConnectedReturnValue, connection);
		let objectExplorerService = createObjectExplorerService(connectionManagementService.object, undefined);
		let treeSelectionMock = TypeMoq.Mock.ofType(TreeSelectionHandler);
		let instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Loose);
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isAny())).returns((input) => {
			return treeSelectionMock.object;
		});

		const viewsService = new class implements IViewsService {
			getActiveViewPaneContainerWithId(viewContainerId: string): IViewPaneContainer {
				throw new Error('Method not implemented.');
			}
			getViewProgressIndicator(id: string): IProgressIndicator {
				throw new Error('Method not implemented.');
			}
			onDidChangeViewContainerVisibility: Event<{ id: string; visible: boolean; location: ViewContainerLocation; }>;
			isViewContainerVisible(id: string): boolean {
				throw new Error('Method not implemented.');
			}
			openViewContainer(id: string, focus?: boolean): Promise<IPaneComposite> {
				throw new Error('Method not implemented.');
			}
			closeViewContainer(id: string): void {
				throw new Error('Method not implemented.');
			}
			getVisibleViewContainer(location: ViewContainerLocation): ViewContainer {
				throw new Error('Method not implemented.');
			}
			getProgressIndicator(id: string): IProgressIndicator {
				throw new Error('Method not implemented.');
			}
			getActiveViewWithId<T extends IView>(id: string): T | null {
				throw new Error('Method not implemented.');
			}
			_serviceBrand: undefined;
			openView<T extends IView>(id: string, focus?: boolean): Promise<T | null> {
				return Promise.resolve(<T><any>{
					id: '',
					serversTree: undefined
				});
			}
			onDidChangeViewVisibility: Event<{ id: string, visible: boolean }> = Event.None;
			closeView(id: string): void {
				return;
			}
			isViewVisible(id: string): boolean {
				return true;
			}
		};

		let manageConnectionAction: OEManageConnectionAction = new OEManageConnectionAction(OEManageConnectionAction.ID,
			OEManageConnectionAction.LABEL, connectionManagementService.object, capabilitiesService, instantiationService.object, objectExplorerService.object, viewsService);

		let actionContext = new ObjectExplorerActionsContext();
		actionContext.connectionProfile = connection.toIConnectionProfile();
		actionContext.isConnectionNode = true;
		return manageConnectionAction.run(actionContext).then(() => {
			connectionManagementService.verify(x => x.connect(TypeMoq.It.isAny(), undefined, TypeMoq.It.isAny(), undefined), TypeMoq.Times.once());
		});
	});

	test('ManageConnectionAction - test if connect is called for manage action on database node if not already connected', () => {
		let isConnectedReturnValue: boolean = false;
		let connection: ConnectionProfile = new ConnectionProfile(capabilitiesService, {
			connectionName: 'Test',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'integrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: 'testId'
		});
		let treeNode = new TreeNode(NodeType.Database, 'db node', false, '', '', '', undefined, undefined, undefined, undefined);
		treeNode.connection = connection;
		let connectionManagementService = createConnectionManagementService(isConnectedReturnValue, connection);
		let objectExplorerService = createObjectExplorerService(connectionManagementService.object, treeNode);
		let treeSelectionMock = TypeMoq.Mock.ofType(TreeSelectionHandler);
		let instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Loose);
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isAny())).returns((input) => {
			return treeSelectionMock.object;
		});

		let manageConnectionAction: OEManageConnectionAction = new OEManageConnectionAction(OEManageConnectionAction.ID,
			OEManageConnectionAction.LABEL, connectionManagementService.object, capabilitiesService, instantiationService.object, objectExplorerService.object, undefined);

		let actionContext = new ObjectExplorerActionsContext();
		actionContext.connectionProfile = connection.toIConnectionProfile();
		actionContext.nodeInfo = treeNode.toNodeInfo();
		return manageConnectionAction.run(actionContext).then((value) => {
			connectionManagementService.verify(x => x.showDashboard(TypeMoq.It.isAny()), TypeMoq.Times.once());
		});
	});


	test('DisconnectConnectionAction - test if disconnect is called when profile is connected', () => {
		let isConnectedReturnValue: boolean = true;
		let connection: ConnectionProfile = new ConnectionProfile(capabilitiesService, {
			connectionName: 'Test',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'integrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: 'testId'
		});
		let connectionManagementService = createConnectionManagementService(isConnectedReturnValue, connection);

		let changeConnectionAction: DisconnectConnectionAction = new DisconnectConnectionAction(DisconnectConnectionAction.ID, DisconnectConnectionAction.LABEL, connection, connectionManagementService.object);

		let actionContext = new ObjectExplorerActionsContext();
		actionContext.connectionProfile = connection.toIConnectionProfile();
		return changeConnectionAction.run(actionContext).then((value) => {
			connectionManagementService.verify(x => x.isProfileConnected(TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
			connectionManagementService.verify(x => x.disconnect(TypeMoq.It.isAny()), TypeMoq.Times.once());
		});
	});

	test('AddServerAction - test if show connection dialog is called', () => {
		let connectionManagementService = createConnectionManagementService(true, undefined);

		let connectionTreeAction: AddServerAction = new AddServerAction(AddServerAction.ID, AddServerAction.LABEL, connectionManagementService.object);
		let conProfGroup = new ConnectionProfileGroup('testGroup', undefined, 'testGroup', undefined, undefined);
		return connectionTreeAction.run(conProfGroup).then((value) => {
			connectionManagementService.verify(x => x.showConnectionDialog(undefined, undefined, TypeMoq.It.isAny()), TypeMoq.Times.once());
		});
	});

	test('ActiveConnectionsFilterAction - test if view is called to display filtered results', () => {
		let instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Loose);
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isAny())).returns((input) => {
			return new Promise((resolve) => resolve({}));
		});

		let serverTreeView = TypeMoq.Mock.ofType(ServerTreeView, TypeMoq.MockBehavior.Strict, undefined, instantiationService.object, undefined, undefined, undefined, undefined, capabilitiesService);
		serverTreeView.setup(x => x.showFilteredTree(TypeMoq.It.isAnyString()));
		serverTreeView.setup(x => x.refreshTree());
		let connectionTreeAction: ActiveConnectionsFilterAction = new ActiveConnectionsFilterAction(ActiveConnectionsFilterAction.ID, ActiveConnectionsFilterAction.LABEL, serverTreeView.object);
		return connectionTreeAction.run().then((value) => {
			serverTreeView.verify(x => x.showFilteredTree('active'), TypeMoq.Times.once());
		});
	});

	test('ActiveConnectionsFilterAction - test if view is called refresh results if action is toggled', () => {
		let instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Loose);
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isAny())).returns((input) => {
			return new Promise((resolve) => resolve({}));
		});

		let serverTreeView = TypeMoq.Mock.ofType(ServerTreeView, TypeMoq.MockBehavior.Strict, undefined, instantiationService.object, undefined, undefined, undefined, undefined, capabilitiesService);
		serverTreeView.setup(x => x.showFilteredTree(TypeMoq.It.isAnyString()));
		serverTreeView.setup(x => x.refreshTree());
		let connectionTreeAction: ActiveConnectionsFilterAction = new ActiveConnectionsFilterAction(ActiveConnectionsFilterAction.ID, ActiveConnectionsFilterAction.LABEL, serverTreeView.object);
		connectionTreeAction.isSet = true;
		return connectionTreeAction.run().then((value) => {
			serverTreeView.verify(x => x.refreshTree(), TypeMoq.Times.once());
		});
	});

	test('RecentConnectionsFilterAction - test if view is called to display filtered results', () => {
		let instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Loose);
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isAny())).returns((input) => {
			return new Promise((resolve) => resolve({}));
		});

		let serverTreeView = TypeMoq.Mock.ofType(ServerTreeView, TypeMoq.MockBehavior.Strict, undefined, instantiationService.object, undefined, undefined, undefined, undefined, capabilitiesService);
		serverTreeView.setup(x => x.showFilteredTree(TypeMoq.It.isAnyString()));
		serverTreeView.setup(x => x.refreshTree());
		let connectionTreeAction: RecentConnectionsFilterAction = new RecentConnectionsFilterAction(RecentConnectionsFilterAction.ID, RecentConnectionsFilterAction.LABEL, serverTreeView.object);
		return connectionTreeAction.run().then((value) => {
			serverTreeView.verify(x => x.showFilteredTree('recent'), TypeMoq.Times.once());
		});
	});

	test('RecentConnectionsFilterAction - test if view is called refresh results if action is toggled', () => {
		let instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Loose);
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isAny())).returns((input) => {
			return new Promise((resolve) => resolve({}));
		});

		let serverTreeView = TypeMoq.Mock.ofType(ServerTreeView, TypeMoq.MockBehavior.Strict, undefined, instantiationService.object, undefined, undefined, undefined, undefined, capabilitiesService);
		serverTreeView.setup(x => x.showFilteredTree(TypeMoq.It.isAnyString()));
		serverTreeView.setup(x => x.refreshTree());
		let connectionTreeAction: RecentConnectionsFilterAction = new RecentConnectionsFilterAction(RecentConnectionsFilterAction.ID, RecentConnectionsFilterAction.LABEL, serverTreeView.object);
		connectionTreeAction.isSet = true;
		return connectionTreeAction.run().then((value) => {
			serverTreeView.verify(x => x.refreshTree(), TypeMoq.Times.once());
		});
	});

	test('DeleteConnectionAction - test delete connection', () => {
		let connectionManagementService = createConnectionManagementService(true, undefined);

		let connection: ConnectionProfile = new ConnectionProfile(capabilitiesService, {
			connectionName: 'Test',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'integrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: 'testId'
		});
		let connectionAction: DeleteConnectionAction = new DeleteConnectionAction(DeleteConnectionAction.ID,
			DeleteConnectionAction.DELETE_CONNECTION_LABEL,
			connection,
			connectionManagementService.object);

		return connectionAction.run().then((value) => {
			connectionManagementService.verify(x => x.deleteConnection(TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
		});

	});

	test('DeleteConnectionAction - test delete connection group', () => {
		let isConnectedReturnValue: boolean = false;
		let connectionManagementService = createConnectionManagementService(isConnectedReturnValue, undefined);
		let conProfGroup = new ConnectionProfileGroup('testGroup', undefined, 'testGroup', undefined, undefined);
		let connectionAction: DeleteConnectionAction = new DeleteConnectionAction(DeleteConnectionAction.ID,
			DeleteConnectionAction.DELETE_CONNECTION_LABEL,
			conProfGroup,
			connectionManagementService.object);

		return connectionAction.run().then((value) => {
			connectionManagementService.verify(x => x.deleteConnectionGroup(TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
		});

	});

	test('DeleteConnectionAction - delete should not be called if connect is an unsaved connection', () => {
		let isConnectedReturnValue: boolean = false;
		let connectionManagementService = createConnectionManagementService(isConnectedReturnValue, undefined);

		let connection: ConnectionProfile = new ConnectionProfile(capabilitiesService, {
			connectionName: 'Test',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'integrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: 'testId'
		});
		connection.parent = new ConnectionProfileGroup(LocalizedConstants.unsavedGroupLabel, undefined, UNSAVED_GROUP_ID, undefined, undefined);
		let connectionAction: DeleteConnectionAction = new DeleteConnectionAction(DeleteConnectionAction.ID,
			DeleteConnectionAction.DELETE_CONNECTION_LABEL,
			connection,
			connectionManagementService.object);

		assert.equal(connectionAction.enabled, false, 'delete action should be disabled.');
	});

	test('RefreshConnectionAction - refresh should be called if connection status is connect', () => {
		let isConnectedReturnValue: boolean = true;
		let sqlProvider = {
			providerId: mssqlProviderName,
			displayName: 'MSSQL',
			connectionOptions: [],
		};

		capabilitiesService.capabilities[mssqlProviderName] = { connection: sqlProvider };

		let connection = new ConnectionProfile(capabilitiesService, {
			connectionName: 'Test',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'inetgrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: 'testID'
		});
		let conProfGroup = new ConnectionProfileGroup('testGroup', undefined, 'testGroup', undefined, undefined);
		conProfGroup.connections = [connection];
		let connectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
		connectionManagementService.callBase = true;
		connectionManagementService.setup(x => x.getConnectionGroups()).returns(() => [conProfGroup]);
		connectionManagementService.setup(x => x.getActiveConnections()).returns(() => [connection]);
		connectionManagementService.setup(x => x.addSavedPassword(TypeMoq.It.isAny())).returns(() => new Promise<ConnectionProfile>((resolve) => {
			resolve(connection);
		}));
		connectionManagementService.setup(x => x.isConnected(undefined, TypeMoq.It.isAny())).returns(() => isConnectedReturnValue);

		let objectExplorerSession = {
			success: true,
			sessionId: '1234',
			rootNode: {
				nodePath: 'testServerName\tables',
				nodeType: NodeType.Folder,
				label: 'Tables',
				isLeaf: false,
				metadata: null,
				nodeSubType: '',
				nodeStatus: '',
				errorMessage: ''
			},
			errorMessage: ''
		};

		let tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName\Db1\tables', '', '', null, null, undefined, undefined);
		tablesNode.connection = connection;
		tablesNode.session = objectExplorerSession;
		let table1Node = new TreeNode(NodeType.Table, 'dbo.Table1', false, 'testServerName\tables\dbo.Table1', '', '', tablesNode, null, undefined, undefined);
		let table2Node = new TreeNode(NodeType.Table, 'dbo.Table1', false, 'testServerName\tables\dbo.Table1', '', '', tablesNode, null, undefined, undefined);
		tablesNode.children = [table1Node, table2Node];
		let objectExplorerService = TypeMoq.Mock.ofType(ObjectExplorerService, TypeMoq.MockBehavior.Loose, connectionManagementService.object);
		objectExplorerService.callBase = true;
		objectExplorerService.setup(x => x.getObjectExplorerNode(TypeMoq.It.isAny())).returns(() => tablesNode);
		objectExplorerService.setup(x => x.refreshTreeNode(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve([table1Node, table2Node]));
		let dataSource = new ServerTreeDataSource(objectExplorerService.object, connectionManagementService.object, undefined);
		let tree = TypeMoq.Mock.ofType(Tree, TypeMoq.MockBehavior.Loose, $('div'), { dataSource });
		tree.callBase = true;

		tree.setup(x => x.refresh(TypeMoq.It.isAny())).returns(() => Promise.resolve(null));
		tree.setup(x => x.expand(TypeMoq.It.isAny())).returns(() => Promise.resolve(null));
		tree.setup(x => x.collapse(TypeMoq.It.isAny())).returns(() => Promise.resolve(null));
		let connectionAction: RefreshAction = new RefreshAction(RefreshAction.ID,
			RefreshAction.LABEL,
			tree.object,
			connection,
			connectionManagementService.object,
			objectExplorerService.object,
			undefined,
			logService);

		return connectionAction.run().then((value) => {
			connectionManagementService.verify(x => x.isConnected(undefined, TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
			objectExplorerService.verify(x => x.getObjectExplorerNode(TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
			objectExplorerService.verify(x => x.refreshTreeNode(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
			tree.verify(x => x.refresh(TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
		});
	});

	test('RefreshConnectionAction - refresh should not be called if connection status is not connect', () => {
		let isConnectedReturnValue: boolean = false;
		let sqlProvider = {
			providerId: mssqlProviderName,
			displayName: 'MSSQL',
			connectionOptions: []
		};

		capabilitiesService.capabilities[mssqlProviderName] = { connection: sqlProvider };

		let connection = new ConnectionProfile(capabilitiesService, {
			connectionName: 'Test',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'inetgrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: 'testID'
		});
		let conProfGroup = new ConnectionProfileGroup('testGroup', undefined, 'testGroup', undefined, undefined);
		conProfGroup.connections = [connection];
		let connectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
		connectionManagementService.callBase = true;
		connectionManagementService.setup(x => x.getConnectionGroups()).returns(() => [conProfGroup]);
		connectionManagementService.setup(x => x.getActiveConnections()).returns(() => [connection]);
		connectionManagementService.setup(x => x.addSavedPassword(TypeMoq.It.isAny())).returns(() => new Promise<ConnectionProfile>((resolve) => {
			resolve(connection);
		}));
		connectionManagementService.setup(x => x.isConnected(undefined, TypeMoq.It.isAny())).returns(() => isConnectedReturnValue);

		let objectExplorerSession = {
			success: true,
			sessionId: '1234',
			rootNode: {
				nodePath: 'testServerName\tables',
				nodeType: NodeType.Folder,
				label: 'Tables',
				isLeaf: false,
				metadata: null,
				nodeSubType: '',
				nodeStatus: '',
				errorMessage: ''
			},
			errorMessage: ''
		};

		let tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName\Db1\tables', '', '', null, null, undefined, undefined);
		tablesNode.connection = connection;
		tablesNode.session = objectExplorerSession;
		let table1Node = new TreeNode(NodeType.Table, 'dbo.Table1', false, 'testServerName\tables\dbo.Table1', '', '', tablesNode, null, undefined, undefined);
		let table2Node = new TreeNode(NodeType.Table, 'dbo.Table1', false, 'testServerName\tables\dbo.Table1', '', '', tablesNode, null, undefined, undefined);
		tablesNode.children = [table1Node, table2Node];
		let objectExplorerService = TypeMoq.Mock.ofType(ObjectExplorerService, TypeMoq.MockBehavior.Loose, connectionManagementService.object);
		objectExplorerService.callBase = true;
		objectExplorerService.setup(x => x.getObjectExplorerNode(TypeMoq.It.isAny())).returns(() => tablesNode);
		objectExplorerService.setup(x => x.refreshTreeNode(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve([table1Node, table2Node]));
		let dataSource = new ServerTreeDataSource(objectExplorerService.object, connectionManagementService.object, undefined);
		let tree = TypeMoq.Mock.ofType(Tree, TypeMoq.MockBehavior.Loose, $('div'), { dataSource });
		tree.callBase = true;

		tree.setup(x => x.refresh(TypeMoq.It.isAny())).returns(() => Promise.resolve(null));
		tree.setup(x => x.expand(TypeMoq.It.isAny())).returns(() => Promise.resolve(null));
		let connectionAction: RefreshAction = new RefreshAction(RefreshAction.ID,
			RefreshAction.LABEL,
			tree.object,
			connection,
			connectionManagementService.object,
			objectExplorerService.object,
			undefined,
			logService);

		return connectionAction.run().then((value) => {
			connectionManagementService.verify(x => x.isConnected(undefined, TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
			objectExplorerService.verify(x => x.getObjectExplorerNode(TypeMoq.It.isAny()), TypeMoq.Times.exactly(0));
			objectExplorerService.verify(x => x.refreshTreeNode(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(0));
			tree.verify(x => x.refresh(TypeMoq.It.isAny()), TypeMoq.Times.exactly(0));
			tree.verify(x => x.expand(TypeMoq.It.isAny()), TypeMoq.Times.exactly(0));
		});
	});

	test('EditConnectionAction - test if show connection dialog is called', () => {
		let connectionManagementService = createConnectionManagementService(true, undefined);

		let connection: ConnectionProfile = new ConnectionProfile(capabilitiesService, {
			connectionName: 'Test',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'integrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: 'testId'
		});

		let connectionAction: EditConnectionAction = new EditConnectionAction(EditConnectionAction.ID,
			EditConnectionAction.LABEL,
			connection,
			connectionManagementService.object);

		return connectionAction.run().then((value) => {
			connectionManagementService.verify(x => x.showEditConnectionDialog(TypeMoq.It.isAny()), TypeMoq.Times.once());
		});
	});
});
