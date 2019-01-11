/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorRegistry, Extensions as EditorExtensions, EditorDescriptor } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';
import { TaskDialogEditor } from 'sql/parts/tasks/dialog/taskDialogEditor';
import { TaskDialogInput } from 'sql/parts/tasks/dialog/taskDialogInput';
import { CreateLoginEditor } from 'sql/parts/admin/security/createLoginEditor';
import { CreateLoginInput } from 'sql/parts/admin/security/createLoginInput';

// Task Dialog registration
const taskDialogEditorDescriptor = new EditorDescriptor(
	TaskDialogEditor,
	TaskDialogEditor.ID,
	'Task Dialog'
);

// Create Login registration
const createLoginEditorDescriptor = new EditorDescriptor(
	CreateLoginEditor,
	CreateLoginEditor.ID,
	'CreateLogin'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(createLoginEditorDescriptor, [new SyncDescriptor(CreateLoginInput)]);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(taskDialogEditorDescriptor, [new SyncDescriptor(TaskDialogInput)]);