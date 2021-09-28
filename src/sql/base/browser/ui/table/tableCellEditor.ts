import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { getCodeForKeyCode } from 'vs/base/browser/keyboardEvent';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as DOM from 'vs/base/browser/dom';

export interface ITableCellEditorOptions {
	valueGetter?: (item: Slick.SlickData, column: Slick.Column<Slick.SlickData>) => string,
	valueSetter?: (context: any, row: number, item: Slick.SlickData, column: Slick.Column<Slick.SlickData>, value: string) => Promise<void>,
	optionsGetter?: (item: Slick.SlickData, column: Slick.Column<Slick.SlickData>) => string[],
	editorStyler: (component: InputBox | SelectBox) => void
}

export class TableCellEditor {
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
			editorStyler: options.editorStyler
		};
	}

	public getTextEditorClass(context: any, inputType: 'text' | 'number' = 'text'): any {
		const self = this;
		class TextEditor {
			private _originalValue: string;
			private _input: InputBox;
			private _keyCaptureList: number[];

			constructor(private _args: Slick.Editors.EditorOptions<Slick.SlickData>) {
				this.init();
				const keycodesToCapture = [KeyCode.Home, KeyCode.End, KeyCode.UpArrow, KeyCode.DownArrow, KeyCode.LeftArrow, KeyCode.RightArrow];
				this._keyCaptureList = keycodesToCapture.map(keycode => getCodeForKeyCode(keycode));
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
			}

			public destroy(): void {
				this._input.dispose();
			}

			public focus(): void {
				this._input.focus();
			}

			public loadValue(item: Slick.SlickData): void {
				this._originalValue = self._options.valueGetter(item, this._args.column) ?? '';
				this._input.value = this._originalValue;
			}

			public async applyValue(item: Slick.SlickData, state: string): Promise<void> {
				const activeCell = this._args.grid.getActiveCell();
				await self._options.valueSetter(context, activeCell.row, item, this._args.column, state);
			}

			public isValueChanged(): boolean {
				return this._input.value !== this._originalValue.toString();

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

	public getSelectBoxEditorClass(context: any, defaultOptions: string[]): any {
		const self = this;
		class TextEditor {
			private _originalValue: string;
			private _selectBox: SelectBox;
			private _keyCaptureList: number[];

			constructor(private _args: Slick.Editors.EditorOptions<Slick.SlickData>) {
				this.init();
				const keycodesToCapture = [KeyCode.Home, KeyCode.End, KeyCode.UpArrow, KeyCode.DownArrow, KeyCode.LeftArrow, KeyCode.RightArrow];
				this._keyCaptureList = keycodesToCapture.map(keycode => getCodeForKeyCode(keycode));
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
				this._selectBox = new SelectBox([], undefined, self._contextViewProvider);

				container.style.height = '100%';
				container.style.width = '100%';
				this._selectBox.render(container);
				self._options.editorStyler(this._selectBox);
				this._selectBox.focus();
			}

			public destroy(): void {
				this._selectBox.dispose();
			}

			public focus(): void {
				this._selectBox.focus();
			}

			public loadValue(item: Slick.SlickData): void {
				this._originalValue = self._options.valueGetter(item, this._args.column) ?? '';
				const options = self._options.optionsGetter(item, this._args.column) ?? defaultOptions;
				const idx = options?.indexOf(this._originalValue);
				if (idx > -1) {
					this._selectBox.setOptions(options);
					this._selectBox.select(idx);
				}
			}

			public async applyValue(item: Slick.SlickData, state: string): Promise<void> {
				const activeCell = this._args.grid.getActiveCell();
				await self._options.valueSetter(context, activeCell.row, item, this._args.column, state);
			}

			public isValueChanged(): boolean {
				return this._selectBox.value !== this._originalValue.toString();

			}

			public serializeValue(): any {
				return this._selectBox.value;
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
}
