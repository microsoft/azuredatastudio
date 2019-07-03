/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryPlanEditor } from 'sql/workbench/parts/queryPlan/electron-browser/queryPlanEditor';
import { QueryPlanInput } from 'sql/workbench/parts/queryPlan/common/queryPlanInput';
import { EditorDescriptor, IEditorRegistry, Extensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';

// Query Plan editor registration

const queryPlanEditorDescriptor = new EditorDescriptor(
	QueryPlanEditor,
	QueryPlanEditor.ID,
	'QueryPlan'
);

Registry.as<IEditorRegistry>(Extensions.Editors)
	.registerEditor(queryPlanEditorDescriptor, [new SyncDescriptor(QueryPlanInput)]);
