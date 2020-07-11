/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import { doubleEscapeSingleQuotes, backEscapeDoubleQuotes, getTelemetryErrorType,buildSsmsMinCommandArgs, buildUrn, LaunchSsmsDialogParams } from '../utils';
import { ExtHostObjectExplorerNodeStub } from './stubs';

describe('buildSsmsMinCommandArgs Method Tests', () => {
	it('Should be built correctly with all params and UseAAD as false', function (): void {
		const params: LaunchSsmsDialogParams = {
			action: 'myAction',
			server: 'myServer',
			database: 'myDatabase',
			user: 'user',
			useAad: false,
			urn: 'Server\\Database\\Table'
		};
		const args = buildSsmsMinCommandArgs(params);
		should(args).equal('-a "myAction" -S "myServer" -D "myDatabase" -U "user" -u "Server\\Database\\Table"');
	});

	it('Should be built correctly with all params and UseAAD as true', function (): void {
		const params: LaunchSsmsDialogParams = {
			action: 'myAction',
			server: 'myServer',
			database: 'myDatabase',
			user: 'user',
			useAad: true,
			urn: 'Server\\Database\\Table'
		};
		const args = buildSsmsMinCommandArgs(params);

		should(args).equal('-a "myAction" -S "myServer" -D "myDatabase" -U "user" -G -u "Server\\Database\\Table"');
	});

	it('Should be built correctly and names escaped correctly', function (): void {
		const params: LaunchSsmsDialogParams = {
			action: 'myAction\'"/\\[]tricky',
			server: 'myServer\'"/\\[]tricky',
			database: 'myDatabase\'"/\\[]tricky',
			user: 'user\'"/\\[]tricky',
			useAad: true,
			urn: 'Server\\Database[\'myDatabase\'\'"/\\[]tricky\']\\Table["myTable\'""/\\[]tricky"]'
		};
		const args = buildSsmsMinCommandArgs(params);

		should(args).equal('-a "myAction\'\\"/\\[]tricky" -S "myServer\'\\"/\\[]tricky" -D "myDatabase\'\\"/\\[]tricky" -U "user\'\\"/\\[]tricky" -G -u "Server\\Database[\'myDatabase\'\'\\"/\\[]tricky\']\\Table[\\"myTable\'\\"\\"/\\[]tricky\\"]"');
	});

	it('Should be built correctly with only action and server', function (): void {

		const params: LaunchSsmsDialogParams = {
			action: 'myAction',
			server: 'myServer'
		};
		const args = buildSsmsMinCommandArgs(params);
		should(args).equal('-a "myAction" -S "myServer"');
	});
});

const dbName = 'My\'Db';
const escapedDbName = doubleEscapeSingleQuotes(dbName);
const dbSchema = 'db\'sch';
const escapedDbSchema = doubleEscapeSingleQuotes(dbSchema);
const tableName = 'My\'Table';
const escapedTableName = doubleEscapeSingleQuotes(tableName);
const tableSchema = 'tbl\'sch';
const escapedTableSchema = doubleEscapeSingleQuotes(tableSchema);

describe('buildUrn Method Tests', () => {
	it('Urn should be correct with no node', async function (): Promise<void> {
		should(await buildUrn(undefined)).equal('Server');
	});

	it('Urn should be correct with Server and only Databases folder', async function (): Promise<void> {
		const leafNode: ExtHostObjectExplorerNodeStub =
			new ExtHostObjectExplorerNodeStub('MyServer', undefined, 'Server', undefined)
				.createChild('Databases', undefined, 'Folder');
		should(await buildUrn(leafNode)).equal('Server');
	});

	it('Urn should be correct with Server and Database node', async function (): Promise<void> {
		const leafNode: ExtHostObjectExplorerNodeStub =
			new ExtHostObjectExplorerNodeStub('Databases', undefined, 'Folder', undefined)
				.createChild(dbName, dbSchema, 'Database');
		should(await buildUrn(leafNode)).equal(
			`Server/Database[@Name='${escapedDbName}' and @Schema='${escapedDbSchema}']`);
	});

	it('Urn should be correct with Multiple levels of Nodes', async function (): Promise<void> {
		const rootNode: ExtHostObjectExplorerNodeStub =
			new ExtHostObjectExplorerNodeStub('Databases', undefined, 'Folder', undefined)
				.createChild(dbName, dbSchema, 'Database')
				.createChild('Tables', undefined, 'Folder')
				.createChild(tableName, tableSchema, 'Table');
		should(await buildUrn(rootNode)).equal(
			`Server/Database[@Name='${escapedDbName}' and @Schema='${escapedDbSchema}']/Table[@Name='${escapedTableName}' and @Schema='${escapedTableSchema}']`);
	});

	it('Urn should be correct with Multiple levels of Nodes without schemas', async function (): Promise<void> {
		const rootNode: ExtHostObjectExplorerNodeStub =
			new ExtHostObjectExplorerNodeStub('Databases', undefined, 'Folder', undefined)
				.createChild(dbName, undefined, 'Database')
				.createChild('Tables', undefined, 'Folder')
				.createChild(tableName, undefined, 'Table');
		should(await buildUrn(rootNode)).equal(
			`Server/Database[@Name='${escapedDbName}']/Table[@Name='${escapedTableName}']`);
	});
});

describe('doubleEscapeSingleQuotes Method Tests', () => {
	it('Should return original string if no single quotes', function (): void {
		const testString: string = 'MyTestString';
		const ret = doubleEscapeSingleQuotes(testString);
		should(ret).equal(testString);
	});

	it('Should return escaped original string if it contains single quotes', function (): void {
		const testString: string = 'MyTestString\'\'WithQuotes';
		const ret = doubleEscapeSingleQuotes(testString);
		should(ret).equal('MyTestString\'\'\'\'WithQuotes');
	});
});

describe('backEscapeDoubleQuotes Method Tests', () => {
	it('Should return original string if no double quotes', function (): void {
		const testString: string = 'MyTestString';
		const ret = backEscapeDoubleQuotes(testString);
		should(ret).equal(testString);
	});

	it('Should return escaped original string if it contains double quotes', function (): void {
		const testString: string = 'MyTestString\"\"WithQuotes';
		const ret = backEscapeDoubleQuotes(testString);
		should(ret).equal('MyTestString\\"\\"WithQuotes');
	});
});

describe('getTelemetryErrorType Method Tests', () => {
	it('ExeNotFound', function (): void {
		const msg = getTelemetryErrorType('SsmsMin.exe is not recognized as an internal or external command');
		should(msg).equal('ExeNotFound');
	});

	it('UnknownAction', function (): void {
		const msg = getTelemetryErrorType('Unknown Action "foo"');
		should(msg).equal('UnknownAction');
	});

	it('NoActionProvided', function (): void {
		const msg = getTelemetryErrorType('No Action Provided');
		should(msg).equal('NoActionProvided');
	});

	it('RunException', function (): void {
		const msg = getTelemetryErrorType('Run exception "Error occurred"');
		should(msg).equal('RunException');
	});

	it('Other', function (): void {
		const msg = getTelemetryErrorType('Some other error message');
		should(msg).equal('Other');
	});
});
