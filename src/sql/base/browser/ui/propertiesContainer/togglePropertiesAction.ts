/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';

export class TogglePropertiesAction extends Action {
	private static readonly ID = 'TogglePropertiesAction';
	private static readonly COLLPASE_LABEL = nls.localize('hideProperties', "Hide properties");
	private static readonly EXPAND_LABEL = nls.localize('showProperties', "Show Properties");
	private static readonly COLLAPSE_ICON = 'codicon-chevron-up';
	private static readonly EXPAND_ICON = 'codicon-chevron-down';

	constructor(
	) {
		super(TogglePropertiesAction.ID, TogglePropertiesAction.COLLPASE_LABEL, TogglePropertiesAction.COLLAPSE_ICON);
		this.expanded = true;
	}

	override async run(): Promise<void> {
		this.expanded = !this.expanded;
		this.class = this.expanded ? TogglePropertiesAction.COLLAPSE_ICON : TogglePropertiesAction.EXPAND_ICON;
		this.label = this.expanded ? TogglePropertiesAction.COLLPASE_LABEL : TogglePropertiesAction.EXPAND_LABEL;
	}
}
