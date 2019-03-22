/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import 'mocha';
import { AppContext } from '../../../appContext';
import { ApiWrapper } from '../../../apiWrapper';

import { CmsResourceTreeProvider } from '../../../cmsResource/tree/treeProvider';
import { CmsResourceMessageTreeNode } from '../../../cmsResource/messageTreeNode';
import { CmsResourceTreeNode } from '../../../cmsResource/tree/cmsResourceTreeNode';

// Mock services
let mockAppContext: AppContext;
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;


describe('CmsResourceTreeProvider.getChildren', function(): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();
		mockAppContext = new AppContext(mockExtensionContext.object, mockApiWrapper.object);

	});

	it('Should not be initialized.', async function(): Promise<void> {

		const treeProvider = new CmsResourceTreeProvider(mockAppContext);
		should.notEqual(treeProvider.isSystemInitialized , true);
		const children = await treeProvider.getChildren(undefined);
		should.equal(children.length, 1);
		should.equal(children[0].parent, undefined);
		should.equal(children[0] instanceof CmsResourceMessageTreeNode, true);
	});

	it('Should not be loading after initialized.'), async function (): Promise<void> {

		const treeProvider = new CmsResourceTreeProvider(mockAppContext);
		treeProvider.isSystemInitialized = true;
		should.equal(true, treeProvider.isSystemInitialized);
		const children = await treeProvider.getChildren(undefined);
		should.notEqual(children[0] instanceof CmsResourceMessageTreeNode, false);
	};

	it('Should show an empty node if no CMS Servers exist'), async function (): Promise<void> {
		const treeProvider = new CmsResourceTreeProvider(mockAppContext);
		treeProvider.isSystemInitialized = true;
		mockApiWrapper.setup(x => x.registeredCmsServers).returns(() => TypeMoq.It.isAny());
		const children = await treeProvider.getChildren(undefined);
		should.notEqual(children[0] instanceof CmsResourceMessageTreeNode, false);
		should.equal(children[0] instanceof CmsResourceTreeNode, true);
	};
});
