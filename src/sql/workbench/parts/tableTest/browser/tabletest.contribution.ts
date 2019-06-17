/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IEditorRegistry, Extensions as EditorExtensions, EditorDescriptor } from 'vs/workbench/browser/editor';
import { SlickGridTableTest, AsyncTableTestEditor } from 'sql/workbench/parts/tableTest/browser/tableTestEditor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { SlickGridTableTestInput, AsyncTableTestInput } from 'sql/workbench/parts/tableTest/browser/tabletestinput';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { IWorkbenchActionRegistry, Extensions as WorkbenchActionExtensions } from 'vs/workbench/common/actions';
import { Action } from 'vs/base/common/actions';
import { localize } from 'vs/nls';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(new EditorDescriptor(SlickGridTableTest, SlickGridTableTest.ID, 'QueryResults'), [new SyncDescriptor(SlickGridTableTestInput)]);
Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(new EditorDescriptor(AsyncTableTestEditor, AsyncTableTestEditor.ID, 'QueryResults'), [new SyncDescriptor(AsyncTableTestInput)]);


class AsyncOpenTableTest extends Action {
	static readonly ID = 'workbench.action.AsyncopentableTest';
	static readonly LABEL = localize('openAsynctabletest', "Open Async Table Test");

	constructor(
		id: string,
		label: string,
		@IEditorService private readonly editorService: IEditorService,
		@IQuickInputService private readonly quickInputService: IQuickInputService
	) {
		super(id, label);
	}

	run(): Promise<boolean> {
		return this.quickInputService.input().then(n => {
			this.editorService.openEditor(new AsyncTableTestInput(Number(n)));
		}).then(() => true);
	}
}

class SlickOpenTableTest extends Action {
	static readonly ID = 'workbench.action.slickopentableTest';
	static readonly LABEL = localize('slickopentabletest', "Open Slick Table Test");

	constructor(
		id: string,
		label: string,
		@IEditorService private readonly editorService: IEditorService,
		@IQuickInputService private readonly quickInputService: IQuickInputService
	) {
		super(id, label);
	}

	run(): Promise<boolean> {
		return this.quickInputService.input().then(n => {
			return this.editorService.openEditor(new SlickGridTableTestInput(Number(n)));
		}).then(() => true);
	}
}

Registry.as<IWorkbenchActionRegistry>(WorkbenchActionExtensions.WorkbenchActions).registerWorkbenchAction(new SyncActionDescriptor(SlickOpenTableTest, SlickOpenTableTest.ID, SlickOpenTableTest.LABEL), 'Open slick table test');
Registry.as<IWorkbenchActionRegistry>(WorkbenchActionExtensions.WorkbenchActions).registerWorkbenchAction(new SyncActionDescriptor(AsyncOpenTableTest, AsyncOpenTableTest.ID, AsyncOpenTableTest.LABEL), 'Open async table test');