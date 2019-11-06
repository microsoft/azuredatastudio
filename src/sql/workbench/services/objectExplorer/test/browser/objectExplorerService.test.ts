/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ObjectExplorerService, NodeExpandInfoWithProviderId } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { NodeType } from 'sql/workbench/parts/objectExplorer/common/nodeType';
import { TreeNode, TreeItemCollapsibleState } from 'sql/workbench/parts/objectExplorer/common/treeNode';

import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { ServerTreeView } from 'sql/workbench/parts/objectExplorer/browser/serverTreeView';
import { ConnectionOptionSpecialType, ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { Event, Emitter } from 'vs/base/common/event';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { NullLogService } from 'vs/platform/log/common/log';
import { TestObjectExplorerProvider } from 'sql/workbench/services/objectExplorer/test/common/testObjectExplorerProvider';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';

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
	let serverTreeView: TypeMoq.Mock<ServerTreeView>;

	setup(() => {

		let NodeInfoTable1 = {
			nodePath: 'testServerName/tables/dbo.Table1',
			nodeType: NodeType.Table,
			label: 'dbo.Table1',
			isLeaf: false,
			metadata: null,
			nodeSubType: '',
			nodeStatus: '',
			errorMessage: ''
		};
		let NodeInfoTable2 = {
			nodePath: 'testServerName/tables/dbo.Table2',
			nodeType: NodeType.Table,
			label: 'dbo.Table2',
			isLeaf: false,
			metadata: null,
			nodeSubType: '',
			nodeStatus: '',
			errorMessage: ''
		};

		let NodeInfoTable3 = {
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
		let response: azdata.ObjectExplorerSessionResponse = {
			sessionId: objectExplorerSession.sessionId
		};

		let failedResponse: azdata.ObjectExplorerSessionResponse = {
			sessionId: failedSessionId
		};

		sqlOEProvider = TypeMoq.Mock.ofType(TestObjectExplorerProvider, TypeMoq.MockBehavior.Loose);
		sqlOEProvider.callBase = true;

		let onCapabilitiesRegistered = new Emitter<string>();
		let sqlProvider = {
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

		let capabilitiesService = new TestCapabilitiesService();
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

		let extensionManagementServiceMock = {
			getInstalled: () => {
				return Promise.resolve([]);
			}
		};

		const logService = new NullLogService();
		objectExplorerService = new ObjectExplorerService(connectionManagementService.object, undefined, capabilitiesService, logService);
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
		} as ServerTreeView);
	});

	test('create new session should create session successfully', (done) => {
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(session => {
			assert.equal(session !== null || session !== undefined, true);
			assert.equal(session.sessionId, '1234');
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			let node = objectExplorerService.getObjectExplorerNode(connection);
			assert.notEqual(node, undefined);
			assert.equal(node.session.success, true);
			done();
		}, err => {
			// Must call done here so test indicates it's finished if errors occur
			done(err);
		});
	});

	test('create new session should raise failed event for failed session', (done) => {
		objectExplorerService.createNewSession(mssqlProviderName, connectionToFail).then(session => {
			assert.equal(session !== null || session !== undefined, true);
			assert.equal(session.sessionId, failedSessionId);
			let currentNumberOfSuccessfulSessions = numberOfSuccessfulSessions;
			objectExplorerService.onSessionCreated(1, objectExplorerFailedSession);
			let node = objectExplorerService.getObjectExplorerNode(connection);
			assert.equal(node, undefined);
			assert.equal(currentNumberOfSuccessfulSessions, numberOfSuccessfulSessions);
			done();
		}, err => {
			// Must call done here so test indicates it's finished if errors occur
			done(err);
		});
	});

	test('close session should close session successfully', (done) => {
		objectExplorerService.closeSession(mssqlProviderName, objectExplorerSession).then(session => {
			assert.equal(session !== null || session !== undefined, true);
			assert.equal(session.success, true);
			assert.equal(session.sessionId, '1234');
			done();
		}, err => {
			// Must call done here so test indicates it's finished if errors occur
			done(err);
		});
	});

	test('expand node should expand node correctly', (done) => {
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.expandNode(mssqlProviderName, objectExplorerSession, 'testServerName/tables').then(expandInfo => {
				assert.equal(expandInfo !== null || expandInfo !== undefined, true);
				assert.equal(expandInfo.sessionId, '1234');
				assert.equal(expandInfo.nodes.length, 2);
				let children = expandInfo.nodes;
				assert.equal(children[0].label, 'dbo.Table1');
				assert.equal(children[1].label, 'dbo.Table2');
				done();
			}, err => {
				// Must call done here so test indicates it's finished if errors occur
				done(err);
			});
		});
	});

	test('refresh node should refresh node correctly', (done) => {
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.refreshNode(mssqlProviderName, objectExplorerSession, 'testServerName/tables').then(expandInfo => {
				assert.equal(expandInfo !== null || expandInfo !== undefined, true);
				assert.equal(expandInfo.sessionId, '1234');
				assert.equal(expandInfo.nodes.length, 2);
				let children = expandInfo.nodes;
				assert.equal(children[0].label, 'dbo.Table1');
				assert.equal(children[1].label, 'dbo.Table3');
				done();
			}, err => {
				// Must call done here so test indicates it's finished if errors occur
				done(err);
			});
		});
	});

	test('expand tree node should get correct children', (done) => {
		let tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName/tables', '', '', null, null, undefined, undefined);
		tablesNode.connection = connection;
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, tablesNode).then(children => {
				assert.equal(children !== null || children !== undefined, true);
				assert.equal(children[0].label, 'dbo.Table1');
				assert.equal(children[0].parent, tablesNode);
				assert.equal(children[0].nodePath, 'testServerName/tables/dbo.Table1');
				assert.equal(children[1].label, 'dbo.Table2');
				assert.equal(children[1].parent, tablesNode);
				assert.equal(children[1].nodePath, 'testServerName/tables/dbo.Table2');
				done();
			}, err => {
				// Must call done here so test indicates it's finished if errors occur
				done(err);
			});
		});
	});

	test('refresh tree node should children correctly', (done) => {
		let tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName/tables', '', '', null, null, undefined, undefined);
		tablesNode.connection = connection;
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.refreshTreeNode(objectExplorerSession, tablesNode).then(children => {
				assert.equal(children !== null || children !== undefined, true);
				assert.equal(children[0].label, 'dbo.Table1');
				assert.equal(children[0].parent, tablesNode);
				assert.equal(children[0].nodePath, 'testServerName/tables/dbo.Table1');
				assert.equal(children[1].label, 'dbo.Table3');
				assert.equal(children[1].parent, tablesNode);
				assert.equal(children[1].nodePath, 'testServerName/tables/dbo.Table3');
				done();
			}, err => {
				// Must call done here so test indicates it's finished if errors occur
				done(err);
			});
		});
	});

	test('update object explorer nodes should get active connection, create session, add to the active OE nodes successfully', (done) => {
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.updateObjectExplorerNodes(connection).then(() => {
				let treeNode = objectExplorerService.getObjectExplorerNode(connection);
				assert.equal(treeNode !== null || treeNode !== undefined, true);
				assert.equal(treeNode.getSession(), objectExplorerSession);
				assert.equal(treeNode.getConnectionProfile(), connection);
				assert.equal(treeNode.label, 'Tables');
				assert.equal(treeNode.nodePath, 'testServerName/tables');
				done();
			}, err => {
				// Must call done here so test indicates it's finished if errors occur
				done(err);
			});
		});
	});

	test('delete object explorerNode nodes should delete session, delete the root node to the active OE node', (done) => {
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.updateObjectExplorerNodes(connection).then(() => {
				let treeNode = objectExplorerService.getObjectExplorerNode(connection);
				assert.equal(treeNode !== null && treeNode !== undefined, true);
				objectExplorerService.deleteObjectExplorerNode(connection).then(() => {
					treeNode = objectExplorerService.getObjectExplorerNode(connection);
					assert.equal(treeNode === null || treeNode === undefined, true);
					done();
				});
			}, err => {
				// Must call done here so test indicates it's finished if errors occur
				done(err);
			});
		});
	});

	test('children tree nodes should return correct object explorer session, connection profile and database name', () => {
		let databaseMetaData = {
			metadataType: 0,
			metadataTypeName: 'Database',
			urn: '//server/db1/',
			name: 'Db1',
			schema: null
		};
		let databaseNode = new TreeNode(NodeType.Database, 'Db1', false, 'testServerName\\Db1', '', '', null, databaseMetaData, undefined, undefined);
		databaseNode.connection = connection;
		databaseNode.session = objectExplorerSession;
		let tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName\\Db1\\tables', '', '', databaseNode, null, undefined, undefined);
		databaseNode.children = [tablesNode];
		let table1Node = new TreeNode(NodeType.Table, 'dbo.Table1', false, 'testServerName\\Db1\\tables\\dbo.Table1', '', '', tablesNode, null, undefined, undefined);
		let table2Node = new TreeNode(NodeType.Table, 'dbo.Table2', false, 'testServerName\\Db1\\tables\\dbo.Table2', '', '', tablesNode, null, undefined, undefined);
		tablesNode.children = [table1Node, table2Node];
		assert.equal(table1Node.getSession(), objectExplorerSession);
		assert.equal(table1Node.getConnectionProfile(), connection);
		assert.equal(table1Node.getDatabaseName(), 'Db1');
	});

	test('getSelectedProfileAndDatabase returns the profile if it is selected', () => {
		let serverTreeView = TypeMoq.Mock.ofInstance({ getSelection: () => undefined, onSelectionOrFocusChange: Event.None } as ServerTreeView);
		serverTreeView.setup(x => x.getSelection()).returns(() => [connection]);
		objectExplorerService.registerServerTreeView(serverTreeView.object);

		let selectedProfileAndDatabase = objectExplorerService.getSelectedProfileAndDatabase();
		assert.equal(selectedProfileAndDatabase.profile, connection);
		assert.equal(selectedProfileAndDatabase.databaseName, undefined);
	});

	test('getSelectedProfileAndDatabase returns the profile but no database if children of a server are selected', () => {
		let serverTreeView = TypeMoq.Mock.ofInstance({ getSelection: () => undefined, onSelectionOrFocusChange: Event.None } as ServerTreeView);
		let databaseNode = new TreeNode(NodeType.Folder, 'Folder1', false, 'testServerName\\Folder1', '', '', undefined, undefined, undefined, undefined);
		databaseNode.connection = connection;
		serverTreeView.setup(x => x.getSelection()).returns(() => [databaseNode]);
		objectExplorerService.registerServerTreeView(serverTreeView.object);

		let selectedProfileAndDatabase = objectExplorerService.getSelectedProfileAndDatabase();
		assert.equal(selectedProfileAndDatabase.profile, connection);
		assert.equal(selectedProfileAndDatabase.databaseName, undefined);
	});

	test('getSelectedProfileAndDatabase returns the profile and database if children of a database node are selected', () => {
		let serverTreeView = TypeMoq.Mock.ofInstance({ getSelection: () => undefined, onSelectionOrFocusChange: Event.None } as ServerTreeView);
		let databaseMetadata = {
			metadataType: 0,
			metadataTypeName: 'Database',
			urn: '//server/db1/',
			name: 'Db1',
			schema: undefined
		};
		let databaseName = 'Db1';
		let databaseNode = new TreeNode(NodeType.Database, databaseName, false, 'testServerName\\Db1', '', '', undefined, databaseMetadata, undefined, undefined);
		let tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName\\Db1\\tables', '', '', databaseNode, undefined, undefined, undefined);
		databaseNode.connection = connection;
		databaseNode.children = [tablesNode];
		serverTreeView.setup(x => x.getSelection()).returns(() => [tablesNode]);
		objectExplorerService.registerServerTreeView(serverTreeView.object);

		let selectedProfileAndDatabase = objectExplorerService.getSelectedProfileAndDatabase();
		assert.equal(selectedProfileAndDatabase.profile, connection);
		assert.equal(selectedProfileAndDatabase.databaseName, databaseName);
	});

	test('getSelectedProfileAndDatabase returns undefined when there is no selection', () => {
		let serverTreeView = TypeMoq.Mock.ofInstance({ getSelection: () => undefined, onSelectionOrFocusChange: Event.None } as ServerTreeView);
		serverTreeView.setup(x => x.getSelection()).returns(() => []);
		objectExplorerService.registerServerTreeView(serverTreeView.object);

		let selectedProfileAndDatabase = objectExplorerService.getSelectedProfileAndDatabase();
		assert.equal(selectedProfileAndDatabase, undefined);
	});

	test('isExpanded returns true when the node and its parents are expanded', (done) => {
		let table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		let tableExpandInfo = {
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
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection)).then(childNodes => {
				sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.isAny())).callback(() => {
					objectExplorerService.onNodeExpanded(tableExpandInfo);
				}).returns(() => Promise.resolve(true));
				let tableNode = childNodes.find(node => node.nodePath === table1NodePath);
				objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, tableNode).then(() => {
					// If I check whether the table is expanded, the answer should be yes
					tableNode.isExpanded().then(isExpanded => {
						try {
							assert.equal(isExpanded, true);
							done();
						} catch (err) {
							done(err);
						}
					}, err => done(err));
				}, err => done(err));
			}, err => done(err));
		}, err => done(err));
	});

	test('isExpanded returns false when the node is not expanded', (done) => {
		let table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		serverTreeView.setup(x => x.isExpanded(TypeMoq.It.isAny())).returns(treeNode => {
			return treeNode === connection;
		});
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection)).then(childNodes => {
				// If I check whether the table is expanded, the answer should be no because only its parent node is expanded
				let tableNode = childNodes.find(node => node.nodePath === table1NodePath);
				tableNode.isExpanded().then(isExpanded => {
					try {
						assert.equal(isExpanded, false);
						done();
					} catch (err) {
						done(err);
					}
				}, err => done(err));
			}, err => done(err));
		}, err => done(err));
	});

	test('isExpanded returns false when the parent of the requested node is not expanded', (done) => {
		let table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		let tableExpandInfo = {
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
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection)).then(childNodes => {
				sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.isAny())).callback(() => {
					objectExplorerService.onNodeExpanded(tableExpandInfo);
				}).returns(() => Promise.resolve(true));
				objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, childNodes.find(node => node.nodePath === table1NodePath)).then(() => {
					// If I check whether the table is expanded, the answer should be yes
					let tableNode = childNodes.find(node => node.nodePath === table1NodePath);
					tableNode.isExpanded().then(isExpanded => {
						try {
							assert.equal(isExpanded, false);
							done();
						} catch (err) {
							done(err);
						}
					}, err => done(err));
				}, err => done(err));
			}, err => done(err));
		}, err => done(err));
	});

	test('setting a node to expanded calls expand on the requested tree node', (done) => {
		let table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		let tableExpandInfo = {
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
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			// If I expand the node, then it should get revealed and expanded
			objectExplorerService.getTreeNode(connection.id, table1NodePath).then(tableNode => {
				tableNode.setExpandedState(TreeItemCollapsibleState.Expanded).then(() => {
					try {
						serverTreeView.verify(x => x.setExpandedState(TypeMoq.It.isValue(tableNode), TypeMoq.It.is(state => state === TreeItemCollapsibleState.Expanded)), TypeMoq.Times.once());
						serverTreeView.verify(x => x.reveal(TypeMoq.It.isValue(tableNode)), TypeMoq.Times.once());
						done();
					} catch (err) {
						done(err);
					}
				}, err => done(err));
			}, err => done(err));
		});
	});

	test('setting a node to collapsed calls collapse on the requested tree node', (done) => {
		serverTreeView.setup(x => x.isExpanded(TypeMoq.It.isAny())).returns(treeNode => {
			return treeNode === connection;
		});
		serverTreeView.setup(x => x.setExpandedState(TypeMoq.It.is(treeNode => treeNode === connection), TypeMoq.It.is(state => state === TreeItemCollapsibleState.Collapsed))).returns(() => Promise.resolve());
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection)).then(childNodes => {
				// If I collapse the connection node, then the tree's collapse method should get called
				objectExplorerService.getTreeNode(connection.id, undefined).then(treeNode => treeNode.setExpandedState(TreeItemCollapsibleState.Collapsed).then(() => {
					try {
						serverTreeView.verify(x => x.setExpandedState(TypeMoq.It.is(treeNode => treeNode === connection), TypeMoq.It.is(state => state === TreeItemCollapsibleState.Collapsed)), TypeMoq.Times.once());
						done();
					} catch (err) {
						done(err);
					}
				}, err => done(err)));
			}, err => done(err));
		}, err => done(err));
	});

	test('setNodeSelected sets the tree selection to the requested tree node', (done) => {
		let table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		serverTreeView.setup(x => x.setSelected(TypeMoq.It.is((treeNode: TreeNode) => treeNode.nodePath === table1NodePath), TypeMoq.It.isAny(), undefined)).returns(() => Promise.resolve());
		serverTreeView.setup(x => x.reveal(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			// If I select the table node, then it should be selected and revealed
			objectExplorerService.getTreeNode(connection.id, table1NodePath).then(tableNode => {
				tableNode.setSelected(true).then(() => {
					try {
						serverTreeView.verify(x => x.setSelected(TypeMoq.It.isValue(tableNode), TypeMoq.It.isValue(true), undefined), TypeMoq.Times.once());
						serverTreeView.verify(x => x.reveal(TypeMoq.It.isValue(tableNode)), TypeMoq.Times.once());
						done();
					} catch (err) {
						done(err);
					}
				}, err => done(err));
			}, err => done(err));
		}, err => done(err));
	});

	test('findTreeNode returns the tree node for the relevant node', (done) => {
		let table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.getTreeNode(connection.id, table1NodePath).then(treeNode => {
				try {
					assert.equal(treeNode.nodePath, objectExplorerExpandInfo.nodes[0].nodePath);
					assert.equal(treeNode.nodeTypeId, objectExplorerExpandInfo.nodes[0].nodeType);
					assert.equal(treeNode.label, objectExplorerExpandInfo.nodes[0].label);
					done();
				} catch (err) {
					done(err);
				}
			}, err => done(err));
		});
	});

	test('findTreeNode returns undefined if the requested node does not exist', (done) => {
		let invalidNodePath = objectExplorerSession.rootNode.nodePath + '/invalidNode';
		objectExplorerService.createNewSession(mssqlProviderName, connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.getTreeNode(connection.id, invalidNodePath).then(nodeInfo => {
				try {
					assert.equal(nodeInfo, undefined);
					done();
				} catch (err) {
					done(err);
				}
			}, err => done(err));
		});
	});

	test('refreshInView refreshes the node, expands it, and returns the refreshed node', async () => {
		// Set up the session and tree view
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);
		serverTreeView.setup(x => x.refreshElement(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		objectExplorerService.registerServerTreeView(serverTreeView.object);

		// Refresh the node
		let nodePath = objectExplorerSession.rootNode.nodePath;
		let refreshedNode = await objectExplorerService.refreshNodeInView(connection.id, nodePath);

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

		// Set up the provider to not respond to the second expand request, simulating a request that takes a long time to complete
		const nodePath = objectExplorerSession.rootNode.nodePath;
		sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.is(x => x.nodePath === nodePath))).callback(() => { }).returns(() => Promise.resolve(true));

		// If I queue a second expand request (the first completes normally because of the original mock) and then close the session
		await objectExplorerService.expandNode(mssqlProviderName, objectExplorerSession, objectExplorerSession.rootNode.nodePath);
		let expandPromise = objectExplorerService.expandNode(mssqlProviderName, objectExplorerSession, objectExplorerSession.rootNode.nodePath);
		let closeSessionResult = await objectExplorerService.closeSession(mssqlProviderName, objectExplorerSession);

		// Then the expand request has completed and the session is closed
		let expandResult = await expandPromise;
		assert.equal(expandResult.nodes.length, 0);
		assert.equal(closeSessionResult.success, true);
	});

	test('resolveTreeNodeChildren refreshes a node if it currently has an error', async () => {
		await objectExplorerService.createNewSession(mssqlProviderName, connection);
		objectExplorerService.onSessionCreated(1, objectExplorerSession);

		// If I call resolveTreeNodeChildren once, set an error on the node, and then call it again
		let tablesNodePath = 'testServerName/tables';
		let tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, tablesNodePath, '', '', null, null, undefined, undefined);
		tablesNode.connection = connection;
		await objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, tablesNode);
		sqlOEProvider.verify(x => x.refreshNode(TypeMoq.It.is(x => x.nodePath === tablesNodePath)), TypeMoq.Times.never());
		tablesNode.errorStateMessage = 'test error message';
		await objectExplorerService.resolveTreeNodeChildren(objectExplorerSession, tablesNode);

		// Then refresh gets called on the node
		sqlOEProvider.verify(x => x.refreshNode(TypeMoq.It.is(x => x.nodePath === tablesNodePath)), TypeMoq.Times.once());
	});
});
