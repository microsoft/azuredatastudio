/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { ResourceViewerInput } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';

export class ResourceViewerRefresh extends Action {
	public static readonly ID = 'resourceViewer.refresh';
	public static readonly LABEL = nls.localize('resourceViewer.refresh', "Refresh");

	constructor() {
		super(ResourceViewerRefresh.ID, ResourceViewerRefresh.LABEL, 'codicon refresh');
	}

	public override async run(input: ResourceViewerInput): Promise<void> {
		this.enabled = false;
		try {
			await input.refresh();
		} finally {
			this.enabled = true;
		}

	}
}
