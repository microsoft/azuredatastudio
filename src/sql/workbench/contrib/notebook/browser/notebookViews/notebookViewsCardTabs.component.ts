/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./notebookViewsCardTabs';
import { ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { INotebookView, INotebookViewCard, INotebookViewsTab } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { NotebookViewsCardTabComponent } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsCardTab.components';
import { LocalSelectionTransfer } from 'vs/workbench/browser/dnd';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { TAB_BORDER, EDITOR_GROUP_HEADER_TABS_BACKGROUND } from 'vs/workbench/common/theme';

@Component({
	selector: 'view-card-tabs-component',
	templateUrl: decodeURI(require.toUrl('./notebookViewsCardTabs.component.html'))
})
export class NotebookViewsCardTabsComponent extends AngularDisposable implements OnInit {
	@Input() card: INotebookViewCard;
	@Input() tabs: INotebookViewsTab[];
	@Input() activeView: INotebookView;
	@Input() activeTab: INotebookViewsTab;
	@Input() tabTransfer: LocalSelectionTransfer<NotebookViewsCardTabComponent>;

	@ViewChild('templateRef') templateRef: TemplateRef<any>;
	@ViewChild('tabsContainer', { read: ElementRef }) private _tabsContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		super();
	}

	ngOnInit() { }

	ngAfterViewInit(): void {
		this.initialize();
	}

	public initialize(): void {

		this.detectChanges();
	}

	ngAfterContentInit() {
		this.detectChanges();
	}

	ngOnChanges() {
		this.detectChanges();
	}

	onSelectedTabChanged(tab: INotebookViewsTab): void {
	}

	get elementRef(): ElementRef {
		return this._tabsContainer;
	}

	public detectChanges() {
		this._changeRef.detectChanges();
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const background = theme.getColor(EDITOR_GROUP_HEADER_TABS_BACKGROUND);
	const border = theme.getColor(TAB_BORDER);

	if (background && border) {
		collector.addRule(`
		view-card-tabs-component > .tabs-and-actions-container {
			border-color: ${border.toString()};
			background-color: ${background.toString()};
		}
		`);
	}
});
