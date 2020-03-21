/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sinon from 'sinon';
import * as assert from 'assert';
import { QueryEditorService } from 'sql/workbench/services/queryEditor/browser/queryEditorService';
import { workbenchInstantiationService } from 'vs/workbench/test/electron-browser/workbenchTestServices';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

suite('Query Editor Service', () => {
	test('does open input when requested', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = instantiationService.invokeFunction(accessor => accessor.get(IEditorService));
		const openStub = sinon.stub(editorService, 'openEditor', () => Promise.resolve());
		const queryEditorService = instantiationService.createInstance(QueryEditorService);

		await queryEditorService.newSqlEditor({ open: true });

		assert(openStub.calledOnce);
	});

	test('does open input by default', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = instantiationService.invokeFunction(accessor => accessor.get(IEditorService));
		const openStub = sinon.stub(editorService, 'openEditor', () => Promise.resolve());
		const queryEditorService = instantiationService.createInstance(QueryEditorService);

		await queryEditorService.newSqlEditor();

		assert(openStub.calledOnce);
	});

	test('doesnt open input when requested', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = instantiationService.invokeFunction(accessor => accessor.get(IEditorService));
		const openStub = sinon.stub(editorService, 'openEditor', () => Promise.resolve());
		const queryEditorService = instantiationService.createInstance(QueryEditorService);

		await queryEditorService.newSqlEditor({ open: false });

		assert(openStub.notCalled);
	});
});
