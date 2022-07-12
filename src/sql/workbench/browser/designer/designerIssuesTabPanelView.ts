/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Disposable } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { DesignerPropertyPath, DesignerIssue } from 'sql/workbench/browser/designer/interfaces';
import { Emitter, Event } from 'vs/base/common/event';
import { IListAccessibilityProvider, List } from 'vs/base/browser/ui/list/listWidget';
import { IListRenderer, IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { localize } from 'vs/nls';
import { IColorTheme, ICssStyleCollector, IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { problemsErrorIconForeground, problemsInfoIconForeground, problemsWarningIconForeground } from 'vs/platform/theme/common/colorRegistry';
import { Codicon } from 'vs/base/common/codicons';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Link } from 'vs/platform/opener/browser/link';

export class DesignerIssuesTabPanelView extends Disposable implements IPanelView {
	private _container: HTMLElement;
	private _onIssueSelected = new Emitter<DesignerPropertyPath>();
	private _issueList: List<DesignerIssue>;

	public readonly onIssueSelected: Event<DesignerPropertyPath> = this._onIssueSelected.event;

	constructor(
		@IThemeService private _themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super();
	}

	render(container: HTMLElement): void {
		this._container = container.appendChild(DOM.$('.issues-container'));
		this._issueList = new List<DesignerIssue>('designerIssueList', this._container, new DesignerIssueListDelegate(), [this._instantiationService.createInstance(TableFilterListRenderer)], {
			multipleSelectionSupport: false,
			keyboardSupport: true,
			mouseSupport: true,
			accessibilityProvider: new DesignerIssueListAccessibilityProvider()
		});
		this._register(this._issueList.onDidChangeSelection((e) => {
			if (e.elements && e.elements.length === 1) {
				this._onIssueSelected.fire(e.elements[0].propertyPath);
			}
		}));
		this._register(attachListStyler(this._issueList, this._themeService));
	}

	layout(dimension: DOM.Dimension): void {
		this._issueList.layout(dimension.height, dimension.width);
	}

	updateIssues(errors: DesignerIssue[]) {
		if (this._issueList) {
			this._issueList.splice(0, this._issueList.length, errors);
		}
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const errorForegroundColor = theme.getColor(problemsErrorIconForeground);
	const warningForegroundColor = theme.getColor(problemsWarningIconForeground);
	const informationalForegroundColor = theme.getColor(problemsInfoIconForeground);
	if (errorForegroundColor) {
		collector.addRule(`
		.designer-component .issues-container .issue-item .issue-icon.codicon-error {
			color: ${errorForegroundColor};
		}
		.designer-component .issues-container .issue-item .issue-icon.codicon-warning {
			color: ${warningForegroundColor};
		}
		.designer-component .issues-container .issue-item .issue-icon.codicon-info {
			color: ${informationalForegroundColor};
		}
		`);
	}
});

const DesignerIssueListTemplateId = 'DesignerIssueListTemplate';
class DesignerIssueListDelegate implements IListVirtualDelegate<DesignerIssue> {
	getHeight(element: DesignerIssue): number {
		return 25;
	}

	getTemplateId(element: DesignerIssue): string {
		return DesignerIssueListTemplateId;
	}
}

interface DesignerIssueListItemTemplate {
	issueText: HTMLDivElement;
	issueIcon: HTMLDivElement;
	issueMoreInfoLink: HTMLDivElement;
}

class TableFilterListRenderer implements IListRenderer<DesignerIssue, DesignerIssueListItemTemplate> {

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService
	) { }

	renderTemplate(container: HTMLElement): DesignerIssueListItemTemplate {
		const data: DesignerIssueListItemTemplate = Object.create(null);
		const issueItem = container.appendChild(DOM.$('.issue-item'));
		data.issueIcon = issueItem.appendChild(DOM.$(''));
		data.issueText = issueItem.appendChild(DOM.$('.issue-text'));
		data.issueMoreInfoLink = issueItem.appendChild(DOM.$('.issue-more-info'));
		return data;
	}

	renderElement(element: DesignerIssue, index: number, templateData: DesignerIssueListItemTemplate, height: number): void {
		templateData.issueText.innerText = element.description;
		templateData.issueText.title = element.description;
		let iconClass;
		switch (element.severity) {
			case 'warning':
				iconClass = Codicon.warning.classNames;
				break;
			case 'information':
				iconClass = Codicon.info.classNames;
				break;
			default:
				iconClass = Codicon.error.classNames;
				break;
		}
		templateData.issueIcon.className = `issue-icon ${iconClass}`;
		if (element.moreInfoLink) {
			this._instantiationService.createInstance(Link, templateData.issueMoreInfoLink,
				{
					label: localize('designer.moreInfoLink', "More information"),
					href: element.moreInfoLink
				}, undefined);
		} else {
			DOM.clearNode(templateData.issueMoreInfoLink);
		}
	}

	public disposeTemplate(templateData: DesignerIssueListItemTemplate): void {
	}

	public get templateId(): string {
		return DesignerIssueListTemplateId;
	}
}

class DesignerIssueListAccessibilityProvider implements IListAccessibilityProvider<DesignerIssue> {
	getAriaLabel(element: DesignerIssue): string {
		return element.description;
	}

	getWidgetAriaLabel(): string {
		return localize('designer.IssueListAriaLabel', "Issues");
	}

	getWidgetRole() {
		return 'listbox';
	}

	getRole(element: DesignerIssue): string {
		return 'option';
	}
}
