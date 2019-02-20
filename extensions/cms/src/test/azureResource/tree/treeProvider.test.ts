/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as sqlops from 'sqlops';
import 'mocha';
import { AppContext } from '../../../appContext';
import { ApiWrapper } from '../../../apiWrapper';

import { AzureResourceTreeProvider } from '../../../cmsResource/tree/treeProvider';
import { AzureResourceAccountNotSignedInTreeNode } from '../../../cmsResource/tree/accountNotSignedInTreeNode';

// Mock services
let mockAppContext: AppContext;

let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;


describe('AzureResourceTreeProvider.getChildren', function(): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();


		mockAppContext = new AppContext(mockExtensionContext.object, mockApiWrapper.object);

	});

	it('Should load accounts.', async function(): Promise<void> {

		const treeProvider = new AzureResourceTreeProvider(mockAppContext);
		treeProvider.isSystemInitialized = true;

		const children = await treeProvider.getChildren(undefined);


		should(children).Array();
	});

	it('Should handle when there is no accounts.', async function(): Promise<void> {

		const treeProvider = new AzureResourceTreeProvider(mockAppContext);
		treeProvider.isSystemInitialized = true;

		const children = await treeProvider.getChildren(undefined);

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceAccountNotSignedInTreeNode);
	});

	it('Should handle errors.', async function(): Promise<void> {
		const mockAccountError = 'Test account error';


		const treeProvider = new AzureResourceTreeProvider(mockAppContext);
		treeProvider.isSystemInitialized = true;

		const children = await treeProvider.getChildren(undefined);



		should(children).Array();
		should(children.length).equal(1);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal(`Error: ${mockAccountError}`);
	});
});
