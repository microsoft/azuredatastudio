/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import { AppContext } from '../../../appContext';
import { CmsResourceTreeProvider } from '../../../cmsResource/tree/treeProvider';
import { CmsResourceMessageTreeNode } from '../../../cmsResource/messageTreeNode';
import { CmsResourceEmptyTreeNode } from '../../../cmsResource/tree/cmsResourceEmptyTreeNode';
import { CmsUtils } from '../../../cmsUtils';
import { sleep } from '../../utils';

// Mock services
let mockAppContext: AppContext;
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let mockCmsUtils: TypeMoq.IMock<CmsUtils>;

describe('CmsResourceTreeProvider.getChildren', function (): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockCmsUtils = TypeMoq.Mock.ofType<CmsUtils>();
		mockAppContext = new AppContext(mockExtensionContext.object, mockCmsUtils.object);
	});

	it('Should be loading while waiting for saved servers to load', async function (): Promise<void> {
		const treeProvider = new CmsResourceTreeProvider(mockAppContext);
		// We need to return at least one node so the async loading part is hit
		mockCmsUtils.setup(x => x.getSavedServers).returns(() => {
			return () => [{name: 'name',
				description: 'desc',
				ownerUri: 'uri',
				connection: undefined}];
		});
		// Set up so loading the servers doesn't return immediately - thus we'll still have the Loading node
		mockCmsUtils.setup(x => x.cacheRegisteredCmsServer).returns(() => {
			return async () => { await sleep(600000); return undefined; };
		});
		should.notEqual(treeProvider.isSystemInitialized, true, 'Expected isSystemInitialized not to be true');
		const children = await treeProvider.getChildren(undefined);
		should.equal(children.length, 1, 'Expected exactly one child node');
		should.equal(children[0].parent, undefined, 'Expected node to not have a parent');
		should.equal(children[0] instanceof CmsResourceMessageTreeNode, true, 'Expected node to be a CmsResourceMessageTreeNode');
	});

	it('Should be empty resource node when no servers to load', async function (): Promise<void> {
		const treeProvider = new CmsResourceTreeProvider(mockAppContext);
		should.notEqual(treeProvider.isSystemInitialized, true, 'Expected isSystemInitialized not to be true');
		const children = await treeProvider.getChildren(undefined);
		should.equal(children.length, 1, 'Expected exactly one child node');
		should.equal(children[0].parent, undefined, 'Expected node to not have a parent');
		should.equal(children[0] instanceof CmsResourceEmptyTreeNode, true, 'Expected node to be a CmsResourceEmptyTreeNode');
	});

	it('Should not be loading after initialized.', async function (): Promise<void> {
		const treeProvider = new CmsResourceTreeProvider(mockAppContext);
		treeProvider.isSystemInitialized = true;
		should.equal(true, treeProvider.isSystemInitialized, 'Expected isSystemInitialized to be true');
		mockCmsUtils.setup(x => x.registeredCmsServers).returns(() => []);
		const children = await treeProvider.getChildren(undefined);
		should.equal(children[0] instanceof CmsResourceEmptyTreeNode, true, 'Expected child node to be CmsResourceEmptyTreeNode');
	});

	it('Should show CMS nodes if there are cached servers', async function (): Promise<void> {
		const treeProvider = new CmsResourceTreeProvider(mockAppContext);
		treeProvider.isSystemInitialized = true;
		mockCmsUtils.setup(x => x.registeredCmsServers).returns(() => {
			return [{
				name: 'name',
				description: 'description',
				ownerUri: 'ownerUri',
				connection: null
			}];
		});
		const children = await treeProvider.getChildren(undefined);
		should.exist(children[0], 'Child node did not exist');
	});
});
