/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotification, INotificationHandle, INotificationService, IPromptChoice, IPromptChoiceWithMenu, IPromptOptions, IStatusMessageOptions, NotificationMessage, NotificationsFilter, Severity } from 'vs/platform/notification/common/notification';
import { Event, IDisposable } from 'vs/workbench/workbench.web.main';

export class TestNotificationService implements INotificationService {
	_serviceBrand: undefined;
	onDidAddNotification: Event<INotification>;
	onDidRemoveNotification: Event<INotification>;

	notify(notification: INotification): INotificationHandle {
		throw new Error('Method not implemented.');
	}
	info(message: NotificationMessage | NotificationMessage[]): void {
		throw new Error('Method not implemented.');
	}
	warn(message: NotificationMessage | NotificationMessage[]): void {
		throw new Error('Method not implemented.');
	}
	error(message: NotificationMessage | NotificationMessage[]): void {
		throw new Error('Method not implemented.');
	}
	prompt(severity: Severity, message: string, choices: (IPromptChoice | IPromptChoiceWithMenu)[], options?: IPromptOptions): INotificationHandle {
		throw new Error('Method not implemented.');
	}
	status(message: NotificationMessage, options?: IStatusMessageOptions): IDisposable {
		throw new Error('Method not implemented.');
	}
	setFilter(filter: NotificationsFilter): void {
		throw new Error('Method not implemented.');
	}

}
