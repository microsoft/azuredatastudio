/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { INotebookView, INotebookViewCard, INotebookViewsTab } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { LocalSelectionTransfer } from 'vs/workbench/browser/dnd';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { EventType as TouchEventType, GestureEvent } from 'vs/base/browser/touch';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { TAB_ACTIVE_BACKGROUND, TAB_BORDER, TAB_INACTIVE_BACKGROUND } from 'vs/workbench/common/theme';
import { localize } from 'vs/nls';

@Component({
	selector: 'view-card-tab-component',
	template: `
	<ng-template #templateRef>
		<div #tab [class]="activeClass + ' tab tab-actions-right sizing-fit'" role="tab" draggable="true">
			<div class="monaco-icon-label file-icon tabstitlecontrol.ts-name-file-icon ts-ext-file-icon ext-file-icon typescript-lang-file-icon tab-label tab-label-has-badge"><div class="monaco-icon-label-container" title="{{title}}"><span class="monaco-icon-name-container"><a class="label-name">{{title}}</a></span><span class="monaco-icon-description-container"></span></div></div>
			<div class="tab-actions"><div class="monaco-action-bar animated"><ul class="actions-container" role="toolbar" aria-label="Tab actions"><li class="action-item" role="presentation"><a class="action-label codicon codicon-close" role="button" title="Close (Ctrl+F4)" tabindex="0"></a></li></ul></div></div>
		</div>
	</ng-template>`
})
export class NotebookViewsCardTabComponent extends AngularDisposable implements OnInit {
	@Input() model: NotebookModel;
	@Input() activeView: INotebookView;
	@Input() ready: boolean;
	@Input() cell: ICellModel;
	@Input() active: boolean;
	@Input() card: INotebookViewCard;
	@Input() tab: INotebookViewsTab;
	@Input() tabTransfer: LocalSelectionTransfer<NotebookViewsCardTabComponent>;

	@ViewChild('templateRef') templateRef: TemplateRef<any>;
	@ViewChild('tab', { read: ElementRef }) private _tab: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		super();
	}

	ngOnInit() {
		//this.initialize();
	}

	ngAfterViewInit(): void {
		this.initialize();
	}

	public initialize(): void {
		const title = this.title;

		const handleClickOrTouch = (e: MouseEvent | GestureEvent): void => {
			this._tab.nativeElement.blur(); // prevent flicker of focus outline on tab until editor got focus

			if (e instanceof MouseEvent && e.button !== 0) {
				if (e.button === 1) {
					e.preventDefault(); // required to prevent auto-scrolling (https://github.com/microsoft/vscode/issues/16690)
				}

				return undefined; // only for left mouse click
			}


			return undefined;
		};


		this._register(addDisposableListener(this._tab.nativeElement, EventType.MOUSE_DOWN, e => handleClickOrTouch(e)));
		this._register(addDisposableListener(this._tab.nativeElement, TouchEventType.Tap, (e: GestureEvent) => handleClickOrTouch(e)));

		this._register(addDisposableListener(this._tab.nativeElement, EventType.DRAG_START, e => {
			this.tabTransfer.setData([this], NotebookViewsCardTabComponent.prototype);
		}));

		this._register(addDisposableListener(this._tab.nativeElement, EventType.DROP, e => {
			if (this.tabTransfer.hasData(NotebookViewsCardTabComponent.prototype)) {
				const data = this.tabTransfer.getData(NotebookViewsCardTabComponent.prototype);
				if (Array.isArray(data)) {
					const fromTab = data[0].title;
					const toTab = title;
					this.activeView.moveTab(data[0].tab, 0, this.card);//Add fromCard
					//Notify view component of change
				}
			}
		}));

		this.detectChanges();
	}

	ngAfterContentInit() {
		this.detectChanges();
	}

	ngOnChanges() {
		this.detectChanges();
	}

	public get title(): string {
		return this.tab ? this.tab.title : localize('nbTab.untitled', 'Untitled');
	}

	public get activeClass(): string {
		return this.active ? 'active' : '';
	}

	public onTabClicked() {
	}

	get elementRef(): ElementRef {
		return this._tab;
	}

	public detectChanges() {
		this._changeRef.detectChanges();
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const border = theme.getColor(TAB_BORDER);

	const background = theme.getColor(TAB_INACTIVE_BACKGROUND);
	const activeBackground = theme.getColor(TAB_ACTIVE_BACKGROUND);

	if (background && border) {
		collector.addRule(`
		view-card-tabs-component .tabs-container > .tab {
			border-color: ${border.toString()};
			background-color: ${background.toString()};
		}
		`);
	}

	if (activeBackground) {
		collector.addRule(`
		view-card-tabs-component .tabs-container > .tab.active {
			background-color: ${activeBackground.toString()};
		}
		`);
	}
});
