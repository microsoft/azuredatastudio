/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { convertNumToTwoDecimalStringInMB, escapeSingleQuotes } from '../../objectManagement/utils';
import 'mocha';
import * as should from 'should';

describe('escapeSingleQuotes Method Tests', () => {

	it('Should return original string if no single quotes', function (): void {
		const dbName = "My Database";
		const testString: string = "Server/Database[@Name='My Database']";
		const ret = `Server/Database[@Name='${escapeSingleQuotes(dbName)}']`;
		should(ret).equal(testString);
	});

	it('Should return original string if it contains single quotes', function (): void {
		const dbName = "My'Database";
		const testString: string = "Server/Database[@Name='My'Database']";
		const ret = `Server/Database[@Name='${escapeSingleQuotes(dbName)}']`;
		should(ret).equal(testString);
	});

	it('Should return escaped original string if it contains an escaped single quote', function (): void {
		const dbName = "My Database\'WithEscapedSingleQuote";
		const testString: string = "Server/Database[@Name='My Database\'WithEscapedSingleQuote']";
		const ret = `Server/Database[@Name='${escapeSingleQuotes(dbName)}']`;
		should(ret).equal(testString);
	});

	it('convertNumToTwoDecimalStringInMB function should convert and return the passed integer value to string with two decimals and in MB units', () => {
		should(convertNumToTwoDecimalStringInMB(0)).equals('0.00 MB', 'should return string value In MB with two decimals');
		should(convertNumToTwoDecimalStringInMB(10)).equals('10.00 MB', 'should return string value In MB with two decimals');
		should(convertNumToTwoDecimalStringInMB(10.23)).equals('10.23 MB', 'should return string value In MB with two decimals');
	});
});
