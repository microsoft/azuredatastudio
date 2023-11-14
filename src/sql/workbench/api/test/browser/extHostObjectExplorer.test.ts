/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as assert from 'assert';
import * as TypeMoq from 'typemoq';

import { MainThreadObjectExplorerShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { ExtHostObjectExplorerNode } from 'sql/workbench/api/common/extHostObjectExplorer';

const nodes: { [nodeName: string]: azdata.NodeInfo } =
{
	'Server1': {
		nodePath: 'MyServer',
		parentNodePath: '',
		nodeStatus: '',
		nodeSubType: '',
		nodeType: 'Server',
		isLeaf: false,
		label: 'MyServer',
		metadata: undefined,
		errorMessage: ''
	},
	'DatabasesFolder': {
		nodePath: 'MyServer/Databases',
		parentNodePath: 'MyServer',
		nodeStatus: '',
		nodeSubType: '',
		nodeType: 'Folder',
		isLeaf: false,
		label: 'Databases',
		metadata: undefined,
		errorMessage: ''
	},
	'Database1': {
		nodePath: 'MyServer/Databases/MyDatabase',
		parentNodePath: 'MyServer/Databases',
		nodeStatus: '',
		nodeSubType: '',
		nodeType: 'Database',
		isLeaf: false,
		label: 'MyDatabase',
		metadata: undefined,
		errorMessage: ''
	},
	'Database2': {
		nodePath: 'MyServer/Databases/My/TrickyDatabase',
		parentNodePath: 'MyServer/Databases',
		nodeStatus: '',
		nodeSubType: '',
		nodeType: 'Database',
		isLeaf: false,
		label: 'My/TrickyDatabase',
		metadata: undefined,
		errorMessage: ''
	},
	'TablesFolder': {
		nodePath: 'MyServer/Databases/My/TrickyDatabase/Tables',
		parentNodePath: 'MyServer/Databases/My/TrickyDatabase',
		nodeStatus: '',
		nodeSubType: '',
		nodeType: 'Folder',
		isLeaf: false,
		label: 'Tables',
		metadata: undefined,
		errorMessage: ''
	}
};

suite('ExtHostObjectExplorer Tests', () => {
	let mockProxy: TypeMoq.Mock<MainThreadObjectExplorerShape>;
	suiteSetup(() => {
		mockProxy = TypeMoq.Mock.ofInstance(<MainThreadObjectExplorerShape>{
			$getNode: (connectionId: string, nodePath?: string): Thenable<azdata.NodeInfo> => undefined
		});

		mockProxy.setup(p =>
			p.$getNode(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns((connectionId, nodePath) => {
				return Promise.resolve<azdata.NodeInfo>(nodes[Object.keys(nodes).find(key =>
					nodes[key].nodePath === nodePath)]);
			});
	});

	suite('ExtHostObjectExplorerNode', () => {
		let extHostObjectExplorerNode: ExtHostObjectExplorerNode;
		suite('getParent', () => {
			test('Should return undefined if no parent', async () => {
				extHostObjectExplorerNode = new ExtHostObjectExplorerNode(nodes['Server1'], 'connectionId', mockProxy.object);
				assert.strictEqual(await extHostObjectExplorerNode.getParent(), undefined);
			});

			test('should return root with direct descendent of root', async () => {
				extHostObjectExplorerNode = new ExtHostObjectExplorerNode(nodes['DatabasesFolder'], 'connectionId', mockProxy.object);
				assert.strictEqual((await extHostObjectExplorerNode.getParent()).nodePath, nodes['Server1'].nodePath);
			});

			test('should return correct parent with further descendent of root', async () => {
				extHostObjectExplorerNode = new ExtHostObjectExplorerNode(nodes['Database1'], 'connectionId', mockProxy.object);
				assert.strictEqual((await extHostObjectExplorerNode.getParent()).nodePath, nodes['DatabasesFolder'].nodePath);
			});

			test('should return correct parent with node having / in its name', async () => {
				extHostObjectExplorerNode = new ExtHostObjectExplorerNode(nodes['Database2'], 'connectionId', mockProxy.object);
				assert.strictEqual((await extHostObjectExplorerNode.getParent()).nodePath, nodes['DatabasesFolder'].nodePath);
			});

			test('should return correct parent with parent node having / in its name', async () => {
				extHostObjectExplorerNode = new ExtHostObjectExplorerNode(nodes['TablesFolder'], 'connectionId', mockProxy.object);
				assert.strictEqual((await extHostObjectExplorerNode.getParent()).nodePath, nodes['Database2'].nodePath);
			});
		});
	});
});
