/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { EditorDescriptor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/common/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';
import { TaskDialogEditor } from 'sql/parts/tasks/dialog/taskDialogEditor';
import { TaskDialogInput } from 'sql/parts/tasks/dialog/taskDialogInput';
import { CreateLoginEditor } from 'sql/parts/admin/security/createLoginEditor';
import { CreateLoginInput } from 'sql/parts/admin/security/createLoginInput';

// Task Dialog registration
const taskDialogEditorDescriptor = new EditorDescriptor(
	TaskDialogEditor.ID,
	'Task Dialog',
	'sql/parts/tasks/dialog/taskDialogEditor',
	'TaskDialogEditor'
);

// Create Login registration
const createLoginEditorDescriptor = new EditorDescriptor(
	CreateLoginEditor.ID,
	'CreateLogin',
	'sql/parts/admin/security/createLoginEditor',
	'CreateLoginEditor'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(createLoginEditorDescriptor, [new SyncDescriptor(CreateLoginInput)]);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(taskDialogEditorDescriptor, [new SyncDescriptor(TaskDialogInput)]);