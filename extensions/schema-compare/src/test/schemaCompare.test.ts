/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import 'mocha';
import { SchemaCompareDialog } from './../dialogs/schemaCompareDialog';
import { SchemaCompareResult } from './../schemaCompareResult';
import { AssertionError } from 'assert';
import { SchemaCompareTestService } from './testSchemaCompareService';

let mockDacFxServiceProvider: TypeMoq.IMock<azdata.DacFxServicesProvider>;

// Mock test data
const mockConnectionProfile: azdata.IConnectionProfile = {
		connectionName: 'My Connection',
		serverName: 'My Server',
		databaseName: 'My Server',
		userName: 'My User',
		password: 'My Pwd',
		authenticationType: 'SqlLogin',
		savePassword: false,
		groupFullName: 'My groupName',
		groupId: 'My GroupId',
		providerName: 'My Server',
		saveProfile: true,
		id: 'My Id',
		options: null
};

const mocksource: string = 'source.dacpac';
const mocktarget: string = 'target.dacpac';

const mockSourceEndpoint: azdata.SchemaCompareEndpointInfo = {
	endpointType: azdata.SchemaCompareEndpointType.dacpac,
	databaseName: '',
	ownerUri: '',
	packageFilePath: mocksource
};

const mockTargetEndpoint: azdata.SchemaCompareEndpointInfo = {
	endpointType: azdata.SchemaCompareEndpointType.dacpac,
	databaseName: '',
	ownerUri: '',
	packageFilePath: mocktarget
};


describe('SchemaCompareDialog.openDialog', function(): void {
	it('Should be correct when created.', async function(): Promise<void> {
		let dialog = new SchemaCompareDialog();
		dialog.openDialog(mockConnectionProfile);

		should(dialog.dialog.title).equal('Schema Compare');
		should(dialog.dialog.okButton.label).equal('Compare');
		should(dialog.dialog.okButton.enabled).equal(true);
	});
});

describe('SchemaCompareResult.start', function(): void {
	it('Should be correct when created.', async function(): Promise<void> {
		let sc = new SchemaCompareTestService();
		azdata.dataprotocol.registerSchemaCompareServicesProvider(sc);

		let result = new SchemaCompareResult(mocksource, mocktarget, mockSourceEndpoint, mockTargetEndpoint);
		should(result.getEditor().valid).equal(true);
	});
});
