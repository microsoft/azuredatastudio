/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as GridContentEvents from 'sql/parts/grid/common/gridContentEvents';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { EditDataEditor } from 'sql/parts/editData/editor/editDataEditor';

import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

function runActionOnActiveResultsEditor(accessor: ServicesAccessor, eventName: string): void {
	let editorService = accessor.get(IEditorService);
	const candidates = [editorService.activeControl, ...editorService.visibleControls].filter(e => {
		if (e) {
			let id = e.getId();
			if (id === QueryEditor.ID || id === EditDataEditor.ID) {
				// This is a query or edit data editor
				return true;
			}
		}
		return false;
	});

	if (candidates.length > 0) {
		let queryModelService: IQueryModelService = accessor.get(IQueryModelService);
		let uri = (<any>candidates[0].input).uri;
		queryModelService.sendGridContentEvent(uri, eventName);
	}
}

export const copySelection = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.CopySelection);
};

export const copyMessagesSelection = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.CopyMessagesSelection);
};

export const copyWithHeaders = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.CopyWithHeaders);
};

export const toggleMessagePane = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.ToggleMessagePane);
};

export const toggleResultsPane = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.ToggleResultPane);
};

export const goToNextQueryOutputTab = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.GoToNextQueryOutputTab);
};

export const saveAsCsv = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.SaveAsCsv);
};

export const saveAsJson = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.SaveAsJSON);
};

export const saveAsExcel = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.SaveAsExcel);
};

export const saveAsXml = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.SaveAsXML);
};

export const selectAll = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.SelectAll);
};

export const selectAllMessages = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.SelectAllMessages);
};

export const viewAsChart = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.ViewAsChart);
};

export const goToNextGrid = (accessor: ServicesAccessor) => {
	runActionOnActiveResultsEditor(accessor, GridContentEvents.GoToNextGrid);
};

