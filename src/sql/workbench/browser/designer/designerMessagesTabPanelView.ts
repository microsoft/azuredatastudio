/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Disposable } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { DesignerPropertyPath, DesignerValidationError } from 'sql/workbench/browser/designer/interfaces';
import { Emitter, Event } from 'vs/base/common/event';
import { IListAccessibilityProvider, List } from 'vs/base/browser/ui/list/listWidget';
import { IListRenderer, IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { localize } from 'vs/nls';
import { IColorTheme, ICssStyleCollector, IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { problemsErrorIconForeground } from 'vs/platform/theme/common/colorRegistry';
import { Codicon } from 'vs/base/common/codicons';

export class DesignerMessagesTabPanelView extends Disposable implements IPanelView {
	private _container: HTMLElement;
	private _onMessageSelected = new Emitter<DesignerPropertyPath>();
	private _messageList: List<DesignerValidationError>;

	public readonly onMessageSelected: Event<DesignerPropertyPath> = this._onMessageSelected.event;

	constructor(@IThemeService private _themeService: IThemeService) {
		super();
	}

	render(container: HTMLElement): void {
		this._container = container.appendChild(DOM.$('.messages-container'));
		this._messageList = new List<DesignerValidationError>('designerMessageList', this._container, new DesignerMessageListDelegate(), [new TableFilterListRenderer()], {
			multipleSelectionSupport: false,
			keyboardSupport: true,
			mouseSupport: true,
			accessibilityProvider: new DesignerMessagesListAccessibilityProvider()
		});
		this._register(this._messageList.onDidChangeSelection((e) => {
			if (e.elements && e.elements.length === 1) {
				this._onMessageSelected.fire(e.elements[0].propertyPath);
			}
		}));
		this._register(attachListStyler(this._messageList, this._themeService));
	}

	layout(dimension: DOM.Dimension): void {
		this._messageList.layout(dimension.height, dimension.width);
	}

	updateMessages(errors: DesignerValidationError[]) {
		if (this._messageList) {
			this._messageList.splice(0, this._messageList.length, errors);
		}
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const errorForegroundColor = theme.getColor(problemsErrorIconForeground);
	if (errorForegroundColor) {
		collector.addRule(`
		.designer-component .messages-container .message-item .message-icon {
			color: ${errorForegroundColor};
		}
		`);
	}
});

const DesignerMessageListTemplateId = 'DesignerMessageListTemplate';
class DesignerMessageListDelegate implements IListVirtualDelegate<DesignerValidationError> {
	getHeight(element: DesignerValidationError): number {
		return 25;
	}

	getTemplateId(element: DesignerValidationError): string {
		return DesignerMessageListTemplateId;
	}
}

interface DesignerMessageListItemTemplate {
	messageText: HTMLDivElement;
}

class TableFilterListRenderer implements IListRenderer<DesignerValidationError, DesignerMessageListItemTemplate> {
	renderTemplate(container: HTMLElement): DesignerMessageListItemTemplate {
		const data: DesignerMessageListItemTemplate = Object.create(null);
		const messageItem = container.appendChild(DOM.$('.message-item'));
		messageItem.appendChild(DOM.$(`.message-icon${Codicon.error.cssSelector}`));
		data.messageText = messageItem.appendChild(DOM.$('.message-text'));
		return data;
	}

	renderElement(element: DesignerValidationError, index: number, templateData: DesignerMessageListItemTemplate, height: number): void {
		templateData.messageText.innerText = element.message;
	}

	disposeElement?(element: DesignerValidationError, index: number, templateData: DesignerMessageListItemTemplate, height: number): void {
	}

	public disposeTemplate(templateData: DesignerMessageListItemTemplate): void {
	}

	public get templateId(): string {
		return DesignerMessageListTemplateId;
	}
}

class DesignerMessagesListAccessibilityProvider implements IListAccessibilityProvider<DesignerValidationError> {
	getAriaLabel(element: DesignerValidationError): string {
		return element.message;
	}

	getWidgetAriaLabel(): string {
		return localize('designer.MessageListAriaLabel', "Errors");
	}

	getWidgetRole() {
		return 'listbox';
	}

	getRole(element: DesignerValidationError): string {
		return 'option';
	}
}
