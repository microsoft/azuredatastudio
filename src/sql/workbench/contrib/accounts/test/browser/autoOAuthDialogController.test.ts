/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { Emitter } from 'vs/base/common/event';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';

import { AutoOAuthDialog } from 'sql/workbench/services/accountManagement/browser/autoOAuthDialog';
import { AutoOAuthDialogController } from 'sql/workbench/services/accountManagement/browser/autoOAuthDialogController';
import { TestAccountManagementService } from 'sql/platform/accounts/test/common/testAccountManagementService';
import { TestErrorMessageService } from 'sql/platform/errorMessage/test/common/testErrorMessageService';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';

// TESTS ///////////////////////////////////////////////////////////////////
suite('auto OAuth dialog controller tests', () => {
	let instantiationService: TypeMoq.Mock<InstantiationService>;
	let mockAutoOAuthDialog: TypeMoq.Mock<AutoOAuthDialog>;
	let mockAccountManagementService: TypeMoq.Mock<TestAccountManagementService>;
	let mockErrorMessageService: TypeMoq.Mock<TestErrorMessageService>;
	let autoOAuthDialogController: AutoOAuthDialogController;

	let mockOnCancelEvent: Emitter<void>;
	let mockOnAddAccountEvent: Emitter<void>;
	let mockOnCloseEvent: Emitter<void>;

	let providerId = 'azure';
	let title = 'Add Account';
	let message = 'This is the dialog description';
	let userCode = 'abcde';
	let uri = 'uri';

	setup(() => {
		mockOnCancelEvent = new Emitter<void>();
		mockOnAddAccountEvent = new Emitter<void>();
		mockOnCloseEvent = new Emitter<void>();

		// Create a mock auto OAuth dialog
		let autoOAuthDialog = new AutoOAuthDialog(undefined!, undefined!, undefined!, undefined!, new MockContextKeyService(), undefined!, undefined!, undefined!);
		mockAutoOAuthDialog = TypeMoq.Mock.ofInstance(autoOAuthDialog);

		mockAutoOAuthDialog.setup(x => x.onCancel).returns(() => mockOnCancelEvent.event);
		mockAutoOAuthDialog.setup(x => x.onHandleAddAccount).returns(() => mockOnAddAccountEvent.event);
		mockAutoOAuthDialog.setup(x => x.onCloseEvent).returns(() => mockOnCloseEvent.event);
		mockAutoOAuthDialog.setup(x => x.render());
		mockAutoOAuthDialog.setup(x => x.open(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()));
		mockAutoOAuthDialog.setup(x => x.close()).callback(() => {
			mockOnCloseEvent.fire();
		});

		// Create a mocked out instantiation service
		instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Strict);
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(AutoOAuthDialog)))
			.returns(() => mockAutoOAuthDialog.object);


		// Create a mocked account management service
		let accountManagementTestService = new TestAccountManagementService();
		mockAccountManagementService = TypeMoq.Mock.ofInstance(accountManagementTestService);
		mockAccountManagementService.setup(x => x.copyUserCodeAndOpenBrowser(TypeMoq.It.isAny(), TypeMoq.It.isAny()));

		// Create a mocked error message service
		let errorMessageServiceStub = new TestErrorMessageService();
		mockErrorMessageService = TypeMoq.Mock.ofInstance(errorMessageServiceStub);
		mockErrorMessageService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()));

		// Create a mocked auto OAuth dialog controller
		autoOAuthDialogController = new AutoOAuthDialogController(instantiationService.object, mockAccountManagementService.object, mockErrorMessageService.object);

	});

	test('Open auto OAuth when the flyout is already open, return an error', async () => {

		// If: Open auto OAuth dialog first time
		autoOAuthDialogController.openAutoOAuthDialog(providerId, title, message, userCode, uri);

		// Then: It should open the flyout successfully
		mockAutoOAuthDialog.verify(x => x.open(title, message, userCode, uri), TypeMoq.Times.once());
		mockErrorMessageService.verify(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());

		// If: a oauth flyout is already open
		await autoOAuthDialogController.openAutoOAuthDialog(providerId, title, message, userCode, uri)
			.then(success => assert.fail('Failure: Expected error on 2nd dialog open'), error => Promise.resolve());

		// Then: An error dialog should have been opened
		mockErrorMessageService.verify(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('Close auto OAuth dialog successfully', () => {
		let title = 'Add Account';
		let message = 'This is the dialog description';
		let userCode = 'abcde';
		let uri = 'uri';

		autoOAuthDialogController.openAutoOAuthDialog(providerId, title, message, userCode, uri);

		// If: closeAutoOAuthDialog is called
		autoOAuthDialogController.closeAutoOAuthDialog();

		// Then: it should close the dialog
		mockAutoOAuthDialog.verify(x => x.close(), TypeMoq.Times.once());
	});

	test('Open and close auto OAuth dialog multiple times should work properly', () => {
		let title = 'Add Account';
		let message = 'This is the dialog description';
		let userCode = 'abcde';
		let uri = 'uri';

		autoOAuthDialogController.openAutoOAuthDialog(providerId, title, message, userCode, uri);
		autoOAuthDialogController.closeAutoOAuthDialog();

		// If: Open the flyout second time
		autoOAuthDialogController.openAutoOAuthDialog(providerId, title, message, userCode, uri);

		// Then: It should open the flyout twice successfully
		mockAutoOAuthDialog.verify(x => x.open(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(2));
		mockErrorMessageService.verify(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
	});

	test('Copy and open button in auto OAuth dialog should work properly', () => {
		let title = 'Add Account';
		let message = 'This is the dialog description';
		let userCode = 'abcde';
		let uri = 'uri';

		autoOAuthDialogController.openAutoOAuthDialog(providerId, title, message, userCode, uri);

		// If: the 'copy & open' button in auto Oauth dialog is selected
		mockOnAddAccountEvent.fire();

		// Then: copyUserCodeAndOpenBrowser should get called
		mockAccountManagementService.verify(x => x.copyUserCodeAndOpenBrowser(userCode, uri), TypeMoq.Times.once());
	});

	// TODO: Test for cancel button

});
