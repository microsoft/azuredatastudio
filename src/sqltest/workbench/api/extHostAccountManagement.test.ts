/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import * as sqlops from 'sqlops';
import * as TypeMoq from 'typemoq';
import { AccountProviderStub, AccountManagementTestService } from 'sqltest/stubs/accountManagementStubs';
import { ExtHostAccountManagement } from 'sql/workbench/api/node/extHostAccountManagement';
import { TestThreadService } from 'vs/workbench/test/electron-browser/api/testThreadService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IThreadService } from 'vs/workbench/services/thread/common/threadService';
import { SqlMainContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { MainThreadAccountManagement } from 'sql/workbench/api/node/mainThreadAccountManagement';
import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

const IThreadService = createDecorator<IThreadService>('threadService');

// SUITE STATE /////////////////////////////////////////////////////////////
let instantiationService: TestInstantiationService;
let mockAccountMetadata: sqlops.AccountProviderMetadata;
let mockAccount: sqlops.Account;
let threadService: TestThreadService;

// TESTS ///////////////////////////////////////////////////////////////////
suite('ExtHostAccountManagement', () => {
	suiteSetup(() => {
		threadService = new TestThreadService();
		const accountMgmtStub = new AccountManagementTestService();

		instantiationService = new TestInstantiationService();
		instantiationService.stub(IThreadService, threadService);
		instantiationService.stub(IAccountManagementService, accountMgmtStub);

		const accountMgmtService = instantiationService.createInstance(MainThreadAccountManagement);
		threadService.setTestInstance(SqlMainContext.MainThreadAccountManagement, accountMgmtService);

		mockAccountMetadata = {
			args: {},
			displayName: 'Test Account Provider',
			id: 'test_account_provider',
			settings: {}
		};
		mockAccount = {
			key: {
				providerId: mockAccountMetadata.id,
				providerArgs: {},
				accountId: 'test_account'
			},
			properties: {},
			displayInfo: {
				displayName: 'Test Account',
				contextualDisplayName: 'Test Kind Of Account',
				accountType: 'test'
			},
			isStale: false
		};
	});

	test('Constructor', () => {
		// If: I construct a new extension host account management
		let extHost = new ExtHostAccountManagement(threadService);

		// Then: There shouldn't be any account providers registered
		assert.equal(extHost.getProviderCount(), 0);
	});

	// REGISTER TESTS //////////////////////////////////////////////////////
	test('Register Account Provider - Success', () => {
		// Setup: Create an extension host account management
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();

		// If: I register a mock account provider
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// Then: The account provider should be registered
		assert.equal(extHost.getProviderCount(), 1);
	});

	test('Register Account Provider - Account Provider Already Registered', () => {
		// Setup: Create an extension host account management and register an account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I register an account provider again
		// Then
		// ... It should throw
		assert.throws(() => {
			extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);
		});

		// ... There should only be one account provider
		assert.equal(extHost.getProviderCount(), 1);
	});

	// TODO: Test for unregistering a provider

	// CLEAR TESTS /////////////////////////////////////////////////////////
	test('Clear - Success', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I clear an account
		extHost.$clear(0, mockAccount.key)
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.clear(TypeMoq.It.isValue(mockAccount.key)),
					TypeMoq.Times.once()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	test('Clear - Handle does not exist', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I clear an account for a handle that doesn't exist
		// Then: It should fail
		extHost.$clear(1, mockAccount.key)
			.then(() => done('Clear succeeded when it should have failed'))
			.then(null, () => {
				// The provider's clear should not have been called
				mockProvider.verify(
					(obj) => obj.clear(TypeMoq.It.isAny()),
					TypeMoq.Times.never()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	// INITIALIZE TESTS ////////////////////////////////////////////////////
	test('Initialize - Success', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I initialize the provider
		extHost.$initialize(0, [mockAccount])
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.initialize(TypeMoq.It.isValue([mockAccount])),
					TypeMoq.Times.once()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	test('Initialize - Handle does not exist', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I initialize for a handle that doesn't exist
		// Then: It should fail
		extHost.$initialize(1, [mockAccount])
			.then(() => done('Initialize succeeded when it should have failed'))
			.then(null, () => {
				// The provider's clear should not have been called
				mockProvider.verify(
					(obj) => obj.initialize(TypeMoq.It.isAny()),
					TypeMoq.Times.never()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	// PROMPT TESTS ////////////////////////////////////////////////////////
	test('Prompt - Success', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I prompt for an account
		extHost.$prompt(0)
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.prompt(),
					TypeMoq.Times.once()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	test('Prompt - Handle does not exist', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I prompt with a handle that doesn't exist
		// Then: It should fail
		extHost.$prompt(1)
			.then(() => done('Prompt succeeded when it should have failed'))
			.then(null, () => {
				// The provider's clear should not have been called
				mockProvider.verify(
					(obj) => obj.prompt(),
					TypeMoq.Times.never()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	// REFRESH TESTS ///////////////////////////////////////////////////////
	test('Refresh - Success', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I refresh an account
		extHost.$refresh(0, mockAccount)
			.then(() => {
				// Then: The call should have been passed to the provider
				mockProvider.verify(
					(obj) => obj.refresh(TypeMoq.It.isValue(mockAccount)),
					TypeMoq.Times.once()
				);
			})
			.then(() => done(), (err) => done(err));
	});

	test('Refresh - Handle does not exist', (done) => {
		// Setup: Create ext host account management with registered account provider
		let extHost = new ExtHostAccountManagement(threadService);
		let mockProvider = getMockAccountProvider();
		extHost.$registerAccountProvider(mockAccountMetadata, mockProvider.object);

		// If: I refresh an account for a handle that doesn't exist
		// Then: It should fail
		extHost.$refresh(1, mockAccount)
			.then(() => done('Refresh succeeded when it should have failed'))
			.then(null, () => {
				// The provider's clear should not have been called
				mockProvider.verify(
					(obj) => obj.refresh(TypeMoq.It.isAny()),
					TypeMoq.Times.never()
				);
			})
			.then(() => done(), (err) => done(err));
	});
});

function getMockAccountProvider(): TypeMoq.Mock<sqlops.AccountProvider> {
	let mock = TypeMoq.Mock.ofType<sqlops.AccountProvider>(AccountProviderStub);
	mock.setup((obj) => obj.clear(TypeMoq.It.isValue(mockAccount.key)))
		.returns(() => Promise.resolve(undefined));
	mock.setup((obj) => obj.refresh(TypeMoq.It.isValue(mockAccount)))
		.returns(() => Promise.resolve(undefined));
	mock.setup((obj) => obj.initialize(TypeMoq.It.isValue([mockAccount])))
		.returns(() => Promise.resolve(undefined));
	mock.setup((obj) => obj.prompt())
		.returns(() => Promise.resolve(undefined));

	return mock;
}
