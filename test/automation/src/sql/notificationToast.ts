/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';

export class NotificationToast {

	constructor(private readonly code: Code) { }

	async closeNotificationToasts() {
		const notificationToastSelector = 'div[class="notifications-toasts visible"]';
		const notificationToastCloseButton = `a[class="action-label codicon codicon-notifications-clear"][role="button"]`;
		let numberOfToasts = 0;

		await this.code.waitForElements(notificationToastSelector, false, result => {
			numberOfToasts = result.length;
			return true;
		});

		for (let i = 0; i < numberOfToasts; i++) {
			await this.code.waitAndClick(notificationToastSelector);
			await this.code.waitAndClick(notificationToastCloseButton);
		}
	}
}
