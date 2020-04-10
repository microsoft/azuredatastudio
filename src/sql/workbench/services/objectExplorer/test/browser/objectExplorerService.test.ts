/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ObjectExplorerService, NodeExpandInfoWithProviderId, IServerTreeView } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { TreeNode, TreeItemCollapsibleState } from 'sql/workbench/services/objectExplorer/common/treeNode';

import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { Event } from 'vs/base/common/event';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { NullLogService } from 'vs/platform/log/common/log';
import { TestObjectExplorerProvider } from 'sql/workbench/services/objectExplorer/test/common/testObjectExplorerProvider';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { find } from 'vs/base/common/arrays';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { ConnectionOptionSpecialType, ServiceOptionType } from 'sql/platform/connection/common/interfaces';

suite('SQL Object Explorer Service tests', () => {
	let sqlOEProvider: TypeMoq.Mock<TestObjectExplorerProvider>;
	let connectionManagementService: TypeMoq.Mock<TestConnectionManagementService>;
	let connection: ConnectionProfile;
	let connectionToFail: ConnectionProfile;
	let conProfGroup: ConnectionProfileGroup;
	let objectExplorerService: ObjectExplorerService;
	let objectExplorerSession: azdata.ObjectExplorerSession;
	let objectExplorerFailedSession: azdata.ObjectExplorerSession;
	let objectExplorerCloseSessionResponse: azdata.ObjectExplorerCloseSessionResponse;
	let objectExplorerExpandInfo: NodeExpandInfoWithProviderId;
	let objectExplorerExpandInfoRefresh: NodeExpandInfoWithProviderId;
	let sessionId = '1234';
	let failedSessionId = '12345';
	let numberOfSuccessfulSessions: number = 0;
	let serverTreeView: TypeMoq.Mock<IServerTreeView>;

	setup(() => {

		const NodeInfoTable1 = {
			nodePath: 'testServerName/tables/dbo.Table1',
			nodeType: NodeType.Table,
			label: 'dbo.Table1',
			isLeaf: false,
			metadata: null,
			nodeSubType: '',
			nodeStatus: '',
			errorMessage: ''
		};
		const NodeInfoTable2 = {
			nodePath: 'testServerName/tables/dbo.Table2',
			nodeType: NodeType.Table,
			label: 'dbo.Table2',
			isLeaf: false,
			metadata: null,
			nodeSubType: '',
			nodeStatus: '',
			errorMessage: ''
		};

		const NodeInfoTable3 = {
			nodePath: 'testServerName/tables/dbo.Table3',
			nodeType: NodeType.Table,
			label: 'dbo.Table3',
			isLeaf: false,
			metadata: null,
			nodeSubType: '',
			nodeStatus: '',
			errorMessage: ''
		};

		objectExplorerSession = {
			success: true,
			sessionId: sessionId,
			rootNode: {
				nodePath: 'testServerName/tables',
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

		objectExplorerFailedSession = {
			success: false,
			sessionId: failedSessionId,
			rootNode: undefined,
			errorMessage: 'Connection Failed'
		};

		objectExplorerCloseSessionResponse = {
			success: true,
			sessionId: sessionId,
		};

		objectExplorerExpandInfo = {
			sessionId: sessionId,
			nodes: [NodeInfoTable1, NodeInfoTable2],
			errorMessage: '',
			nodePath: objectExplorerSession.rootNode.nodePath,
			providerId: mssqlProviderName
		};

		objectExplorerExpandInfoRefresh = {
			sessionId: sessionId,
			nodes: [NodeInfoTable1, NodeInfoTable3],
			errorMessage: '',
			nodePath: objectExplorerSession.rootNode.nodePath,
			providerId: mssqlProviderName
		};
		const response: azdata.ObjectExplorerSessionResponse = {
			sessionId: objectExplorerSession.sessionId
		};

		const failedResponse: azdata.ObjectExplorerSessionResponse = {
			sessionId: failedSessionId
		};

		sqlOEProvider = TypeMoq.Mock.ofType(TestObjectExplorerProvider, TypeMoq.MockBehavior.Loose);
		sqlOEProvider.callBase = true;

		const sqlProvider = {
			providerId: mssqlProviderName,
			displayName: 'MSSQL',
			connectionOptions: [
				{
					name: 'connectionName',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.connectionName,
					valueType: ServiceOptionType.string
				},
				{
					name: 'serverName',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.serverName,
					valueType: ServiceOptionType.string
				},
				{
					name: 'databaseName',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.databaseName,
					valueType: ServiceOptionType.string
				},
				{
					name: 'userName',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.userName,
					valueType: ServiceOptionType.string
				},
				{
					name: 'authenticationType',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.authType,
					valueType: ServiceOptionType.string
				},
				{
					name: 'password',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.password,
					valueType: ServiceOptionType.string
				},
				{
					name: 'encrypt',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: false,
					isRequired: false,
					specialValueType: undefined,
					valueType: ServiceOptionType.string
				}
			]
		};

		const capabilitiesService = new TestCapabilitiesService();
		capabilitiesService.capabilities[mssqlProviderName] = { connection: sqlProvider };

		connection = new ConnectionProfile(capabilitiesService, {
			connectionName: 'newName',
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
		conProfGroup = new ConnectionProfileGroup('testGroup', undefined, 'testGroup', undefined, undefined);

		connectionToFail = new ConnectionProfile(capabilitiesService, {
			connectionName: 'newName2',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName2',
			databaseName: 'testDatabaseName2',
			authenticationType: 'inetgrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: 'testID2'
		});
		conProfGroup = new ConnectionProfileGroup('testGroup', undefined, 'testGroup', undefined, undefined);
		conProfGroup.connections = [connection];
		connectionManagementService = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
		connectionManagementService.setup(x => x.getConnectionGroups()).returns(() => [conProfGroup]);
		connectionManagementService.setup(x => x.getActiveConnections()).returns(() => [connection]);
		connectionManagementService.setup(x => x.addSavedPassword(TypeMoq.It.isAny())).returns(() => new Promise<ConnectionProfile>((resolve) => {
			resolve(connection);
		}));

		connectionManagementService.setup(x => x.getCapabilities(mssqlProviderName)).returns(() => undefined);

		const logService = new NullLogService();
		objectExplorerService = new ObjectExplorerService(connectionManagementService.object, new NullAdsTelemetryService(), capabilitiesService, logService);
		objectExplorerService.registerProvider(mssqlProviderName, sqlOEProvider.object);
		sqlOEProvider.setup(x => x.createNewSession(TypeMoq.It.is<azdata.ConnectionInfo>(x => x.options['serverName'] === connection.serverName))).returns(() => new Promise<any>((resolve) => {
			resolve(response);
		}));
		sqlOEProvider.setup(x => x.createNewSession(TypeMoq.It.is<azdata.ConnectionInfo>(x => x.options['serverName'] === connectionToFail.serverName))).returns(() => new Promise<any>((resolve) => {
			resolve(failedResponse);
		}));
		sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.isAny())).callback(() => {
			objectExplorerService.onNodeExpanded(objectExplorerExpandInfo);
		}).returns(() => Promise.resolve(true));
		sqlOEProvider.setup(x => x.refreshNode(TypeMoq.It.isAny())).callback(() => {
			objectExplorerService.onNodeExpanded(objectExplorerExpandInfoRefresh);
		}).returns(() => Promise.resolve(true));
		sqlOEProvider.setup(x => x.closeSession(TypeMoq.It.isAny())).returns(() => Promise.resolve(objectExplorerCloseSessionResponse));

		objectExplorerService.onUpdateObjectExplorerNodes(args => {
			if (args && args.errorMessage === undefined) {
				numberOfSuccessfulSessions++;
			}
		});

		serverTreeView = TypeMoq.Mock.ofInstance({
			setExpandedState: (element, expandedState) => Promise.resolve() as Thenable<void>,
			reveal: element => Promise.resolve() as Thenable<void>,
			setSelected: (element, selected, clearOtherSelections) => undefined,
			isExpanded: element => undefined,
			onSelectionOrFocusChange: Event.None,
			refreshElement: (element) => Promise.resolve() as Thenable<void>
		} as IServerTreeView);
	});

	test('create new session should create session successfully', async () => {
		const session = await objectExplorerService.createNewSession(mssqlProviderName, connection);
		assert.equal(session !== null || session !== undefined, true);
		assert.equal(session.sessionId, '1234');
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		const node = objectExplorerService.getObjectExplorerNode(connection);
		assert.notEqual(node, undefined);
		assert.equal(node.session.success, true);
	});

	test('create new session should raise failed event for failed session', async () => {
		const session = await objectExplorerService.createNewSession(mssqlProviderName, connectionToFail);
		assert.equal(session !== null || session !== undefined, true);
		assert.equal(session.sessionId, failedSessionId);
		const currentNumberOfSuccessfulSessions = numberOfSuccessfulSessions;
		objectExplorerService.onSessionCreated(1, objectExplorerFailedSession);
		const node = objectExplorerService.getObjectExplorerNode(connection);
		assert.equal(node, undefined);
		assert.equal(currentNumberOfSuccessfulSessions, numberOfSuccessfulSessions);
	});

	test('close session should close session successfully', async () => {
		const session = await objectExplorerService.closeSession(mssqlProviderName, objectExplorerSession);
		assert.equal(session !== null || session !== undefined, true);
		assert.equal(session.success, true);
		assert.equal(session.sessionId, '1234');
	});

	test('expand node should expand node correctly', async () => {
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		const expandInfo = await objectExplorerService.expandNode(mssqlProviderName, objectExplorerSession, 'testServerName/tables');
		assert.equal(expandInfo !== null || expandInfo !== undefined, true);
		assert.equal(expandInfo.sessionId, '1234');
		assert.equal(expandInfo.nodes.length, 2);
		const children = expandInfo.nodes;
		assert.equal(children[0].label, 'dbo.Table1');
		assert.equal(children[1].label, 'dbo.Table2');
	});

	test('refresh node should refresh node correctly', async () => {
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		const expandInfo = await objectExplorerService.refreshNode(mssqlProviderName, objectExplorerSession, 'testServerName/tables');
		assert.equal(expandInfo !== null || expandInfo !== undefined, true);
		assert.equal(expandInfo.sessionId, '1234');
		assert.equal(expandInfo.nodes.length, 2);
		const children = expandInfo.nodes;
		assert.equal(children[0].label, 'dbo.Table1');
		assert.equal(children[1].label, 'dbo.Table3');
	});

	test('expand tree node should get correct children', async () => {
		const tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName/tables', '', '', null, null, undefined, undefined);
		tablesNode.connection = connection;
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		const children = await objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, tablesNode);
		assert.equal(children !== null || children !== undefined, true);
		assert.equal(children[0].label, 'dbo.Table1');
		assert.equal(children[0].parent, tablesNode);
		assert.equal(children[0].nodePath, 'testServerName/tables/dbo.Table1');
		assert.equal(children[1].label, 'dbo.Table2');
		assert.equal(children[1].parent, tablesNode);
		assert.equal(children[1].nodePath, 'testServerName/tables/dbo.Table2');
	});

	test('refresh tree node should children correctly', async () => {
		const tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName/tables', '', '', null, null, undefined, undefined);
		tablesNode.connection = connection;
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		const children = await objectExplorerService.refreshTreeNode(objectExplorerSession, tablesNode);
		assert.equal(children !== null || children !== undefined, true);
		assert.equal(children[0].label, 'dbo.Table1');
		assert.equal(children[0].parent, tablesNode);
		assert.equal(children[0].nodePath, 'testServerName/tables/dbo.Table1');
		assert.equal(children[1].label, 'dbo.Table3');
		assert.equal(children[1].parent, tablesNode);
		assert.equal(children[1].nodePath, 'testServerName/tables/dbo.Table3');
	});

	test('update object explorer nodes should get active connection, create session, add to the active OE nodes successfully', async () => {
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		await objectExplorerService.updateObjectExplorerNodes(connection);
		const treeNode = objectExplorerService.getObjectExplorerNode(connection);
		assert.equal(treeNode !== null || treeNode !== undefined, true);
		assert.equal(treeNode.getSession(), objectExplorerSession);
		assert.equal(treeNode.getConnectionProfile(), connection);
		assert.equal(treeNode.label, 'Tables');
		assert.equal(treeNode.nodePath, 'testServerName/tables');
	});

	test('delete object explorerNode nodes should delete session, delete the root node to the active OE node', async () => {
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		await objectExplorerService.updateObjectExplorerNodes(connection);
		let treeNode = objectExplorerService.getObjectExplorerNode(connection);
		assert.equal(treeNode !== null && treeNode !== undefined, true);
		await objectExplorerService.deleteObjectExplorerNode(connection);
		treeNode = objectExplorerService.getObjectExplorerNode(connection);
		assert.equal(treeNode === null || treeNode === undefined, true);
	});

	test('children tree nodes should return correct object explorer session, connection profile and database name', () => {
		const databaseMetaData = {
			metadataType: 0,
			metadataTypeName: 'Database',
			urn: '//server/db1/',
			name: 'Db1',
			schema: null
		};
		const databaseNode = new TreeNode(NodeType.Database, 'Db1', false, 'testServerName\\Db1', '', '', null, databaseMetaData, undefined, undefined);
		databaseNode.connection = connection;
		databaseNode.session = objectExplorerSession;
		const tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName\\Db1\\tables', '', '', databaseNode, null, undefined, undefined);
		databaseNode.children = [tablesNode];
		const table1Node = new TreeNode(NodeType.Table, 'dbo.Table1', false, 'testServerName\\Db1\\tables\\dbo.Table1', '', '', tablesNode, null, undefined, undefined);
		const table2Node = new TreeNode(NodeType.Table, 'dbo.Table2', false, 'testServerName\\Db1\\tables\\dbo.Table2', '', '', tablesNode, null, undefined, undefined);
		tablesNode.children = [table1Node, table2Node];
		assert.equal(table1Node.getSession(), objectExplorerSession);
		assert.equal(table1Node.getConnectionProfile(), connection);
		assert.equal(table1Node.getDatabaseName(), 'Db1');
	});

	test('getSelectedProfileAndDatabase returns the profile if it is selected', () => {
		const serverTreeView = TypeMoq.Mock.ofInstance({ getSelection: () => undefined, onSelectionOrFocusChange: Event.None } as IServerTreeView);
		serverTreeView.setup(x => x.getSelection()).returns(() => [connection]);
		objectExplorerService.registerServerTreeView(serverTreeView.object);

		const selectedProfileAndDatabase = objectExplorerService.getSelectedProfileAndDatabase();
		assert.equal(selectedProfileAndDatabase.profile, connection);
		assert.equal(selectedProfileAndDatabase.databaseName, undefined);
	});

	test('getSelectedProfileAndDatabase returns the profile but no database if children of a server are selected', () => {
		const serverTreeView = TypeMoq.Mock.ofInstance({ getSelection: () => undefined, onSelectionOrFocusChange: Event.None } as IServerTreeView);
		const databaseNode = new TreeNode(NodeType.Folder, 'Folder1', false, 'testServerName\\Folder1', '', '', undefined, undefined, undefined, undefined);
		databaseNode.connection = connection;
		serverTreeView.setup(x => x.getSelection()).returns(() => [databaseNode]);
		objectExplorerService.registerServerTreeView(serverTreeView.object);

		const selectedProfileAndDatabase = objectExplorerService.getSelectedProfileAndDatabase();
		assert.equal(selectedProfileAndDatabase.profile, connection);
		assert.equal(selectedProfileAndDatabase.databaseName, undefined);
	});

	test('getSelectedProfileAndDatabase returns the profile and database if children of a database node are selected', () => {
		const serverTreeView = TypeMoq.Mock.ofInstance({ getSelection: () => undefined, onSelectionOrFocusChange: Event.None } as IServerTreeView);
		const databaseMetadata = {
			metadataType: 0,
			metadataTypeName: 'Database',
			urn: '//server/db1/',
			name: 'Db1',
			schema: undefined
		};
		const databaseName = 'Db1';
		const databaseNode = new TreeNode(NodeType.Database, databaseName, false, 'testServerName\\Db1', '', '', undefined, databaseMetadata, undefined, undefined);
		const tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName\\Db1\\tables', '', '', databaseNode, undefined, undefined, undefined);
		databaseNode.connection = connection;
		databaseNode.children = [tablesNode];
		serverTreeView.setup(x => x.getSelection()).returns(() => [tablesNode]);
		objectExplorerService.registerServerTreeView(serverTreeView.object);

		const selectedProfileAndDatabase = objectExplorerService.getSelectedProfileAndDatabase();
		assert.equal(selectedProfileAndDatabase.profile, connection);
		assert.equal(selectedProfileAndDatabase.databaseName, databaseName);
	});

	test('getSelectedProfileAndDatabase returns undefined when there is no selection', () => {
		const serverTreeView = TypeMoq.Mock.ofInstance({ getSelection: () => undefined, onSelectionOrFocusChange: Event.None } as IServerTreeView);
		serverTreeView.setup(x => x.getSelection()).returns(() => []);
		objectExplorerService.registerServerTreeView(serverTreeView.object);

		const selectedProfileAndDatabase = objectExplorerService.getSelectedProfileAndDatabase();
		assert.equal(selectedProfileAndDatabase, undefined);
	});

	test('isExpanded returns true when the node and its parents are expanded', async () => {
		const table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		const tableExpandInfo = {
			sessionId: sessionId,
			nodes: [],
			errorMessage: '',
			nodePath: table1NodePath,
			providerId: mssqlProviderName
		};
		serverTreeView.setup(x => x.isExpanded(TypeMoq.It.isAny())).returns(treeNode => {
			return treeNode === connection || treeNode.nodePath === table1NodePath;
		});
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		const childNodes = await objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection));
		sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.isAny())).callback(() => {
			objectExplorerService.onNodeExpanded(tableExpandInfo);
		}).returns(() => Promise.resolve(true));
		const tableNode = find(childNodes, node => node.nodePath === table1NodePath);
		await objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, tableNode);
		const isExpanded = await tableNode.isExpanded();
		assert.equal(isExpanded, true, 'Table node was not expanded');
	});

	test('isExpanded returns false when the node is not expanded', async () => {
		const table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		serverTreeView.setup(x => x.isExpanded(TypeMoq.It.isAny())).returns(treeNode => {
			return treeNode === connection;
		});
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		const childNodes = await objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection));
		// If I check whether the table is expanded, the answer should be no because only its parent node is expanded
		const tableNode = find(childNodes, node => node.nodePath === table1NodePath);
		const isExpanded = await tableNode.isExpanded();
		assert.equal(isExpanded, false);
	});

	test('isExpanded returns false when the parent of the requested node is not expanded', async () => {
		const table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		const tableExpandInfo = {
			sessionId: sessionId,
			nodes: [],
			errorMessage: '',
			nodePath: table1NodePath,
			providerId: mssqlProviderName
		};
		serverTreeView.setup(x => x.isExpanded(TypeMoq.It.isAny())).returns(treeNode => {
			return treeNode.nodePath === table1NodePath;
		});
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		const childNodes = await objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection));
		sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.isAny())).callback(() => {
			objectExplorerService.onNodeExpanded(tableExpandInfo);
		}).returns(() => Promise.resolve(true));
		await objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, find(childNodes, node => node.nodePath === table1NodePath));
		// If I check whether the table is expanded, the answer should be yes
		const tableNode = find(childNodes, node => node.nodePath === table1NodePath);
		const isExpanded = await tableNode.isExpanded();
		assert.equal(isExpanded, false);
	});

	test('setting a node to expanded calls expand on the requested tree node', async () => {
		const table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		const tableExpandInfo = {
			sessionId: sessionId,
			nodes: [],
			errorMessage: '',
			nodePath: table1NodePath,
			providerId: mssqlProviderName
		};
		// Set up the OE provider so that the second expand call expands the table
		sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.is(nodeInfo => nodeInfo.nodePath === table1NodePath))).callback(() => {
			objectExplorerService.onNodeExpanded(tableExpandInfo);
		}).returns(() => Promise.resolve(true));
		serverTreeView.setup(x => x.setExpandedState(TypeMoq.It.isAny(), TypeMoq.It.is(state => state === TreeItemCollapsibleState.Expanded))).returns(treeNode => {
			if (treeNode instanceof ConnectionProfile) {
				treeNode = objectExplorerService.getObjectExplorerNode(treeNode);
			}
			return objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, treeNode).then(() => undefined);
		});
		serverTreeView.setup(x => x.reveal(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		// If I expand the node, then it should get revealed and expanded
		const tableNode = await objectExplorerService.getTreeNode(connection.id, table1NodePath);
		await tableNode.setExpandedState(TreeItemCollapsibleState.Expanded);
		serverTreeView.verify(x => x.setExpandedState(TypeMoq.It.isValue(tableNode), TypeMoq.It.is(state => state === TreeItemCollapsibleState.Expanded)), TypeMoq.Times.once());
		serverTreeView.verify(x => x.reveal(TypeMoq.It.isValue(tableNode)), TypeMoq.Times.once());
	});

	test('setting a node to collapsed calls collapse on the requested tree node', async () => {
		serverTreeView.setup(x => x.isExpanded(TypeMoq.It.isAny())).returns(treeNode => {
			return treeNode === connection;
		});
		serverTreeView.setup(x => x.setExpandedState(TypeMoq.It.is(treeNode => treeNode === connection), TypeMoq.It.is(state => state === TreeItemCollapsibleState.Collapsed))).returns(() => Promise.resolve());
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		await objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection));
		// If I collapse the connection node, then the tree's collapse method should get called
		const treeNode = await objectExplorerService.getTreeNode(connection.id, undefined);
		await treeNode.setExpandedState(TreeItemCollapsibleState.Collapsed);
		serverTreeView.verify(x => x.setExpandedState(TypeMoq.It.is(treeNode => treeNode === connection), TypeMoq.It.is(state => state === TreeItemCollapsibleState.Collapsed)), TypeMoq.Times.once());
	});

	test('setNodeSelected sets the tree selection to the requested tree node', async () => {
		const table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		serverTreeView.setup(x => x.setSelected(TypeMoq.It.is((treeNode: TreeNode) => treeNode.nodePath === table1NodePath), TypeMoq.It.isAny(), undefined)).returns(() => Promise.resolve());
		serverTreeView.setup(x => x.reveal(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		// If I select the table node, then it should be selected and revealed
		const tableNode = await objectExplorerService.getTreeNode(connection.id, table1NodePath);
		await tableNode.setSelected(true);
		serverTreeView.verify(x => x.setSelected(TypeMoq.It.isValue(tableNode), TypeMoq.It.isValue(true), undefined), TypeMoq.Times.once());
		serverTreeView.verify(x => x.reveal(TypeMoq.It.isValue(tableNode)), TypeMoq.Times.once());
	});

	test('findTreeNode returns the tree node for the relevant node', async () => {
		const table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		const treeNode = await objectExplorerService.getTreeNode(connection.id, table1NodePath);
		assert.equal(treeNode.nodePath, objectExplorerExpandInfo.nodes[0].nodePath);
		assert.equal(treeNode.nodeTypeId, objectExplorerExpandInfo.nodes[0].nodeType);
		assert.equal(treeNode.label, objectExplorerExpandInfo.nodes[0].label);
	});

	test('findTreeNode returns undefined if the requested node does not exist', async () => {
		const invalidNodePath = objectExplorerSession.rootNode.nodePath + '/invalidNode';
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		const nodeInfo = await objectExplorerService.getTreeNode(connection.id, invalidNodePath);
		assert.equal(nodeInfo, undefined);
	});

	test('refreshInView refreshes the node, expands it, and returns the refreshed node', async () => {
		// Set up the session and tree view
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		serverTreeView.setup(x => x.refreshElement(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		objectExplorerService.registerServerTreeView(serverTreeView.object);

		// Refresh the node
		const nodePath = objectExplorerSession.rootNode.nodePath;
		const refreshedNode = await objectExplorerService.refreshNodeInView(connection.id, nodePath);

		// Verify that it was refreshed, expanded, and the refreshed detailed were returned
		sqlOEProvider.verify(x => x.refreshNode(TypeMoq.It.is(refreshNode => refreshNode.nodePath === nodePath)), TypeMoq.Times.once());
		refreshedNode.children.forEach((childNode, index) => {
			assert.equal(childNode.nodePath, objectExplorerExpandInfoRefresh.nodes[index].nodePath);
		});
	});

	test('Session can be closed even if expand requests are pending', async () => {

		// Set up the session
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);

		// Set up the provider to not respond to the second expand request, simulating a request that takes a long time to compconste
		const nodePath = objectExplorerSession.rootNode.nodePath;
		sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.is(x => x.nodePath === nodePath))).callback(() => { }).returns(() => Promise.resolve(true));

		// If I queue a second expand request (the first compconstes normally because of the original mock) and then close the session
		await objectExplorerService.expandNode(mssqlProviderName, objectExplorerSession, objectExplorerSession.rootNode.nodePath);
		const expandPromise = objectExplorerService.expandNode(mssqlProviderName, objectExplorerSession, objectExplorerSession.rootNode.nodePath);
		const closeSessionResult = await objectExplorerService.closeSession(mssqlProviderName, objectExplorerSession);

		// Then the expand request has compconsted and the session is closed
		const expandResult = await expandPromise;
		assert.equal(expandResult.nodes.length, 0);
		assert.equal(closeSessionResult.success, true);
	});

	test('resolveTreeNodeChildren refreshes a node if it currently has an error', async () => {
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);

		// If I call resolveTreeNodeChildren once, set an error on the node, and then call it again
		const tablesNodePath = 'testServerName/tables';
		const tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, tablesNodePath, '', '', null, null, undefined, undefined);
		tablesNode.connection = connection;
		await objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, tablesNode);
		sqlOEProvider.verify(x => x.refreshNode(TypeMoq.It.is(x => x.nodePath === tablesNodePath)), TypeMoq.Times.never());
		tablesNode.errorStateMessage = 'test error message';
		await objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, tablesNode);

		// Then refresh gets called on the node
		sqlOEProvider.verify(x => x.refreshNode(TypeMoq.It.is(x => x.nodePath === tablesNodePath)), TypeMoq.Times.once());
	});
});
