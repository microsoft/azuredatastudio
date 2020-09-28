/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceType } from 'arc';
import 'mocha';
import * as should from 'should';
import * as vscode from 'vscode';
import { getAzurecoreApi, getConnectionModeDisplayText, getDatabaseStateDisplayText, getErrorMessage, getResourceTypeIcon, parseEndpoint, parseIpAndPort, promptAndConfirmPassword, promptForInstanceDeletion, resourceTypeToDisplayName } from '../../common/utils';
import { ConnectionMode as ConnectionMode, IconPathHelper } from '../../constants';
import * as loc from '../../localizedConstants';
import { MockInputBox } from '../stubs';


describe('resourceTypeToDisplayName Method Tests', function (): void {
	it('Display Name should be correct for valid ResourceType', function (): void {
		should(resourceTypeToDisplayName(ResourceType.dataControllers)).equal(loc.dataControllersType);
		should(resourceTypeToDisplayName(ResourceType.postgresInstances)).equal(loc.pgSqlType);
		should(resourceTypeToDisplayName(ResourceType.sqlManagedInstances)).equal(loc.miaaType);
	});

	it('Display Name should be correct for unknown value', function (): void {
		should(resourceTypeToDisplayName('Unknown Type')).equal('Unknown Type');
	});

	it('Display Name should be correct for empty value', function (): void {
		should(resourceTypeToDisplayName('')).equal('undefined');
	});

	it('Display Name should be correct for undefined value', function (): void {
		should(resourceTypeToDisplayName(undefined)).equal('undefined');
	});
});

describe('parseEndpoint Method Tests', function (): void {
	it('Should parse valid endpoint correctly', function (): void {
		should(parseEndpoint('127.0.0.1:1337')).deepEqual({ ip: '127.0.0.1', port: '1337' });
	});

	it('Should parse empty endpoint correctly', function (): void {
		should(parseEndpoint('')).deepEqual({ ip: '', port: '' });
	});

	it('Should parse undefined endpoint correctly', function (): void {
		should(parseEndpoint('')).deepEqual({ ip: '', port: '' });
	});
});

describe('getAzurecoreApi Method Tests', function () {
	it('Should get azurecore API correctly', function (): void {
		should(getAzurecoreApi()).not.be.undefined();
	});
});

describe('getResourceTypeIcon Method Tests', function () {
	it('Correct icons should be returned for valid ResourceTypes', function (): void {
		should(getResourceTypeIcon(ResourceType.sqlManagedInstances)).equal(IconPathHelper.miaa, 'Unexpected MIAA icon');
		should(getResourceTypeIcon(ResourceType.postgresInstances)).equal(IconPathHelper.postgres, 'Unexpected Postgres icon');
		should(getResourceTypeIcon(ResourceType.dataControllers)).equal(IconPathHelper.controller, 'Unexpected controller icon');
	});
	it('Undefined should be returned for undefined resource types', function (): void {
		should(getResourceTypeIcon(undefined)).be.undefined();
	});
	it('Undefined should be returned for empty resource types', function (): void {
		should(getResourceTypeIcon('')).be.undefined();
	});
	it('Undefined should be returned for unknown resource types', function (): void {
		should(getResourceTypeIcon('UnknownType')).be.undefined();
	});
});

describe('getConnectionModeDisplayText Method Tests', function () {
	it('Display Name should be correct for valid ResourceType', function (): void {
		should(getConnectionModeDisplayText(ConnectionMode.direct)).equal(loc.direct);
		should(getConnectionModeDisplayText(ConnectionMode.indirect)).equal(loc.indirect);
	});

	it('Display Name should be correct for unknown value', function (): void {
		should(getConnectionModeDisplayText('UnknownMode')).equal('UnknownMode');
	});

	it('Display Name should be correct for empty value', function (): void {
		should(getConnectionModeDisplayText('')).equal('');
	});

	it('Display Name should be correct for undefined value', function (): void {
		should(getConnectionModeDisplayText(undefined)).equal('');
	});
});

describe('getDatabaseStateDisplayText Method Tests', function () {
	it('State should be correct for valid states', function (): void {
		should(getDatabaseStateDisplayText('ONLINE')).equal(loc.online);
		should(getDatabaseStateDisplayText('OFFLINE')).equal(loc.offline);
		should(getDatabaseStateDisplayText('RESTORING')).equal(loc.restoring);
		should(getDatabaseStateDisplayText('RECOVERING')).equal(loc.recovering);
		should(getDatabaseStateDisplayText('RECOVERY PENDING')).equal(loc.recoveryPending);
		should(getDatabaseStateDisplayText('SUSPECT')).equal(loc.suspect);
		should(getDatabaseStateDisplayText('EMERGENCY')).equal(loc.emergency);
	});

	it('State should stay the same for unknown value', function (): void {
		should(getDatabaseStateDisplayText('UnknownState')).equal('UnknownState');
	});

	it('State should stay the same for empty value', function (): void {
		should(getDatabaseStateDisplayText('')).equal('');
	});
});

describe('promptForResourceDeletion Method Tests', function (): void {
	let mockInputBox: MockInputBox;
	before(function (): void {
		vscode.window.createInputBox = () => {
			return mockInputBox;
		};
	});

	beforeEach(function (): void {
		mockInputBox = new MockInputBox();
	});

	it('Resolves as true when value entered is correct', function (done): void {
		promptForInstanceDeletion('myname').then((value: boolean) => {
			value ? done() : done(new Error('Expected return value to be true'));
		});
		mockInputBox.value = 'myname';
		mockInputBox.triggerAccept();
	});

	it('Resolves as false when input box is closed early', function (done): void {
		promptForInstanceDeletion('myname').then((value: boolean) => {
			!value ? done() : done(new Error('Expected return value to be false'));
		});
		mockInputBox.hide();
	});

	it('Validation message is set when value entered is incorrect', async function (): Promise<void> {
		promptForInstanceDeletion('myname');
		mockInputBox.value = 'wrong value';
		await mockInputBox.triggerAccept();
		should(mockInputBox.validationMessage).not.be.equal('', 'Validation message should not be empty after incorrect value entered');
		mockInputBox.value = 'new value';
		should(mockInputBox.validationMessage).be.equal('', 'Validation message should be empty after new value entered');
	});
});

describe('promptAndConfirmPassword Method Tests', function (): void {
	let mockInputBox: MockInputBox;
	before(function (): void {
		vscode.window.createInputBox = () => {
			return mockInputBox;
		};
	});

	beforeEach(function (): void {
		mockInputBox = new MockInputBox();
	});

	it('Resolves with expected string when passwords match', function (done): void {
		const password = 'MyPassword';
		promptAndConfirmPassword((_: string) => { return ''; }).then(value => {
			if (value === password) {
				done();
			} else {
				done(new Error(`Return value '${value}' did not match expected value '${password}'`));
			}
		});
		mockInputBox.value = password;
		mockInputBox.triggerAccept().then(() => {
			mockInputBox.value = password;
			mockInputBox.triggerAccept();
		});
	});

	it('Resolves with undefined when first input box closed early', function (done): void {
		promptAndConfirmPassword((_: string) => { return ''; }).then(value => {
			if (value === undefined) {
				done();
			} else {
				done(new Error('Return value was expected to be undefined'));
			}
		});
		mockInputBox.hide();
	});

	it('Resolves with undefined when second input box closed early', function (done): void {
		const password = 'MyPassword';
		promptAndConfirmPassword((_: string) => { return ''; }).then(value => {
			if (value === undefined) {
				done();
			} else {
				done(new Error('Return value was expected to be undefined'));
			}
		});
		mockInputBox.value = password;
		mockInputBox.triggerAccept().then(() => {
			mockInputBox.hide();
		});
	});

	it('Error message displayed when validation callback returns error message', function (done): void {
		const testError = 'Test Error';
		promptAndConfirmPassword((_: string) => { return testError; }).catch(err => done(err));
		mockInputBox.value = '';
		mockInputBox.triggerAccept().then(() => {
			if (mockInputBox.validationMessage === testError) {
				done();
			} else {
				done(new Error(`Validation message '${mockInputBox.validationMessage}' was expected to be '${testError}'`));
			}
		});
	});

	it('Error message displayed when passwords do not match', function (done): void {
		promptAndConfirmPassword((_: string) => { return ''; }).catch(err => done(err));
		mockInputBox.value = 'MyPassword';
		mockInputBox.triggerAccept().then(() => {
			mockInputBox.value = 'WrongPassword';
			mockInputBox.triggerAccept().then(() => {
				if (mockInputBox.validationMessage === loc.thePasswordsDoNotMatch) {
					done();
				} else {
					done(new Error(`Validation message '${mockInputBox.validationMessage} was not the expected message`));
				}
			});
		});
	});
});

describe('getErrorMessage Method Tests', function () {
	it('Error with message', function (): void {
		const errorMessage = 'Test Message';
		const error = new Error(errorMessage);
		should(getErrorMessage(error)).equal(errorMessage);
	});

	it('Error with no message', function (): void {
		const error = new Error();
		should(getErrorMessage(error)).equal(error.message);
	});
});

describe('parseIpAndPort', function (): void {
	it('Valid address', function (): void {
		const ip = '127.0.0.1';
		const port = '80';
		should(parseIpAndPort(`${ip}:${port}`)).deepEqual({ ip: ip, port: port });
	});

	it('invalid address - no port', function (): void {
		const ip = '127.0.0.1';
		should(() => parseIpAndPort(ip)).throwError();
	});
});
