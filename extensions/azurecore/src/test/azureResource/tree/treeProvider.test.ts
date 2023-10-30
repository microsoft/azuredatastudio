/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import * as sinon from 'sinon';
import 'mocha';
import { AppContext } from '../../../appContext';

import { IAzureResourceCacheService } from '../../../azureResource/interfaces';
import { AzureResourceTreeProvider } from '../../../azureResource/tree/treeProvider';
import { AzureResourceAccountTreeNode } from '../../../azureResource/tree/accountTreeNode';
import { AzureResourceAccountNotSignedInTreeNode } from '../../../azureResource/tree/accountNotSignedInTreeNode';
import { AzureResourceServiceNames } from '../../../azureResource/constants';
import { generateGuid } from '../../../azureResource/utils';
import { AzureAccount, AzureAccountProperties } from 'azurecore';

// Mock services
let mockAppContext: AppContext;

let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let mockCacheService: TypeMoq.IMock<IAzureResourceCacheService>;

// Mock test data
const mockAccountMsal1: AzureAccount = {
	key: {
		accountId: 'mock_account_1',
		providerId: 'mock_provider'
	},
	displayInfo: {
		displayName: 'mock_account_1@test.com',
		accountType: 'Microsoft',
		contextualDisplayName: 'test',
		userId: 'test@email.com'
	},
	properties: TypeMoq.Mock.ofType<AzureAccountProperties>().object,
	isStale: false
};
const mockAccountMsal2: AzureAccount = {
	key: {
		accountId: 'mock_account_2',
		providerId: 'mock_provider'
	},
	displayInfo: {
		displayName: 'mock_account_2@test.com',
		accountType: 'Microsoft',
		contextualDisplayName: 'test',
		userId: 'test@email.com'
	},
	properties: TypeMoq.Mock.ofType<AzureAccountProperties>().object,
	isStale: false
};
const mockAccountsMSAL = [mockAccountMsal1, mockAccountMsal2];

describe('AzureResourceTreeProvider.getChildren', function (): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockCacheService = TypeMoq.Mock.ofType<IAzureResourceCacheService>();

		mockAppContext = new AppContext(mockExtensionContext.object);

		mockAppContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, mockCacheService.object);

		mockCacheService.setup((o) => o.generateKey(TypeMoq.It.isAnyString())).returns(() => generateGuid());
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should load accounts for MSAL', async function (): Promise<void> {
		const getAllAccountsStub = sinon.stub(azdata.accounts, 'getAllAccounts').returns(Promise.resolve(mockAccountsMSAL));

		const treeProvider = new AzureResourceTreeProvider(mockAppContext);

		await treeProvider.getChildren(undefined); // Load account promise
		const children = await treeProvider.getChildren(undefined); // Actual accounts

		should(getAllAccountsStub.calledOnce).be.true('getAllAccounts should have been called exactly once');
		should(children).Array();
		should(children.length).equal(mockAccountsMSAL.length);

		for (let ix = 0; ix < mockAccountsMSAL.length; ix++) {
			const child = children[ix];
			const account = mockAccountsMSAL[ix];

			should(child).instanceof(AzureResourceAccountTreeNode);
			should(child.nodePathValue).equal(`account_${account.key.accountId}`);
		}
	});

	it('Should handle when there is no accounts for MSAL', async function (): Promise<void> {
		sinon.stub(azdata.accounts, 'getAllAccounts').returns(Promise.resolve([]));

		const treeProvider = new AzureResourceTreeProvider(mockAppContext);
		treeProvider.isSystemInitialized = true;

		const children = await treeProvider.getChildren(undefined);

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceAccountNotSignedInTreeNode);
	});
});
