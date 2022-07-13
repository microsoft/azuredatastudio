/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { KeyCode, EVENT_KEY_CODE_MAP } from 'vs/base/common/keyCodes';
import * as DOM from 'vs/base/browser/dom';
import { Dropdown } from 'sql/base/browser/ui/editableDropdown/browser/dropdown';
import { Event } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';

const InverseKeyCodeMap: { [k: string]: number } = Object.fromEntries(Object.entries(EVENT_KEY_CODE_MAP).map(([key, value]) => [value, Number(key)]));

export interface ITableCellEditorOptions {
	valueGetter?: (item: Slick.SlickData, column: Slick.Column<Slick.SlickData>) => string,
	valueSetter?: (context: any, row: number, item: Slick.SlickData, column: Slick.Column<Slick.SlickData>, value: string) => void,
	optionsGetter?: (item: Slick.SlickData, column: Slick.Column<Slick.SlickData>) => string[],
	editorStyler: (component: InputBox | SelectBox | Dropdown) => void,
	onStyleChange: Event<void>;
}

export class TableCellEditorFactory {
	private _options: ITableCellEditorOptions;

	constructor(options: ITableCellEditorOptions, private _contextViewProvider: IContextViewProvider) {
		this._options = {
			valueGetter: options.valueGetter ?? function (item, column) {
				return item[column.field];
			},
			valueSetter: options.valueSetter ?? async function (context, row, item, column, value): Promise<void> {
				item[column.field] = value;
			},
			optionsGetter: options.optionsGetter ?? function (item, column) {
				return [];
			},
			editorStyler: options.editorStyler,
			onStyleChange: options.onStyleChange
		};
	}

	public getTextEditorClass(context: any, inputType: 'text' | 'number' = 'text'): any {
		const self = this;
		class TextEditor extends Disposable {
			private _originalValue: string;
			private _input: InputBox;
			private _keyCaptureList: number[];

			constructor(private _args: Slick.Editors.EditorOptions<Slick.SlickData>) {
				super();
				this.init();
				const keycodesToCapture = [KeyCode.Home, KeyCode.End, KeyCode.UpArrow, KeyCode.DownArrow, KeyCode.LeftArrow, KeyCode.RightArrow];
				this._keyCaptureList = keycodesToCapture.map(keycode => InverseKeyCodeMap[keycode]);
			}

			/**
			 * The text editor should handle these key press events to avoid event bubble up
			 */
			public get keyCaptureList(): number[] {
				return this._keyCaptureList;
			}

			public init(): void {
				this._input = new InputBox(this._args.container, self._contextViewProvider, {
					type: inputType
				});
				self._options.editorStyler(this._input);
				this._input.element.style.height = '100%';
				this._input.focus();
				this._input.onLoseFocus(async () => {
					await this.commitEdit();
				});
				this._register(this._input);
				this._register(self._options.onStyleChange(() => {
					self._options.editorStyler(this._input);
				}));
			}

			private async commitEdit(): Promise<void> {
				if (this.isValueChanged()) {
					const item = this._args.grid.getDataItem(this._args.grid.getActiveCell().row);
					await this.applyValue(item, this._input.value);
					this._originalValue = this._input.value;
				}
			}

			public destroy(): void {
				this.dispose();
			}

			public focus(): void {
				this._input.focus();
			}

			public loadValue(item: Slick.SlickData): void {
				this._originalValue = self._options.valueGetter(item, this._args.column) ?? '';
				this._input.value = this._originalValue;
			}

			public applyValue(item: Slick.SlickData, state: string): void {
				const activeCell = this._args.grid.getActiveCell();
				self._options.valueSetter(context, activeCell.row, item, this._args.column, state);
			}

			public isValueChanged(): boolean {
				return this._input.value !== this._originalValue;
			}

			public serializeValue(): any {
				return this._input.value;
			}

			public validate(): Slick.ValidateResults {
				return {
					valid: true,
					msg: undefined
				};
			}
		}
		return TextEditor;
	}

	public getDropdownEditorClass(context: any, defaultOptions: string[], isEditable?: boolean): any {
		const self = this;
		class DropdownEditor extends Disposable {
			private _originalValue: string;
			private _component: SelectBox | Dropdown;
			private _keyCaptureList: number[];

			constructor(private _args: Slick.Editors.EditorOptions<Slick.SlickData>) {
				super();
				this.init();
				const keycodesToCapture = [KeyCode.Home, KeyCode.End, KeyCode.UpArrow, KeyCode.DownArrow, KeyCode.LeftArrow, KeyCode.RightArrow];
				this._keyCaptureList = keycodesToCapture.map(keycode => InverseKeyCodeMap[keycode]);
			}

			/**
			 * The text editor should handle these key press events to avoid event bubble up
			 */
			public get keyCaptureList(): number[] {
				return this._keyCaptureList;
			}

			public init(): void {
				const container = DOM.$('');
				this._args.container.appendChild(container);
				container.style.height = '100%';
				container.style.width = '100%';
				if (isEditable) {
					this._component = new Dropdown(container, self._contextViewProvider);
					this._component.onValueChange(async () => {
						await this.commitEdit();
					});
					this._component.onBlur(async () => {
						await this.commitEdit();
					});
				} else {
					this._component = new SelectBox([], undefined, self._contextViewProvider);
					this._component.render(container);
					this._component.selectElem.style.height = '100%';
					this._component.onDidSelect(async () => {
						await this.commitEdit();
					});
				}
				self._options.editorStyler(this._component);
				this._component.focus();
				this._register(this._component);
				this._register(self._options.onStyleChange(() => {
					self._options.editorStyler(this._component);
				}));
			}

			private async commitEdit(): Promise<void> {
				if (this.isValueChanged()) {
					const item = this._args.grid.getDataItem(this._args.grid.getActiveCell().row);
					await this.applyValue(item, this._component.value);
					this._originalValue = this._component.value;
				}
			}

			public destroy(): void {
				this.dispose();
			}

			public focus(): void {
				this._component.focus();
			}

			public loadValue(item: Slick.SlickData): void {
				this._originalValue = self._options.valueGetter(item, this._args.column) ?? '';
				const options = self._options.optionsGetter(item, this._args.column) ?? defaultOptions;
				const idx = options?.indexOf(this._originalValue);
				if (idx > -1) {
					if (this._component instanceof Dropdown) {
						this._component.values = options;
						this._component.value = options[idx];
					} else {
						this._component.setOptions(options);
						this._component.select(idx);
					}
				}
			}

			public async applyValue(item: Slick.SlickData, state: string): Promise<void> {
				const activeCell = this._args.grid.getActiveCell();
				await self._options.valueSetter(context, activeCell.row, item, this._args.column, state);
			}

			public isValueChanged(): boolean {
				return this._component.value !== this._originalValue;
			}

			public serializeValue(): any {
				return this._component.value;
			}

			public validate(): Slick.ValidateResults {
				return {
					valid: true,
					msg: undefined
				};
			}
		}
		return DropdownEditor;
	}
}
