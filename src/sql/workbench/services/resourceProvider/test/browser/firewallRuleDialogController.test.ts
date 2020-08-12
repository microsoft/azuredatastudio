/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import { Emitter } from 'vs/base/common/event';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { FirewallRuleDialog } from 'sql/workbench/services/resourceProvider/browser/firewallRuleDialog';
import { FirewallRuleViewModel } from 'sql/platform/accounts/common/firewallRuleViewModel';
import { FirewallRuleDialogController } from 'sql/workbench/services/resourceProvider/browser/firewallRuleDialogController';
import { TestAccountManagementService } from 'sql/platform/accounts/test/common/testAccountManagementService';
import { TestResourceProvider } from 'sql/workbench/services/resourceProvider/test/common/testResourceProviderService';
import { TestErrorMessageService } from 'sql/platform/errorMessage/test/common/testErrorMessageService';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { Deferred } from 'sql/base/common/promise';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';

// TESTS ///////////////////////////////////////////////////////////////////
suite('Firewall rule dialog controller tests', () => {
	let connectionProfile: IConnectionProfile;
	let account: azdata.Account;
	let IPAddress = '250.222.155.198';
	let mockOnAddAccountErrorEvent: Emitter<string>;
	let mockOnCreateFirewallRule: Emitter<void>;

	let instantiationService: TypeMoq.Mock<InstantiationService>;
	let mockFirewallRuleViewModel: TypeMoq.Mock<FirewallRuleViewModel>;
	let mockFirewallRuleDialog: TypeMoq.Mock<FirewallRuleDialog>;

	setup(() => {
		account = {
			key: { providerId: 'azure', accountId: 'account1' },
			displayInfo: {
				contextualDisplayName: 'Microsoft Account',
				accountType: 'microsoft',
				displayName: 'Account 1',
				userId: 'user@email.com'
			},
			properties: [],
			isStale: false
		};

		mockOnAddAccountErrorEvent = new Emitter<string>();
		mockOnCreateFirewallRule = new Emitter<void>();

		// Create a mock firewall rule view model
		let firewallRuleViewModel = new FirewallRuleViewModel();
		mockFirewallRuleViewModel = TypeMoq.Mock.ofInstance(firewallRuleViewModel);
		mockFirewallRuleViewModel.setup(x => x.updateDefaultValues(TypeMoq.It.isAny()))
			.returns((ipAddress) => undefined);
		mockFirewallRuleViewModel.object.selectedAccount = account;
		mockFirewallRuleViewModel.object.selectedTenantId = 'tenantId';
		mockFirewallRuleViewModel.object.isIPAddressSelected = true;

		// Create a mocked out instantiation service
		instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Strict);
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(FirewallRuleViewModel)))
			.returns(() => mockFirewallRuleViewModel.object);

		// Create a mock account picker
		let firewallRuleDialog = new FirewallRuleDialog(undefined!, undefined!, undefined!, instantiationService.object, undefined!, undefined!, new MockContextKeyService(), undefined!, undefined!, undefined!, undefined!);
		mockFirewallRuleDialog = TypeMoq.Mock.ofInstance(firewallRuleDialog);

		let mockEvent = new Emitter<any>();
		mockFirewallRuleDialog.setup(x => x.onCancel)
			.returns(() => mockEvent.event);
		mockFirewallRuleDialog.setup(x => x.onCreateFirewallRule)
			.returns(() => mockOnCreateFirewallRule.event);
		mockFirewallRuleDialog.setup(x => x.onAddAccountErrorEvent)
			.returns((msg) => mockOnAddAccountErrorEvent.event);
		mockFirewallRuleDialog.setup(x => x.render());
		mockFirewallRuleDialog.setup(x => x.open());
		mockFirewallRuleDialog.setup(x => x.close());

		instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(FirewallRuleDialog)))
			.returns(() => mockFirewallRuleDialog.object);

		connectionProfile = {
			connectionName: 'new name',
			serverName: 'new server',
			databaseName: 'database',
			userName: 'user',
			password: 'password',
			authenticationType: '',
			savePassword: true,
			groupFullName: 'g2/g2-2',
			groupId: 'group id',
			getOptionsKey: () => '',
			matches: () => false,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: '',
			azureTenantId: 'someTenant'
		};
	});

	test('Add Account Failure - Error Message Shown', () => {
		// ... Create a mock instance of the error message service
		let errorMessageServiceStub = new TestErrorMessageService();
		let mockErrorMessageService = TypeMoq.Mock.ofInstance(errorMessageServiceStub);
		mockErrorMessageService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()));

		// ... Create instance of the controller with an opened dialog
		let controller = new FirewallRuleDialogController(instantiationService.object, undefined!, undefined!, mockErrorMessageService.object);
		controller.openFirewallRuleDialog(connectionProfile, IPAddress, 'resourceID');

		// If: The firewall rule dialog reports a failure

		mockOnAddAccountErrorEvent.fire('Error message');

		// Then: An error dialog should have been opened
		mockErrorMessageService.verify(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('create firewall rule success', async () => {
		let deferredPromise = new Deferred();

		mockFirewallRuleDialog.setup(x => x.onServiceComplete())
			.callback(() => {
				deferredPromise.resolve(true);
			});

		// ... Create a mock instance of the account management test service
		let mockAccountManagementService = getMockAccountManagementService(true);

		// ... Create a mock instance of the resource provider
		let mockResourceProvider = getMockResourceProvider(true, { result: true, errorMessage: '' });

		// ... Create instance of the controller with an opened dialog
		let controller = new FirewallRuleDialogController(instantiationService.object, mockResourceProvider.object, mockAccountManagementService.object, undefined!);
		controller.openFirewallRuleDialog(connectionProfile, IPAddress, 'resourceID');

		// If: The firewall rule dialog's create firewall rule get fired
		mockOnCreateFirewallRule.fire();

		// Then: it should get security token from account management service and call create firewall rule in resource provider
		await deferredPromise;
		mockAccountManagementService.verify(x => x.getAccountSecurityToken(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockResourceProvider.verify(x => x.createFirewallRule(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockFirewallRuleDialog.verify(x => x.close(), TypeMoq.Times.once());
		mockFirewallRuleDialog.verify(x => x.onServiceComplete(), TypeMoq.Times.once());
	});

	test('create firewall rule fails during getSecurity', async () => {
		let deferredPromise = new Deferred<{}>();

		// ... Create a mock instance of the error message service
		let mockErrorMessageService = getMockErrorMessageService(deferredPromise);

		// ... Create a mock instance of the account management test service
		let mockAccountManagementService = getMockAccountManagementService(false);

		// ... Create a mock instance of the resource provider
		let mockResourceProvider = getMockResourceProvider(true, { result: true, errorMessage: '' });

		// ... Create instance of the controller with an opened dialog
		let controller = new FirewallRuleDialogController(instantiationService.object, mockResourceProvider.object, mockAccountManagementService.object, mockErrorMessageService.object);
		controller.openFirewallRuleDialog(connectionProfile, IPAddress, 'resourceID');

		// If: The firewall rule dialog's create firewall rule get fired
		mockOnCreateFirewallRule.fire();

		// Then: it should get security token from account management service and an error dialog should have been opened
		await deferredPromise;
		mockAccountManagementService.verify(x => x.getAccountSecurityToken(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockErrorMessageService.verify(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockResourceProvider.verify(x => x.createFirewallRule(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
	});

	test('create firewall rule fails during createFirewallRule in ResourceProvider - result is false', async () => {
		let deferredPromise = new Deferred<{}>();

		// ... Create a mock instance of the error message service
		let mockErrorMessageService = getMockErrorMessageService(deferredPromise);

		// ... Create a mock instance of the account management test service
		let mockAccountManagementService = getMockAccountManagementService(true);

		// ... Create a mock instance of the resource provider
		let mockResourceProvider = getMockResourceProvider(true, { result: false, errorMessage: '' });

		// ... Create instance of the controller with an opened dialog
		let controller = new FirewallRuleDialogController(instantiationService.object, mockResourceProvider.object, mockAccountManagementService.object, mockErrorMessageService.object);
		controller.openFirewallRuleDialog(connectionProfile, IPAddress, 'resourceID');

		// If: The firewall rule dialog's create firewall rule get fired
		mockOnCreateFirewallRule.fire();

		// Then: it should get security token from account management service and an error dialog should have been opened
		await deferredPromise;

		mockAccountManagementService.verify(x => x.getAccountSecurityToken(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockResourceProvider.verify(x => x.createFirewallRule(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockErrorMessageService.verify(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('create firewall rule fails during createFirewallRule in ResourceProvider - reject promise', async () => {
		let deferredPromise = new Deferred<{}>();

		// ... Create a mock instance of the error message service
		let mockErrorMessageService = getMockErrorMessageService(deferredPromise);

		// ... Create a mock instance of the account management test service
		let mockAccountManagementService = getMockAccountManagementService(true);

		// ... Create a mock instance of the resource provider
		let mockResourceProvider = getMockResourceProvider(false);

		// ... Create instance of the controller with an opened dialog
		let controller = new FirewallRuleDialogController(instantiationService.object, mockResourceProvider.object, mockAccountManagementService.object, mockErrorMessageService.object);
		controller.openFirewallRuleDialog(connectionProfile, IPAddress, 'resourceID');

		// If: The firewall rule dialog's create firewall rule get fired
		mockOnCreateFirewallRule.fire();

		// Then: it should get security token from account management service and an error dialog should have been opened
		await deferredPromise;
		mockAccountManagementService.verify(x => x.getAccountSecurityToken(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockResourceProvider.verify(x => x.createFirewallRule(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockErrorMessageService.verify(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});
});

function getMockAccountManagementService(resolveSecurityToken: boolean): TypeMoq.Mock<TestAccountManagementService> {
	let accountManagementTestService = new TestAccountManagementService();
	let mockAccountManagementService = TypeMoq.Mock.ofInstance(accountManagementTestService);
	mockAccountManagementService.setup(x => x.getAccountSecurityToken(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
		.returns(() => resolveSecurityToken ? Promise.resolve({ token: 'token' }) : Promise.reject(null));
	return mockAccountManagementService;
}

function getMockResourceProvider(resolveCreateFirewallRule: boolean, response?: azdata.CreateFirewallRuleResponse): TypeMoq.Mock<TestResourceProvider> {
	let resourceProviderStub = new TestResourceProvider();
	let mockResourceProvider = TypeMoq.Mock.ofInstance(resourceProviderStub);
	mockResourceProvider.setup(x => x.createFirewallRule(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
		.returns(() => resolveCreateFirewallRule ? Promise.resolve(response) : Promise.reject(null));
	return mockResourceProvider;
}

function getMockErrorMessageService(deferredPromise: Deferred<{}>): TypeMoq.Mock<TestErrorMessageService> {
	let errorMessageServiceStub = new TestErrorMessageService();
	let mockErrorMessageService = TypeMoq.Mock.ofInstance(errorMessageServiceStub);
	mockErrorMessageService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).callback(() => {
		deferredPromise.resolve(true);
	});
	return mockErrorMessageService;
}
