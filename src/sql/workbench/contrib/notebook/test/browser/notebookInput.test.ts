/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { workbenchInstantiationService } from 'vs/workbench/test/workbenchTestServices';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { UntitledNotebookInput } from 'sql/workbench/contrib/notebook/common/models/untitledNotebookInput';
import { FileNotebookInput } from 'sql/workbench/contrib/notebook/common/models/fileNotebookInput';

suite('Notebook Input', function (): void {
	const instantiationService = workbenchInstantiationService();

	test('File Notebook Input', async function (): Promise<void> {
		let uri = URI.from({ scheme: Schemas.file, path: 'TestPath' });
		let input = instantiationService.createInstance(FileNotebookInput, 'TestInput', uri, undefined);

		let inputId = input.getTypeId();
		assert.strictEqual(inputId, FileNotebookInput.ID);
	});

	test('Untitled Notebook Input', async function (): Promise<void> {
		let uri = URI.from({ scheme: Schemas.untitled, path: 'TestPath' });
		let input = instantiationService.createInstance(UntitledNotebookInput, 'TestInput', uri, undefined);

		let inputId = input.getTypeId();
		assert.strictEqual(inputId, UntitledNotebookInput.ID);
	});
});
