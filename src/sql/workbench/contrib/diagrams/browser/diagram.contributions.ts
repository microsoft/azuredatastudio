/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';

import { GetDiagramModelAction } from 'sql/workbench/contrib/diagrams/browser/diagramActions';

const actionRegistry = <IWorkbenchActionRegistry>Registry.as(ActionExtensions.WorkbenchActions);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		GetDiagramModelAction,
		GetDiagramModelAction.ID,
		GetDiagramModelAction.LABEL
	),
	GetDiagramModelAction.LABEL
);
