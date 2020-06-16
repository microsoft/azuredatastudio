/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import {createDummyFileStructure} from './testUtils';
import {toPascalCase, exists} from '../common/utils';

describe('Tests for conversion within PascalCase and camelCase', function (): void {
	it('Should generate PascalCase from camelCase correctly', async () => {
		should(toPascalCase('')).equal('');
		should(toPascalCase('camelCase')).equal('CamelCase');
		should(toPascalCase('camel.case')).equal('Camel.case');
	});
});

describe('Tests to verify exists function', function (): void {
	it('Should determine existence of files/folders', async () => {
		let testFolderPath = await createDummyFileStructure();

		should(await exists(testFolderPath)).equal(true);
		should(await exists(path.join(testFolderPath, 'file1.sql'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder2'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder4'))).equal(false);
		should(await exists(path.join(testFolderPath, 'folder2','file4.sql'))).equal(true);
		should(await exists(path.join(testFolderPath, 'folder4','file2.sql'))).equal(false);
	});
});

