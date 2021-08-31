/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { INotebookView } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { DragAndDropObserver, LocalSelectionTransfer } from 'vs/workbench/browser/dnd';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { TAB_INACTIVE_BACKGROUND } from 'vs/workbench/common/theme';

@Component({
	selector: 'view-card-tab-component',
	template: `
	<ng-template #templateRef>
		<div #tab class="tab tab-actions-right sizing-fit" role="tab" draggable="true">
			<div class="monaco-icon-label file-icon tabstitlecontrol.ts-name-file-icon ts-ext-file-icon ext-file-icon typescript-lang-file-icon tab-label tab-label-has-badge"><div class="monaco-icon-label-container" title="{{title}}"><span class="monaco-icon-name-container"><a class="label-name">{{title}}</a></span><span class="monaco-icon-description-container"></span></div></div>
		</div>
	</ng-template>`
})
export class NotebookViewsCardTabComponent extends AngularDisposable implements OnInit {
	@Input() model: NotebookModel;
	@Input() activeView: INotebookView;
	@Input() ready: boolean;
	@Input() cells: ICellModel[];
	@Input() title: string;
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

		this._register(addDisposableListener(this._tab.nativeElement, EventType.DRAG_START, e => {
			this.tabTransfer.setData([this], NotebookViewsCardTabComponent.prototype);
		}));

		// Drop support
		this._register(new DragAndDropObserver(this._tab.nativeElement, {
			onDragEnter: e => {
				//console.log(`Dragging ${title}`);
				//this.tabTransfer.setData([this], NotebookViewsCardTabComponent.prototype);
			},

			onDragLeave: e => {
			},

			onDragEnd: e => {
				this.tabTransfer.clearData(NotebookViewsCardTabComponent.prototype);
			},

			onDrop: e => {
				/*
				if (this.tabTransfer.hasData(NotebookViewsCardTabComponent.prototype)) {
					const data = this.tabTransfer.getData(NotebookViewsCardTabComponent.prototype);
					if (Array.isArray(data)) {
						const fromTab = data[0].title;
						const toTab = title;
					}
				}
				*/
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

	get elementRef(): ElementRef {
		return this._tab;
	}

	public detectChanges() {
		this._changeRef.detectChanges();
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const background = theme.getColor(TAB_INACTIVE_BACKGROUND);
	if (background) {
		collector.addRule(`
		.tab {
			background-color: ${background.toString()};
		}
		`);
	}
});
