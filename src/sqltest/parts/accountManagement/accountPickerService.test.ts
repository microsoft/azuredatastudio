/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { EventVerifierSingle } from 'sqltest/utils/eventVerifier';
import { Emitter } from 'vs/base/common/event';
import { AccountPicker } from 'sql/platform/accountManagement/browser/accountPicker';
import { AccountPickerService } from 'sql/platform/accountManagement/browser/accountPickerService';
import { AccountPickerViewModel } from 'sql/platform/accountManagement/common/accountPickerViewModel';
import { AccountManagementTestService } from 'sqltest/stubs/accountManagementStubs';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';

// SUITE STATE /////////////////////////////////////////////////////////////
let mockAddAccountCompleteEmitter: Emitter<void>;
let mockAddAccountErrorEmitter: Emitter<string>;
let mockAddAccountStartEmitter: Emitter<void>;
let mockOnAccountSelectionChangeEvent: Emitter<sqlops.Account>;

// TESTS ///////////////////////////////////////////////////////////////////
suite('Account picker service tests', () => {
	setup(() => {
		// Setup event mocks for the account picker service
		mockAddAccountCompleteEmitter = new Emitter<void>();
		mockAddAccountErrorEmitter = new Emitter<string>();
		mockAddAccountStartEmitter = new Emitter<void>();
		mockOnAccountSelectionChangeEvent = new Emitter<sqlops.Account>();
	});

	test('Construction - Events are properly defined', () => {
		// Setup:
		// ... Create instantiation service
		let instantiationService = createInstantiationService();

		// ... Create instance of the service and reder account picker
		let service = new AccountPickerService(instantiationService);
		service.renderAccountPicker(TypeMoq.It.isAny());

		// Then:
		// ... All the events for the view models should be properly initialized
		assert.notEqual(service.addAccountCompleteEvent, undefined);
		assert.notEqual(service.addAccountErrorEvent, undefined);
		assert.notEqual(service.addAccountStartEvent, undefined);
		assert.notEqual(service.onAccountSelectionChangeEvent, undefined);


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
				displayName: 'Account 1'
			},
			properties: [],
			isStale: false
		};
		let evOnAccountSelectionChangeEvent = new EventVerifierSingle<sqlops.Account>();
		service.onAccountSelectionChangeEvent(evOnAccountSelectionChangeEvent.eventHandler);
		mockOnAccountSelectionChangeEvent.fire(account);
		evOnAccountSelectionChangeEvent.assertFired(account);
	});

});

function createInstantiationService(): InstantiationService {
	// Create a mock account picker view model
	let providerId = 'azure';
	let accountPickerViewModel = new AccountPickerViewModel(providerId, new AccountManagementTestService());
	let mockAccountViewModel = TypeMoq.Mock.ofInstance(accountPickerViewModel);
	let mockEvent = new Emitter<any>();
	mockAccountViewModel.setup(x => x.updateAccountListEvent).returns(() => mockEvent.event);

	// Create a mocked out instantiation service
	let instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Strict);
	instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(AccountPickerViewModel), TypeMoq.It.isAny()))
		.returns(() => mockAccountViewModel.object);

	// Create a mock account picker
	let accountPicker = new AccountPicker(null, null, instantiationService.object, null);
	let mockAccountDialog = TypeMoq.Mock.ofInstance(accountPicker);

	mockAccountDialog.setup(x => x.addAccountCompleteEvent)
		.returns(() => mockAddAccountCompleteEmitter.event);
	mockAccountDialog.setup(x => x.addAccountErrorEvent)
		.returns((msg) => mockAddAccountErrorEmitter.event);
	mockAccountDialog.setup(x => x.addAccountStartEvent)
		.returns(() => mockAddAccountStartEmitter.event);
	mockAccountDialog.setup(x => x.onAccountSelectionChangeEvent)
		.returns((account) => mockOnAccountSelectionChangeEvent.event);
	mockAccountDialog.setup(x => x.render(TypeMoq.It.isAny()))
		.returns((container) => undefined);
	mockAccountDialog.setup(x => x.createAccountPickerComponent());

	instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(AccountPicker), TypeMoq.It.isAny()))
		.returns(() => mockAccountDialog.object);

	return instantiationService.object;
}