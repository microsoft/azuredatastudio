/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./notebookViewsModal';
import { Component, Input } from '@angular/core';
import { calloutDialogBodyBackground, calloutDialogForeground, calloutDialogInteriorBorder } from 'sql/platform/theme/common/colorRegistry';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';

@Component({
	selector: 'notebook-views-modal-component',
	template: `
		<div [class.modal]="displayInputModal">
			<div class="content">
				<div class="title">{{title}}</div>
				<ng-content></ng-content>
			</div>
		</div>
	`
})
export class NotebookViewsModalComponent {
	@Input() title: boolean;
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const foreground = theme.getColor(calloutDialogForeground);
	if (foreground) {
		collector.addRule(`notebook-views-grid-component .modal { position: absolute; background: ${foreground};}`);
	}

	const internalBorder = theme.getColor(calloutDialogInteriorBorder);
	if (internalBorder) {
		collector.addRule(`notebook-views-grid-component .modal .content { border-color: ${internalBorder};  }`);
		collector.addRule(`notebook-views-grid-component .modal .content .title { border-color: ${internalBorder}; }`);
	}

	const bodyBackground = theme.getColor(calloutDialogBodyBackground);
	if (bodyBackground) {
		collector.addRule(`notebook-views-grid-component .modal .content { background: ${bodyBackground}; }`);
	}
});
