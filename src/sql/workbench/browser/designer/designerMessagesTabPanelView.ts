/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Disposable } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { DesignerValidationError } from 'sql/workbench/browser/designer/interfaces';

export class DesignerMessagesTabPanelView extends Disposable implements IPanelView {
	private _container: HTMLElement;

	render(container: HTMLElement): void {
		this._container = container.appendChild(DOM.$('.messages-container'));
	}

	layout(dimension: DOM.Dimension): void {
	}

	updateMessages(errors: DesignerValidationError[]) {
		if (this._container) {
			DOM.clearNode(this._container);
			errors?.forEach(error => {
				const messageItem = this._container.appendChild(DOM.$('.message-item.codicon.error'));
				messageItem.innerText = error.message;
			});
		}
	}
}
