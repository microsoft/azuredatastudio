/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import * as sqlops from 'sqlops';
import * as TypeMoq from 'typemoq';
import { AddAccountAction, RemoveAccountAction } from 'sql/parts/accountManagement/common/accountActions';
import { AccountManagementTestService } from 'sqltest/stubs/accountManagementStubs';
import { MessageServiceStub } from 'sqltest/stubs/messageServiceStub';
import { ErrorMessageServiceStub } from 'sqltest/stubs/errorMessageServiceStub';

let testAccount = <sqlops.Account>{
	key: {
		providerId: 'azure',
		accountId: 'testAccount'
	},
	displayInfo: {
		accountType: 'test',
		displayName: 'Test Account',
		contextualDisplayName: 'Azure Account'
	},
	isStale: false
};

suite('Account Management Dialog Actions Tests', () => {
	test('AddAccount - Success', (done) => {
		done();
		// // Setup: Create an AddAccountAction object
		// let param = 'azure';
		// let mocks = createAddAccountAction(true, true, param);

		// // If: I run the action when it will resolve
		// mocks.action.run()
		// 	.then(result => {
		// 		// Then:
		// 		// ... I should have gotten true back
		// 		assert.ok(result);

		// 		// ... The account management service should have gotten a add account request
		// 		mocks.accountMock.verify(x => x.addAccount(param), TypeMoq.Times.once());
		// 	})
		// 	.then(
		// 	() => done(),
		// 	err => done(err)
		// 	);
	});

	// test('AddAccount - Failure', (done) => {
	// 	// // Setup: Create an AddAccountAction object
	// 	// let param = 'azure';
	// 	// let mocks = createAddAccountAction(false, true, param);

	// 	// // If: I run the action when it will reject
	// 	// mocks.action.run().then(result => {
	// 	// 	// Then:
	// 	// 	// ... The result should be false since the operation failed
	// 	// 	assert.ok(!result);
	// 	// 	// ... The account management service should have gotten a add account request
	// 	// 	mocks.accountMock.verify(x => x.addAccount(param), TypeMoq.Times.once());
	// 	// 	done();
	// 	// }, error => {
	// 	// 	// Should fail as rejected actions cause the debugger to crash
	// 	// 	done(error);
	// 	// });
	// });

	// test('RemoveAccount - Confirm Success', (done) => {
	// 	// // Setup: Create an AddAccountAction object
	// 	// let ams = getMockAccountManagementService(true);
	// 	// let ms = getMockMessageService(true);
	// 	// let es = getMockErrorMessageService();
	// 	// let action = new RemoveAccountAction(testAccount, ms.object, es.object, ams.object);

	// 	// // If: I run the action when it will resolve
	// 	// action.run()
	// 	// 	.then(result => {
	// 	// 		// Then:
	// 	// 		// ... I should have gotten true back
	// 	// 		assert.ok(result);

	// 	// 		// ... A confirmation dialog should have opened
	// 	// 		ms.verify(x => x.confirm(TypeMoq.It.isAny()), TypeMoq.Times.once());

	// 	// 		// ... The account management service should have gotten a remove account request
	// 	// 		ams.verify(x => x.removeAccount(TypeMoq.It.isValue(testAccount.key)), TypeMoq.Times.once());
	// 	// 	})
	// 	// 	.then(
	// 	// 	() => done(),
	// 	// 	err => done(err)
	// 	// 	);
	// });

	// test('RemoveAccount - Declined Success', (done) => {
	// 	// // Setup: Create an AddAccountAction object
	// 	// let ams = getMockAccountManagementService(true);
	// 	// let ms = getMockMessageService(false);
	// 	// let es = getMockErrorMessageService();
	// 	// let action = new RemoveAccountAction(testAccount, ms.object, es.object, ams.object);

	// 	// // If: I run the action when it will resolve
	// 	// action.run()
	// 	// 	.then(result => {
	// 	// 		try {
	// 	// 			// Then:
	// 	// 			// ... I should have gotten false back
	// 	// 			assert.ok(!result);

	// 	// 			// ... A confirmation dialog should have opened
	// 	// 			ms.verify(x => x.confirm(TypeMoq.It.isAny()), TypeMoq.Times.once());

	// 	// 			// ... The account management service should not have gotten a remove account request
	// 	// 			ams.verify(x => x.removeAccount(TypeMoq.It.isAny()), TypeMoq.Times.never());

	// 	// 			done();
	// 	// 		} catch (e) {
	// 	// 			done(e);
	// 	// 		}
	// 	// 	});
	// });

	// test('RemoveAccount - Failure', (done) => {
	// 	// // Setup: Create an AddAccountAction object
	// 	// let ams = getMockAccountManagementService(false);
	// 	// let ms = getMockMessageService(true);
	// 	// let es = getMockErrorMessageService();
	// 	// let action = new RemoveAccountAction(testAccount, ms.object, es.object, ams.object);

	// 	// // If: I run the action when it will reject
	// 	// action.run().then(result => {
	// 	// 	// Then:
	// 	// 	// ... The result should be false since the operation failed
	// 	// 	assert.ok(!result);
	// 	// 	// ... The account management service should have gotten a remove account request
	// 	// 	ams.verify(x => x.removeAccount(TypeMoq.It.isValue(testAccount.key)), TypeMoq.Times.once());
	// 	// 	done();
	// 	// }, error => {
	// 	// 	// Should fail as rejected actions cause the debugger to crash
	// 	// 	done(error);
	// 	// });
	// });
});

// function createAddAccountAction(resolve: boolean, confirm: boolean, param: string): IAddActionMocks {
// 	let ams = getMockAccountManagementService(resolve);
// 	let mockMessageService = getMockMessageService(confirm);
// 	let mockErrorMessageService = getMockErrorMessageService();
// 	return {
// 		accountMock: ams,
// 		messageMock: mockMessageService,
// 		errorMessageMock: mockErrorMessageService,
// 		action: new AddAccountAction(param, mockMessageService.object,
// 			mockErrorMessageService.object, ams.object)
// 	};
// }

// function getMockAccountManagementService(resolve: boolean): TypeMoq.Mock<AccountManagementTestService> {
// 	let mockAccountManagementService = TypeMoq.Mock.ofType(AccountManagementTestService);

// 	mockAccountManagementService.setup(x => x.addAccount(TypeMoq.It.isAnyString()))
// 		.returns(resolve ? () => Promise.resolve(null) : () => Promise.reject(null));
// 	mockAccountManagementService.setup(x => x.removeAccount(TypeMoq.It.isAny()))
// 		.returns(resolve ? () => Promise.resolve(true) : () => Promise.reject(null).then());

// 	return mockAccountManagementService;
// }

// function getMockMessageService(confirm: boolean): TypeMoq.Mock<MessageServiceStub> {
// 	let mockMessageService = TypeMoq.Mock.ofType(MessageServiceStub);

// 	mockMessageService.setup(x => x.confirm(TypeMoq.It.isAny()))
// 		.returns(() => undefined);

// 	return mockMessageService;
// }

// function getMockErrorMessageService(): TypeMoq.Mock<ErrorMessageServiceStub> {
// 	let mockMessageService = TypeMoq.Mock.ofType(ErrorMessageServiceStub);
// 	mockMessageService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()));
// 	return mockMessageService;
// }

// interface IAddActionMocks
// {
// 	accountMock: TypeMoq.Mock<AccountManagementTestService>;
// 	messageMock: TypeMoq.Mock<MessageServiceStub>;
// 	errorMessageMock: TypeMoq.Mock<ErrorMessageServiceStub>;
// 	action: AddAccountAction;
// }
