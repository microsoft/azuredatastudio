/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { escapeSingleQuotes } from '../../objectManagement/utils';
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
});
