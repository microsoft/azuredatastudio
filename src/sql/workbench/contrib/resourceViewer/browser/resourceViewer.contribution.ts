/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorDescriptor, Extensions as EditorExtensions, IEditorRegistry } from 'vs/workbench/browser/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { ResourceViewerEditor } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerEditor';
import { ResourceViewerInput } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';

const resourceViewerDescriptor = EditorDescriptor.create(
	ResourceViewerEditor,
	ResourceViewerEditor.ID,
	'ResourceViewerEditor'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(resourceViewerDescriptor, [new SyncDescriptor(ResourceViewerInput)]);

