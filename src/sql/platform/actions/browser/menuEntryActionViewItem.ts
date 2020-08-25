/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ActionViewItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { IAction } from 'vs/base/common/actions';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { INotificationService } from 'vs/platform/notification/common/notification';

export class RadioButtonActionViewItem extends ActionViewItem {

	constructor(
		public _action: IAction,
		@IContextViewService contextViewService: IContextViewService,
		@INotificationService protected _notificationService: INotificationService,
	) {
		super(contextViewService, _action);
	}

}
