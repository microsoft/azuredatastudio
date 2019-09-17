/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';
import 'vs/css!./outputArea';
import { OnInit, Component, Input, Inject, ElementRef, ViewChild, forwardRef, ChangeDetectorRef } from '@angular/core';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { ICellModel } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import * as themeColors from 'vs/workbench/common/theme';
import { IWorkbenchThemeService, IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { URI } from 'vs/base/common/uri';

export const OUTPUT_AREA_SELECTOR: string = 'output-area-component';

@Component({
	selector: OUTPUT_AREA_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./outputArea.component.html'))
})
export class OutputAreaComponent extends AngularDisposable implements OnInit {
	@ViewChild('outputarea', { read: ElementRef }) private outputArea: ElementRef;
	@Input() cellModel: ICellModel;

	private _activeCellId: string;

	constructor(
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		super();
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		if (this.cellModel) {
			this._register(this.cellModel.onOutputsChanged(e => {
				if (!(this._changeRef['destroyed'])) {
					this._changeRef.detectChanges();
					if (e && e.shouldScroll) {
						this.setFocusAndScroll(this.outputArea.nativeElement);
					}
				}
			}));
		}
	}

	public get isTrusted(): boolean {
		return this.cellModel.trustedMode;
	}

	public get notebookUri(): URI {
		return this.cellModel.notebookModel.notebookUri;
	}

	private setFocusAndScroll(node: HTMLElement): void {
		if (node) {
			node.focus();
			node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	private updateTheme(theme: IColorTheme): void {
		let outputElement = <HTMLElement>this.outputArea.nativeElement;
		outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}
}
