/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import { resourceTypeToDisplayName, parseEndpoint, parseInstanceName } from '../../common/utils';

import * as loc from '../../localizedConstants';
import { ResourceType } from '../../constants';

describe('resourceTypeToDisplayName Method Tests', () => {
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

describe('parseEndpoint Method Tests', () => {
	it('Should parse valid endpoint correctly', function (): void {
		should(parseEndpoint('127.0.0.1:1337')).deepEqual({ ip: '127.0.0.1', port: '1337'});
	});

	it('Should parse empty endpoint correctly', function (): void {
		should(parseEndpoint('')).deepEqual({ ip: '', port: ''});
	});

	it('Should parse undefined endpoint correctly', function (): void {
		should(parseEndpoint('')).deepEqual({ ip: '', port: ''});
	});
});

describe('parseInstanceName Method Tests', () => {
	it('Should parse valid instanceName with namespace correctly', function (): void {
		should(parseInstanceName('mynamespace_myinstance')).equal('myinstance');
	});

	it('Should parse valid instanceName without namespace correctly', function (): void {
		should(parseInstanceName('myinstance')).equal('myinstance');
	});

	it('Should return empty string when undefined value passed in', function (): void {
		should(parseInstanceName(undefined)).equal('');
	});

	it('Should return empty string when empty string value passed in', function (): void {
		should(parseInstanceName('')).equal('');
	});
});
