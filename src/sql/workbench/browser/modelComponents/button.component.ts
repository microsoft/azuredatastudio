/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/button';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentWithIconBase } from 'sql/workbench/browser/modelComponents/componentWithIconBase';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';

import { SIDE_BAR_BACKGROUND, SIDE_BAR_TITLE_FOREGROUND } from 'vs/workbench/common/theme';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { focusBorder, foreground } from 'vs/platform/theme/common/colorRegistry';
import { Button } from 'sql/base/browser/ui/button/button';
import { Color } from 'vs/base/common/color';
import { IComponentDescriptor, IComponent, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { convertSize } from 'sql/base/browser/dom';

@Component({
	selector: 'modelview-button',
	template: `
	<div>
		<label for={{this.label}}>
			<div #input style="width: 100%">
				<input #fileInput *ngIf="this.isFile === true" id={{this.label}} type="file" accept="{{ this.fileType }}" style="display: none">
			</div>
		</label>
	</div>
	`
})
export default class ButtonComponent extends ComponentWithIconBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _button: Button;
	public fileType: string = '.sql';

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	@ViewChild('fileInput', { read: ElementRef }) private _fileInputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {
			this._button = new Button(this._inputContainer.nativeElement);

			this._register(this._button);
			this._register(attachButtonStyler(this._button, this.themeService, {
				buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND, buttonForeground: SIDE_BAR_TITLE_FOREGROUND
			}));
			this._register(this._button.onDidClick(e => {
				if (this._fileInputContainer) {
					const self = this;
					this._fileInputContainer.nativeElement.onchange = () => {
						let file = self._fileInputContainer.nativeElement.files[0];
						let reader = new FileReader();
						reader.onload = (e) => {
							let text = (<FileReader>e.target).result;
							self.fileContent = text.toString();
							self.fireEvent({
								eventType: ComponentEventType.onDidClick,
								args: {
									filePath: file.path,
									fileContent: self.fileContent
								}
							});
						};
						reader.readAsText(file);
					};
				} else {
					this.fireEvent({
						eventType: ComponentEventType.onDidClick,
						args: e
					});
				}
			}));
		}
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this._button.enabled = this.enabled;
		this._button.label = this.label;
		if (this.properties.fileType) {
			this.fileType = properties.fileType;
		}
		this._button.title = this.title;

		// Button's ariaLabel gets set to the label by default.
		// We only want to override that if buttonComponent's ariaLabel is set explicitly.
		if (this.ariaLabel) {
			this._button.ariaLabel = this.ariaLabel;
		}

		if (this.width) {
			this._button.setWidth(convertSize(this.width.toString()));
		}
		if (this.height) {
			this._button.setHeight(convertSize(this.height.toString()));
		}
		this.updateIcon();
		this._changeRef.detectChanges();
	}

	public focus(): void {
		this._button.focus();
	}

	protected updateIcon() {
		if (this.iconPath) {
			if (!this._iconClass) {
				super.updateIcon();
				this._button.icon = this._iconClass + ' icon';
				// Styling for icon button
				this._register(attachButtonStyler(this._button, this.themeService, {
					buttonBackground: Color.transparent.toString(),
					buttonHoverBackground: Color.transparent.toString(),
					buttonFocusOutline: focusBorder,
					buttonForeground: foreground
				}));
			} else {
				super.updateIcon();
			}
		}
	}

	// CSS-bound properties

	private get label(): string {
		return this.getPropertyOrDefault<azdata.ButtonProperties, string>((props) => props.label, '');
	}

	private set label(newValue: string) {
		this.setPropertyFromUI<azdata.ButtonProperties, string>(this.setValueProperties, newValue);
	}

	public get isFile(): boolean {
		return this.getPropertyOrDefault<azdata.ButtonProperties, boolean>((props) => props.isFile, false);
	}

	public set isFile(newValue: boolean) {
		this.setPropertyFromUI<azdata.ButtonProperties, boolean>(this.setFileProperties, newValue);
	}

	private get fileContent(): string {
		return this.getPropertyOrDefault<azdata.ButtonProperties, string>((props) => props.fileContent, '');
	}

	private set fileContent(newValue: string) {
		this.setPropertyFromUI<azdata.ButtonProperties, string>(this.setFileContentProperties, newValue);
	}

	private setFileContentProperties(properties: azdata.ButtonProperties, fileContent: string): void {
		properties.fileContent = fileContent;
	}

	private setValueProperties(properties: azdata.ButtonProperties, label: string): void {
		properties.label = label;
	}

	private setFileProperties(properties: azdata.ButtonProperties, isFile: boolean): void {
		properties.isFile = isFile;
	}
}
