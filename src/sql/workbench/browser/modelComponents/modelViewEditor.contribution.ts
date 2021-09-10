/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorPaneDescriptor, IEditorPaneRegistry } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';

import { ModelViewInput } from 'sql/workbench/browser/modelComponents/modelViewInput';
import { ModelViewEditor } from 'sql/workbench/browser/modelComponents/modelViewEditor';
import { EditorExtensions } from 'vs/workbench/common/editor';

// Model View editor registration
const viewModelEditorDescriptor = EditorPaneDescriptor.create(
	ModelViewEditor,
	ModelViewEditor.ID,
	'ViewModel'
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.Editors)
	.registerEditorPane(viewModelEditorDescriptor, [new SyncDescriptor(ModelViewInput)]);
