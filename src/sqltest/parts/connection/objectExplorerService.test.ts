/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { ObjectExplorerProviderTestService } from 'sqltest/stubs/objectExplorerProviderTestService';
import { TestConnectionManagementService } from 'sqltest/stubs/connectionManagementService.test';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/parts/connection/common/connectionProfileGroup';
import { ObjectExplorerService } from 'sql/parts/registeredServer/common/objectExplorerService';
import { NodeType } from 'sql/parts/registeredServer/common/nodeType';
import { TreeNode } from 'sql/parts/registeredServer/common/treeNode';

import { TPromise } from 'vs/base/common/winjs.base';
import * as sqlops from 'sqlops';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { ServerTreeView } from 'sql/parts/registeredServer/viewlet/serverTreeView';
import { ConnectionOptionSpecialType } from 'sql/workbench/api/common/sqlExtHostTypes';
import Event from 'vs/base/common/event';

suite('SQL Object Explorer Service tests', () => {
	var sqlOEProvider: TypeMoq.Mock<ObjectExplorerProviderTestService>;
	let connectionManagementService: TypeMoq.Mock<TestConnectionManagementService>;
	let connection: ConnectionProfile;
	let connectionToFail: ConnectionProfile;
	let conProfGroup: ConnectionProfileGroup;
	let objectExplorerService: ObjectExplorerService;
	let objectExplorerSession: sqlops.ObjectExplorerSession;
	let objectExplorerFailedSession: sqlops.ObjectExplorerSession;
	let objectExplorerCloseSessionResponse: sqlops.ObjectExplorerCloseSessionResponse;
	let objectExplorerExpandInfo: sqlops.ObjectExplorerExpandInfo;
	let objectExplorerExpandInfoRefresh: sqlops.ObjectExplorerExpandInfo;
	let sessionId = '1234';
	let failedSessionId = '12345';
	let numberOfFailedSession: number = 0;
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
			nodePath: objectExplorerSession.rootNode.nodePath
		};

		objectExplorerExpandInfoRefresh = {
			sessionId: sessionId,
			nodes: [NodeInfoTable1, NodeInfoTable3],
			errorMessage: '',
			nodePath: objectExplorerSession.rootNode.nodePath
		};
		let response: sqlops.ObjectExplorerSessionResponse = {
			sessionId: objectExplorerSession.sessionId
		};

		let failedResponse: sqlops.ObjectExplorerSessionResponse = {
			sessionId: failedSessionId
		};

		sqlOEProvider = TypeMoq.Mock.ofType(ObjectExplorerProviderTestService, TypeMoq.MockBehavior.Loose);
		sqlOEProvider.callBase = true;


		let sqlProvider = {
			protocolVersion: '1',
			providerName: 'MSSQL',
			providerDisplayName: 'MSSQL',
			connectionProvider: {
				options: [
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
						valueType: 0
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
						valueType: 0
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
						valueType: 0
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
						valueType: 0
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
						valueType: 0
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
						valueType: 0
					}]
			},
			adminServicesProvider: { databaseInfoOptions: [], databaseFileInfoOptions: [], fileGroupInfoOptions: [] },
			features: undefined
		};

		connection = new ConnectionProfile(sqlProvider, {
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'inetgrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			getOptionsKey: undefined,
			matches: undefined,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: 'testID'
		});
		conProfGroup = new ConnectionProfileGroup('testGroup', undefined, 'testGroup', undefined, undefined);

		connectionToFail = new ConnectionProfile(sqlProvider, {
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName2',
			databaseName: 'testDatabaseName2',
			authenticationType: 'inetgrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			getOptionsKey: undefined,
			matches: undefined,
			providerName: 'MSSQL',
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

		connectionManagementService.setup(x => x.getCapabilities('MSSQL')).returns(() => undefined);

		objectExplorerService = new ObjectExplorerService(connectionManagementService.object, undefined);
		objectExplorerService.registerProvider('MSSQL', sqlOEProvider.object);
		sqlOEProvider.setup(x => x.createNewSession(TypeMoq.It.is<sqlops.ConnectionInfo>(x => x.options['serverName'] === connection.serverName))).returns(() => new Promise<any>((resolve) => {
			resolve(response);
		}));
		sqlOEProvider.setup(x => x.createNewSession(TypeMoq.It.is<sqlops.ConnectionInfo>(x => x.options['serverName'] === connectionToFail.serverName))).returns(() => new Promise<any>((resolve) => {
			resolve(failedResponse);
		}));
		sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.isAny())).callback(() => {
			objectExplorerService.onNodeExpanded(1, objectExplorerExpandInfo);
		}).returns(() => TPromise.as(true));
		sqlOEProvider.setup(x => x.refreshNode(TypeMoq.It.isAny())).callback(() => {
			objectExplorerService.onNodeExpanded(1, objectExplorerExpandInfoRefresh);
		}).returns(() => TPromise.as(true));
		sqlOEProvider.setup(x => x.closeSession(TypeMoq.It.isAny())).returns(() => TPromise.as(objectExplorerCloseSessionResponse));

		objectExplorerService.onUpdateObjectExplorerNodes(args => {
			if (args && args.errorMessage !== undefined) {
				numberOfFailedSession++;
			}
		});

		serverTreeView = TypeMoq.Mock.ofInstance({
			expand: element => Promise.resolve() as Thenable<void>,
			collapse: element => Promise.resolve() as Thenable<void>,
			reveal: element => Promise.resolve() as Thenable<void>,
			select: element => undefined,
			isExpanded: element => undefined,
			onSelectionOrFocusChange: Event.None
		} as ServerTreeView);
	});

	test('create new session should create session successfully', (done) => {
		objectExplorerService.createNewSession('MSSQL', connection).then(session => {
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
		objectExplorerService.createNewSession('MSSQL', connectionToFail).then(session => {
			assert.equal(session !== null || session !== undefined, true);
			assert.equal(session.sessionId, failedSessionId);
			let currentNumberOfFailedSession = numberOfFailedSession;
			objectExplorerService.onSessionCreated(1, objectExplorerFailedSession);
			let node = objectExplorerService.getObjectExplorerNode(connection);
			assert.equal(node, undefined);
			assert.equal(currentNumberOfFailedSession + 1, numberOfFailedSession);
			done();
		}, err => {
			// Must call done here so test indicates it's finished if errors occur
			done(err);
		});
	});

	test('close session should close session successfully', (done) => {
		objectExplorerService.closeSession('MSSQL', objectExplorerSession).then(session => {
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
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.expandNode('MSSQL', objectExplorerSession, 'testServerName/tables').then(expandInfo => {
				assert.equal(expandInfo !== null || expandInfo !== undefined, true);
				assert.equal(expandInfo.sessionId, '1234');
				assert.equal(expandInfo.nodes.length, 2);
				var children = expandInfo.nodes;
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
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.refreshNode('MSSQL', objectExplorerSession, 'testServerName/tables').then(expandInfo => {
				assert.equal(expandInfo !== null || expandInfo !== undefined, true);
				assert.equal(expandInfo.sessionId, '1234');
				assert.equal(expandInfo.nodes.length, 2);
				var children = expandInfo.nodes;
				assert.equal(children[0].label, 'dbo.Table1');
				assert.equal(children[1].label, 'dbo.Table3');
				done();
			}, err => {
				// Must call done here so test indicates it's finished if errors occur
				done(err);
			});
		});
	});

	test('expand tree node should children correctly', (done) => {
		var tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName/tables', '', '', null, null);
		tablesNode.connection = connection;
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.expandTreeNode(objectExplorerSession, tablesNode).then(children => {
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
		var tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName/tables', '', '', null, null);
		tablesNode.connection = connection;
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
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
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.updateObjectExplorerNodes(connection).then(() => {
				var treeNode = objectExplorerService.getObjectExplorerNode(connection);
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
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.updateObjectExplorerNodes(connection).then(() => {
				var treeNode = objectExplorerService.getObjectExplorerNode(connection);
				assert.equal(treeNode !== null && treeNode !== undefined, true);
				objectExplorerService.deleteObjectExplorerNode(connection);
				treeNode = objectExplorerService.getObjectExplorerNode(connection);
				assert.equal(treeNode === null || treeNode === undefined, true);
				done();
			}, err => {
				// Must call done here so test indicates it's finished if errors occur
				done(err);
			});
		});
	});

	test('children tree nodes should return correct object explorer session, connection profile and database name', () => {
		var databaseMetaData = {
			metadataType: 0,
			metadataTypeName: 'Database',
			urn: '//server/db1/',
			name: 'Db1',
			schema: null
		};
		var databaseNode = new TreeNode(NodeType.Database, 'Db1', false, 'testServerName\\Db1', '', '', null, databaseMetaData);
		databaseNode.connection = connection;
		databaseNode.session = objectExplorerSession;
		var tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName\\Db1\\tables', '', '', databaseNode, null);
		databaseNode.children = [tablesNode];
		var table1Node = new TreeNode(NodeType.Table, 'dbo.Table1', false, 'testServerName\\Db1\\tables\\dbo.Table1', '', '', tablesNode, null);
		var table2Node = new TreeNode(NodeType.Table, 'dbo.Table2', false, 'testServerName\\Db1\\tables\\dbo.Table2', '', '', tablesNode, null);
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
		let databaseNode = new TreeNode(NodeType.Folder, 'Folder1', false, 'testServerName\\Folder1', '', '', undefined, undefined);
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
		let databaseNode = new TreeNode(NodeType.Database, databaseName, false, 'testServerName\\Db1', '', '', undefined, databaseMetadata);
		let tablesNode = new TreeNode(NodeType.Folder, 'Tables', false, 'testServerName\\Db1\\tables', '', '', databaseNode, undefined);
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
			nodePath: table1NodePath
		};
		serverTreeView.setup(x => x.isExpanded(TypeMoq.It.isAny())).returns(treeNode => {
			return treeNode === connection || treeNode.nodePath === table1NodePath;
		});
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.expandTreeNode(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection)).then(childNodes => {
				sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.isAny())).callback(() => {
					objectExplorerService.onNodeExpanded(1, tableExpandInfo);
				}).returns(() => TPromise.as(true));
				objectExplorerService.expandTreeNode(objectExplorerSession, childNodes.find(node => node.nodePath === table1NodePath)).then(() => {
					// If I check whether the table is expanded, the answer should be yes
					let isExpanded = objectExplorerService.isExpanded(connection.id, table1NodePath);
					try {
						assert.equal(isExpanded, true);
						done();
					} catch (err) {
						done(err);
					}
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
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.expandTreeNode(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection)).then(childNodes => {
				// If I check whether the table is expanded, the answer should be no because only its parent node is expanded
				let isExpanded = objectExplorerService.isExpanded(connection.id, table1NodePath);
				try {
					assert.equal(isExpanded, false);
					done();
				} catch (err) {
					done(err);
				}
			}, err => done(err));
		}, err => done(err));
	});

	test('isExpanded returns false when the parent of the requested node is not expanded', (done) => {
		let table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		let tableExpandInfo = {
			sessionId: sessionId,
			nodes: [],
			errorMessage: '',
			nodePath: table1NodePath
		};
		serverTreeView.setup(x => x.isExpanded(TypeMoq.It.isAny())).returns(treeNode => {
			return treeNode.nodePath === table1NodePath;
		});
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.expandTreeNode(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection)).then(childNodes => {
				sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.isAny())).callback(() => {
					objectExplorerService.onNodeExpanded(1, tableExpandInfo);
				}).returns(() => TPromise.as(true));
				objectExplorerService.expandTreeNode(objectExplorerSession, childNodes.find(node => node.nodePath === table1NodePath)).then(() => {
					// If I check whether the table is expanded, the answer should be yes
					let isExpanded = objectExplorerService.isExpanded(connection.id, table1NodePath);
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

	test('expandNodeForConnection calls expand on the requested tree node', (done) => {
		let table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		let tableExpandInfo = {
			sessionId: sessionId,
			nodes: [],
			errorMessage: '',
			nodePath: table1NodePath
		};
		// Set up the OE provider so that the second expand call expands the table
		sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.is(nodeInfo => nodeInfo.nodePath === objectExplorerSession.rootNode.nodePath))).callback(() => {
			objectExplorerService.onNodeExpanded(1, objectExplorerExpandInfo);
		}).returns(() => TPromise.as(true));
		sqlOEProvider.setup(x => x.expandNode(TypeMoq.It.is(nodeInfo => nodeInfo.nodePath === table1NodePath))).callback(() => {
			objectExplorerService.onNodeExpanded(1, tableExpandInfo);
		}).returns(() => TPromise.as(true));
		let expandedNodePaths: string[] = [];
		serverTreeView.setup(x => x.expand(TypeMoq.It.isAny())).returns(treeNode => {
			if (treeNode instanceof ConnectionProfile) {
				treeNode = objectExplorerService.getObjectExplorerNode(treeNode);
			}
			expandedNodePaths.push(treeNode.nodePath);
			return objectExplorerService.expandTreeNode(objectExplorerSession, treeNode).then(() => undefined);
		});
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			// If I expand the node, then it should get expanded after its parent gets expanded
			objectExplorerService.expandNodeForConnection(connection.id, table1NodePath).then(() => {
				try {
					serverTreeView.verify(x => x.expand(TypeMoq.It.isAny()), TypeMoq.Times.exactly(2));
					assert.equal(expandedNodePaths[0], objectExplorerSession.rootNode.nodePath);
					assert.equal(expandedNodePaths[1], table1NodePath);
					done();
				} catch (err) {
					done(err);
				}
			}, err => done(err));
		});
	});

	test('collapseNodeForConnection calls collapse on the requested tree node', (done) => {
		serverTreeView.setup(x => x.isExpanded(TypeMoq.It.isAny())).returns(treeNode => {
			return treeNode === connection;
		});
		serverTreeView.setup(x => x.collapse(TypeMoq.It.is(treeNode => treeNode === connection))).returns(() => Promise.resolve());
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.expandTreeNode(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection)).then(childNodes => {
				// If I collapse the connection node, then the tree's collapse method should get called
				objectExplorerService.collapseNodeForConnection(connection.id, objectExplorerSession.rootNode.nodePath).then(() => {
					try {
						serverTreeView.verify(x => x.collapse(TypeMoq.It.is(treeNode => treeNode === connection)), TypeMoq.Times.once());
						done();
					} catch (err) {
						done(err);
					}
				}, err => done(err));
			}, err => done(err));
		}, err => done(err));
	});

	test('selectNodeForConnection sets the tree selection to the requested tree node', (done) => {
		let table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		serverTreeView.setup(x => x.expand(TypeMoq.It.is(treeNode => treeNode === connection))).returns(() => {
			return objectExplorerService.expandTreeNode(objectExplorerSession, objectExplorerService.getObjectExplorerNode(connection)).then(() => undefined);
		});
		serverTreeView.setup(x => x.select(TypeMoq.It.is(treeNode => treeNode.nodePath === table1NodePath))).returns(() => undefined);
		objectExplorerService.registerServerTreeView(serverTreeView.object);
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			// If I select the table node, then it should be selected and its parent should get expanded
			objectExplorerService.selectNodeForConnection(connection.id, table1NodePath).then(() => {
				try {
					serverTreeView.verify(x => x.expand(TypeMoq.It.is(treeNode => treeNode === connection)), TypeMoq.Times.once());
					serverTreeView.verify(x => x.select(TypeMoq.It.is(treeNode => treeNode.nodePath === table1NodePath)), TypeMoq.Times.once());
					done();
				} catch (err) {
					done(err);
				}
			}, err => done(err));
		}, err => done(err));
	});

	test('findNodeInfo returns node info for the relevant node', (done) => {
		let table1NodePath = objectExplorerExpandInfo.nodes[0].nodePath;
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.findNodeInfo(connection.id, table1NodePath).then(nodeInfo => {
				try {
					assert.equal(nodeInfo, objectExplorerExpandInfo.nodes[0]);
					done();
				} catch (err) {
					done(err);
				}
			}, err => done(err));
		});
	});

	test('findNodeInfo returns undefined if the requested node does not exist', (done) => {
		let invalidNodePath = objectExplorerSession.rootNode.nodePath + '/invalidNode';
		objectExplorerService.createNewSession('MSSQL', connection).then(result => {
			objectExplorerService.onSessionCreated(1, objectExplorerSession);
			objectExplorerService.findNodeInfo(connection.id, invalidNodePath).then(nodeInfo => {
				try {
					assert.equal(nodeInfo, undefined);
					done();
				} catch (err) {
					done(err);
				}
			}, err => done(err));
		});
	});
});