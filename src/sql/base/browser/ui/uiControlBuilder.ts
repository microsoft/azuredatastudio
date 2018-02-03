/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button } from 'sql/base/browser/ui/button/button';
import views = require('views');

export enum ControlTypes {
	button = 0
}

export function addButton(info: views.UIControl, container: any): void {
	let button = new Button(container);
	button.id = info.id;
	let buttonInfo = <views.Button>info.control;
	button.label = buttonInfo.label;
	button.onDidClick (() => {
		let args: views.ControlEventArgs = {
			type: info.type,
			id: button.id,
			event: 'onclick'
		};
		parent.postMessage(args, '*');
	});
}

export function addControl(info: views.UIControl, container: any) {
	if (info.type === ControlTypes.button) {
		addButton(info, container);
	}
}
