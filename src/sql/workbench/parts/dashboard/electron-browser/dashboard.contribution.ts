/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DashboardEditor } from 'sql/workbench/parts/dashboard/electron-browser/dashboardEditor';
import { DashboardInput } from 'sql/workbench/parts/dashboard/electron-browser/core/dashboardInput';

import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { localize } from 'vs/nls';

const dashboardEditorDescriptor = new EditorDescriptor(
	DashboardEditor,
	DashboardEditor.ID,
	localize('dashboard.editor.label', "Dashboard")
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(dashboardEditorDescriptor, [new SyncDescriptor(DashboardInput)]);
