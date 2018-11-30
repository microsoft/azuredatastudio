/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { Emitter } from 'vs/base/common/event';
import { AccountDialog } from 'sql/parts/accountManagement/accountDialog/accountDialog';
import { AccountDialogController } from 'sql/parts/accountManagement/accountDialog/accountDialogController';
import { AccountViewModel } from 'sql/parts/accountManagement/accountDialog/accountViewModel';
import { AccountManagementTestService } from 'sqltest/stubs/accountManagementStubs';
import { ErrorMessageServiceStub } from 'sqltest/stubs/errorMessageServiceStub';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { AccountListRenderer } from 'sql/parts/accountManagement/common/accountListRenderer';
import { ContextKeyServiceStub } from 'sqltest/stubs/contextKeyServiceStub';

// TESTS ///////////////////////////////////////////////////////////////////
suite('Account Management Dialog Controller Tests', () => {
	test('Open Account Dialog - Dialog Doesn\'t Exist', () => {
		// Setup: Create instance of the controller
		let instantiationService = createInstantiationService();
		let controller = new AccountDialogController(instantiationService, undefined);
		assert.strictEqual(controller.accountDialog, undefined);

		// If: I open the account dialog when one hasn't been opened
		controller.openAccountDialog();

		// Then:
		// ... The account dialog should be defined
		assert.notStrictEqual(controller.accountDialog, undefined);
	});

	test('Open Account Dialog - Dialog Exists', () => {
		// Setup: Create instance of the controller with an account dialog already loaded
		let instantiationService = createInstantiationService();
		let controller = new AccountDialogController(instantiationService, undefined);
		controller.openAccountDialog();
		let accountDialog = controller.accountDialog;

		// If: I open the account dialog when one has already been opened
		controller.openAccountDialog();

		// Then: It should be the same dialog that already existed
		assert.equal(controller.accountDialog, accountDialog);
	});

	test('Add Account Failure - Error Message Shown', () => {
		// Setup:
		// ... Create instantiation service that returns mock emitter for account dialog
		let mockEventEmitter = new Emitter<string>();
		let instantiationService = createInstantiationService(mockEventEmitter);

		// ... Create a mock instance of the error message service
		let errorMessageServiceStub = new ErrorMessageServiceStub();
		let mockErrorMessageService = TypeMoq.Mock.ofInstance(errorMessageServiceStub);
		mockErrorMessageService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()));

		// ... Create instance of the controller with an opened dialog
		let controller = new AccountDialogController(instantiationService, mockErrorMessageService.object);
		controller.openAccountDialog();

		// If: The account dialog reports a failure adding an account
		mockEventEmitter.fire('Error message');

		// Then: An error dialog should have been opened
		mockErrorMessageService.verify(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});
});

function createInstantiationService(addAccountFailureEmitter?: Emitter<string>): InstantiationService {
	// Create a mock account dialog view model
	let accountViewModel = new AccountViewModel(new AccountManagementTestService());
	let mockAccountViewModel = TypeMoq.Mock.ofInstance(accountViewModel);
	let mockEvent = new Emitter<any>();
	mockAccountViewModel.setup(x => x.addProviderEvent).returns(() => mockEvent.event);
	mockAccountViewModel.setup(x => x.removeProviderEvent).returns(() => mockEvent.event);
	mockAccountViewModel.setup(x => x.updateAccountListEvent).returns(() => mockEvent.event);
	mockAccountViewModel.setup(x => x.initialize()).returns(() => Promise.resolve([]));

	// Create a mocked out instantiation service
	let instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Strict);
	instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(AccountViewModel)))
		.returns(() => mockAccountViewModel.object);
	instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(AccountListRenderer)))
		.returns(() => undefined);

	// Create a mock account dialog
	let accountDialog = new AccountDialog(null, null, instantiationService.object, null, null, null, null, new ContextKeyServiceStub(), null);
	let mockAccountDialog = TypeMoq.Mock.ofInstance(accountDialog);
	mockAccountDialog.setup(x => x.onAddAccountErrorEvent)
		.returns(() => { return addAccountFailureEmitter ? addAccountFailureEmitter.event : mockEvent.event; });
	mockAccountDialog.setup(x => x.onCloseEvent)
		.returns(() => mockEvent.event);
	mockAccountDialog.setup(x => x.render())
		.returns(() => undefined);
	mockAccountDialog.setup(x => x.open())
		.returns(() => undefined);
	instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(AccountDialog)))
		.returns(() => mockAccountDialog.object);

	return instantiationService.object;
}