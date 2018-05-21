/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';

import { ModelViewInput } from 'sql/parts/modelComponents/modelEditor/modelViewInput';
import { ModelViewEditor } from 'sql/parts/modelComponents/modelEditor/modelViewEditor';

// Model View editor registration
const viewModelEditorDescriptor = new EditorDescriptor(
	ModelViewEditor,
	ModelViewEditor.ID,
	'ViewModel'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(viewModelEditorDescriptor, [new SyncDescriptor(ModelViewInput)]);