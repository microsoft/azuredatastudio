/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditDataEditor } from 'sql/workbench/parts/editData/browser/editDataEditor';
import { EditDataInput } from 'sql/workbench/parts/editData/browser/editDataInput';
import { EditDataResultsEditor } from 'sql/workbench/parts/editData/browser/editDataResultsEditor';
import { EditDataResultsInput } from 'sql/workbench/parts/editData/browser/editDataResultsInput';
import { EditorDescriptor, IEditorRegistry, Extensions } from 'vs/workbench/browser/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';

// Editor
const editDataEditorDescriptor = new EditorDescriptor(
	EditDataEditor,
	EditDataEditor.ID,
	'EditData'
);

Registry.as<IEditorRegistry>(Extensions.Editors)
	.registerEditor(editDataEditorDescriptor, [new SyncDescriptor(EditDataInput)]);

// Editor
const editDataResultsEditorDescriptor = new EditorDescriptor(
	EditDataResultsEditor,
	EditDataResultsEditor.ID,
	'EditDataResults'
);

Registry.as<IEditorRegistry>(Extensions.Editors)
	.registerEditor(editDataResultsEditorDescriptor, [new SyncDescriptor(EditDataResultsInput)]);
