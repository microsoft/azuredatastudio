/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as templates from '../templates/templates';
import { shouldThrowSpecificError } from './testUtils';

describe('Templates: loading templates from disk', function (): void {
	beforeEach(() => {
		templates.reset();
	});

	it('Should throw error when attempting to use templates before loaded from file', async function (): Promise<void> {
		await shouldThrowSpecificError(() => templates.projectScriptTypeMap(), 'Templates must be loaded from file before attempting to use.');
		await shouldThrowSpecificError(() => templates.projectScriptTypes(), 'Templates must be loaded from file before attempting to use.');
	});

	it('Should load all templates from files', async function (): Promise<void> {
		await templates.loadTemplates(path.join(__dirname, '..', '..', 'resources', 'templates'));

		// check expected counts

		const numScriptObjectTypes = 4;

		should(templates.projectScriptTypes().length).equal(numScriptObjectTypes);
		should(Object.keys(templates.projectScriptTypes()).length).equal(numScriptObjectTypes);

		// check everything has a value

		should(templates.newSqlProjectTemplate).not.equal(undefined);

		for (const obj of templates.projectScriptTypes()) {
			should(obj.templateScript).not.equal(undefined);
		}
	});
});
