/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { EventVerifierSingle } from 'sql/base/test/common/event';
import { Emitter } from 'vs/base/common/event';
import { AccountPicker } from 'sql/workbench/services/accountManagement/browser/accountPickerImpl';
import { AccountPickerViewModel } from 'sql/platform/accounts/common/accountPickerViewModel';
import { TestAccountManagementService } from 'sql/platform/accounts/test/common/testAccountManagementService';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { AccountPickerService } from 'sql/workbench/services/accountManagement/browser/accountPickerService';
import { NullLogService } from 'vs/platform/log/common/log';

// SUITE STATE /////////////////////////////////////////////////////////////
let mockAddAccountCompleteEmitter: Emitter<void>;
let mockAddAccountErrorEmitter: Emitter<string>;
let mockAddAccountStartEmitter: Emitter<void>;
let mockOnAccountSelectionChangeEvent: Emitter<azdata.Account>;
let mockOnTenantSelectionChangeEvent: Emitter<string>;

// TESTS ///////////////////////////////////////////////////////////////////
suite('Account picker service tests', () => {
	setup(() => {
		// Setup event mocks for the account picker service
		mockAddAccountCompleteEmitter = new Emitter<void>();
		mockAddAccountErrorEmitter = new Emitter<string>();
		mockAddAccountStartEmitter = new Emitter<void>();
		mockOnAccountSelectionChangeEvent = new Emitter<azdata.Account>();
		mockOnTenantSelectionChangeEvent = new Emitter<string>();
	});

	test('Construction - Events are properly defined', () => {
		// Setup:
		// ... Create instantiation service
		let instantiationService = createInstantiationService();
		let logService = new NullLogService();

		// ... Create instance of the service and render account picker
		let service = new AccountPickerService(instantiationService, logService);
		service.renderAccountPicker(TypeMoq.It.isAny());

		// Then:
		// ... All the events for the view models should be properly initialized
		assert.notStrictEqual(service.addAccountCompleteEvent, undefined);
		assert.notStrictEqual(service.addAccountErrorEvent, undefined);
		assert.notStrictEqual(service.addAccountStartEvent, undefined);
		assert.notStrictEqual(service.onAccountSelectionChangeEvent, undefined);


		// ... All the events should properly fire
		let evAddAccountCompleteEvent = new EventVerifierSingle<void>();
		service.addAccountCompleteEvent(evAddAccountCompleteEvent.eventHandler);
		mockAddAccountCompleteEmitter.fire();
		evAddAccountCompleteEvent.assertFired();

		let errorMsg = 'Error';
		let evAddAccountErrorEvent = new EventVerifierSingle<string>();
		service.addAccountErrorEvent(evAddAccountErrorEvent.eventHandler);
		mockAddAccountErrorEmitter.fire(errorMsg);
		evAddAccountErrorEvent.assertFired(errorMsg);

		let evAddAccountStartEvent = new EventVerifierSingle<void>();
		service.addAccountStartEvent(evAddAccountStartEvent.eventHandler);
		mockAddAccountStartEmitter.fire();
		evAddAccountStartEvent.assertFired();

		let account = {
			key: { providerId: 'azure', accountId: 'account1' },
			name: 'Account 1',
			displayInfo: {
				contextualDisplayName: 'Microsoft Account',
				accountType: 'microsoft',
				displayName: 'Account 1',
				userId: 'user@email.com'
			},
			properties: [],
			isStale: false
		};
		let evOnAccountSelectionChangeEvent = new EventVerifierSingle<azdata.Account | undefined>();
		service.onAccountSelectionChangeEvent(evOnAccountSelectionChangeEvent.eventHandler);
		mockOnAccountSelectionChangeEvent.fire(account);
		evOnAccountSelectionChangeEvent.assertFired(account);
	});

});

function createInstantiationService(): InstantiationService {
	// Create a mock account picker view model
	let accountPickerViewModel = new AccountPickerViewModel(new TestAccountManagementService());
	let mockAccountViewModel = TypeMoq.Mock.ofInstance(accountPickerViewModel);
	let mockEvent = new Emitter<any>();
	mockAccountViewModel.setup(x => x.updateAccountListEvent).returns(() => mockEvent.event);

	// Create a mocked out instantiation service
	let instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Strict);
	instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(AccountPickerViewModel)))
		.returns(() => mockAccountViewModel.object);

	// Create a mock account picker

	let accountPicker = new AccountPicker(new TestThemeService(), instantiationService.object, undefined!);
	let mockAccountDialog = TypeMoq.Mock.ofInstance(accountPicker);

	mockAccountDialog.setup(x => x.addAccountCompleteEvent)
		.returns(() => mockAddAccountCompleteEmitter.event);
	mockAccountDialog.setup(x => x.addAccountErrorEvent)
		.returns((msg) => mockAddAccountErrorEmitter.event);
	mockAccountDialog.setup(x => x.addAccountStartEvent)
		.returns(() => mockAddAccountStartEmitter.event);
	mockAccountDialog.setup(x => x.onAccountSelectionChangeEvent)
		.returns((account) => mockOnAccountSelectionChangeEvent.event);
	mockAccountDialog.setup(x => x.onTenantSelectionChangeEvent)
		.returns((tenant) => mockOnTenantSelectionChangeEvent.event);
	mockAccountDialog.setup(x => x.render(TypeMoq.It.isAny()))
		.returns((container) => undefined);
	mockAccountDialog.setup(x => x.createAccountPickerComponent());

	instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(AccountPicker)))
		.returns(() => mockAccountDialog.object);

	return instantiationService.object;
}
