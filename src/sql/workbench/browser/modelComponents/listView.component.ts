/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnDestroy, ViewChild } from '@angular/core';
import * as azdata from 'azdata';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IListAccessibilityProvider, IListOptions, List } from 'vs/base/browser/ui/list/listWidget';

import 'vs/css!./media/listView';

import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IListRenderer, IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { ILogService } from 'vs/platform/log/common/log';
import { createIconCssClass } from 'sql/workbench/browser/modelComponents/iconUtils';

interface ListViewOption {
	id: string;
	label: string;
	ariaLabel?: string;
	icon?: azdata.IconPath;
	addIconPadding?: boolean;
}

@Component({
	templateUrl: decodeURI(require.toUrl('./listView.component.html'))
})

export default class ListViewComponent extends ComponentBase<azdata.ListViewComponentProperties> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChild('vscodelist', { read: ElementRef }) private _vscodeList: ElementRef;
	private _optionsList!: List<ListViewOption>;
	private _selectedElementIdx!: number;

	static ROW_HEIGHT = 26;

	private iconClasses: string[] = [];

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService
	) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		const vscodelistOption: IListOptions<ListViewOption> = {
			keyboardSupport: true,
			mouseSupport: true,
			smoothScrolling: true,
			verticalScrollMode: ScrollbarVisibility.Auto,
			accessibilityProvider: new OptionsListAccessibilityProvider(this)
		};

		this._optionsList = new List<ListViewOption>('ModelViewListView',
			this._vscodeList.nativeElement,
			new OptionListDelegate(ListViewComponent.ROW_HEIGHT), [new OptionsListRenderer()],
			vscodelistOption);
		this._register(attachListStyler(this._optionsList, this.themeService));

		this._register(this._optionsList.onDidChangeSelection((e) => {
			if (e.indexes.length !== 0) {
				this.selectOptionByIdx(e.indexes[0]);
			}
		}));

		this._register(this._optionsList.onKeyDown((event: any) => {
			if (!this.enabled || this.options.length === 0) {
				return;
			}
			let e = new StandardKeyboardEvent(event);
			if (e.keyCode === KeyCode.Space) {
				this._optionsList.setSelection([this._optionsList.getFocus()[0]]);
				DOM.EventHelper.stop(e, true);
			}
		}));
		this.baseInit();
	}

	setLayout(layout: any): void {
		this.layout();
	}

	override ngOnDestroy(): void {
		this.iconClasses.forEach((icon) => {
			DOM.removeCSSRulesContainingSelector(icon);
		});
		this.baseDestroy();
	}

	public get options(): ListViewOption[] {
		const options = <ListViewOption[]>this.getProperties().options ?? [];
		if (options.find(o => o.icon !== undefined)) {
			options.forEach(o => o.addIconPadding = true);
		}
		return options;
	}

	public override get width(): string | number | undefined {
		return this.getProperties().width ?? undefined;
	}

	public override get height(): string | number | undefined {
		return this.getProperties().height ?? undefined;
	}

	public get title(): azdata.ListViewTitle {
		return this.getProperties().title ?? undefined;
	}

	public get selectedOptionId(): string | undefined {
		return this.getProperties().selectedOptionId ?? undefined;
	}

	public override setProperties(properties: { [key: string]: any }) {
		super.setProperties(properties);
		if (this.options) {
			this._optionsList!.splice(0, this._optionsList!.length, this.options);
			let height = (<number>this.height) ?? (this.options.length * ListViewComponent.ROW_HEIGHT);
			this._optionsList.layout(height);
		}

		// This is the entry point for the extension to set the selectedOptionId
		if (this.selectedOptionId) {
			this._optionsList.setSelection([this.options.map(v => v.id).indexOf(this.selectedOptionId)]);
		}
		this._optionsList.ariaLabel = this.ariaLabel;
	}

	public selectOptionByIdx(idx: number): void {
		if (!this.enabled || this.options.length === 0) {
			return;
		}
		this._selectedElementIdx = idx;
		const selectedOption = this.options[idx];
		this.setPropertyFromUI<string | undefined>((props, value) => props.selectedOptionId = value, selectedOption.id);
		this.fireEvent({
			eventType: ComponentEventType.onDidClick,
			args: {
				id: selectedOption.id
			}
		});
	}

	public override focus(): void {
		super.focus();
		if (this._selectedElementIdx !== undefined) {
			this._optionsList.domFocus();
			const focusElement = (this._selectedElementIdx === undefined) ? 0 : this._selectedElementIdx;
			this._optionsList.setFocus([focusElement]);
		}
	}

	public override get CSSStyles(): azdata.CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'width': super.CSSStyles['width'] ?? this.getWidth(),
			'height': super.CSSStyles['height'] ?? this.getHeight()
		});
	}
}

class OptionListDelegate implements IListVirtualDelegate<ListViewOption> {
	constructor(
		private _height: number
	) {
	}

	public getHeight(element: ListViewOption): number {
		return this._height;
	}

	public getTemplateId(element: ListViewOption): string {
		return 'optionListRenderer';
	}
}

interface ExtensionListTemplate {
	parent: HTMLElement;
	root: HTMLElement;
	labelContainer: HTMLElement;
	iconContainer: HTMLElement;
}

class OptionsListRenderer implements IListRenderer<ListViewOption, ExtensionListTemplate> {
	public static TEMPLATE_ID = 'optionListRenderer';

	public get templateId(): string {
		return OptionsListRenderer.TEMPLATE_ID;
	}

	public renderTemplate(container: HTMLElement): ExtensionListTemplate {
		const tableTemplate: ExtensionListTemplate = Object.create(null);
		tableTemplate.parent = container;
		tableTemplate.root = DOM.append(container, DOM.$('div.list-row.listview-option'));
		tableTemplate.iconContainer = DOM.$('div.list-row.listview-option-icon');
		tableTemplate.labelContainer = DOM.$('div.list-row.listview-option-label');
		DOM.append(tableTemplate.root, tableTemplate.iconContainer);
		DOM.append(tableTemplate.root, tableTemplate.labelContainer);
		return tableTemplate;
	}

	public renderElement(option: ListViewOption, index: number, templateData: ExtensionListTemplate): void {
		templateData.labelContainer.innerText = option.label ?? '';
		if (option.icon) {
			templateData.iconContainer.style.display = '';
			templateData.iconContainer.classList.add('icon');
			templateData.iconContainer.classList.add(createIconCssClass(option.icon));
		} else {
			if (!option.addIconPadding) {
				templateData.iconContainer.style.display = 'none';
			} else {
				templateData.iconContainer.style.display = '';
				templateData.iconContainer.className = '';
				templateData.iconContainer.classList.add('list-row', 'listview-option-icon');
			}
		}
		templateData.parent.title = option.label ?? '';
		templateData.parent.setAttribute('aria-label', option.ariaLabel ?? option.label ?? '');
	}

	public disposeTemplate(template: ExtensionListTemplate): void {
		// noop
	}

	public disposeElement(element: ListViewOption, index: number, templateData: ExtensionListTemplate): void {
		// noop
	}
}

class OptionsListAccessibilityProvider implements IListAccessibilityProvider<ListViewOption> {

	constructor(private _listViewComponent: ListViewComponent) { }

	getAriaLabel(element: ListViewOption): string {
		return element.label;
	}

	getWidgetAriaLabel(): string {
		return this._listViewComponent.ariaLabel;
	}

	getRole(element: ListViewOption): string {
		// Currently hardcode this to option since we don't support nested lists (which would use listitem)
		return 'option';
	}

	getWidgetRole(): string {
		return 'listbox';
	}

}
