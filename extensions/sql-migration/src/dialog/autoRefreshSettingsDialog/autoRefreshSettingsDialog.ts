
import * as azdata from 'azdata';
import * as EventEmitter from 'events';
import { SupportedAutoRefreshIntervals } from '../../api/utils';
import * as loc from '../../constants/strings';

export class AutoRefreshSettingsDialog {
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _selectionEvent: EventEmitter = new EventEmitter();
	private _selectedInterval!: SupportedAutoRefreshIntervals;

	constructor(presetValue: SupportedAutoRefreshIntervals) {
		this._dialogObject = azdata.window.createModelViewDialog(
			'',
			'AutoRefreshSettingsDialog',
			250,
			'callout',
			'left',
			false,
			true,
			<azdata.window.IDialogProperties>{
				height: 16,
				width: 16,
				xPos: 0,
				yPos: 0
			});
		this._selectedInterval = presetValue;
	}

	async initialize(): Promise<AutoRefreshSetting> {
		let tab = azdata.window.createTab('');
		await tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;
			const selectRefreshLabel = view.modelBuilder.text().withProps({
				value: loc.SELECT_THE_REFRESH_INTERVAL,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold',
				}
			}).component();

			const buttonGroup = 'refreshButtonGroup';

			const option0 = view.modelBuilder.radioButton().withProps({
				label: loc.OFF,
				name: buttonGroup,
				checked: this._selectedInterval === -1
			}).component();
			option0.onDidClick(e => {
				this._selectionEvent.emit('done', -1);
			});

			const option1 = view.modelBuilder.radioButton().withProps({
				label: loc.EVERY_30_SECOND,
				name: buttonGroup,
				checked: this._selectedInterval === 30000
			}).component();
			option1.onDidClick(e => {
				this._selectionEvent.emit('done', 30000);
			});
			const option2 = view.modelBuilder.radioButton().withProps({
				label: loc.EVERY_1_MINUTE,
				name: buttonGroup,
				checked: this._selectedInterval === 60000
			}).component();
			option2.onDidClick(e => {
				this._selectionEvent.emit('done', 60000);
			});
			const option3 = view.modelBuilder.radioButton().withProps({
				label: loc.EVERY_3_MINUTES,
				name: buttonGroup,
				checked: this._selectedInterval === 180000
			}).component();
			option3.onDidClick(e => {
				this._selectionEvent.emit('done', 180000);
			});
			const option4 = view.modelBuilder.radioButton().withProps({
				label: loc.EVERY_5_MINUTES,
				name: buttonGroup,
				checked: this._selectedInterval === 300000
			}).component();
			option4.onDidClick(e => {
				this._selectionEvent.emit('done', 300000);
			});
			const container = this._view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column'
			}).withItems([
				selectRefreshLabel,
				option0,
				option1,
				option2,
				option3,
				option4
			]).component();

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: container
					}
				],
				{
					horizontal: false
				}
			);
			const form = formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
		this._dialogObject.okButton.label = 'Apply';
		this._dialogObject.content = [tab];
		azdata.window.openDialog(this._dialogObject);
		return new Promise((resolve) => {
			this._selectionEvent.once('done', (selectedInterval: SupportedAutoRefreshIntervals) => {
				azdata.window.closeDialog(this._dialogObject);
				resolve({
					buttonText: loc.AUTO_REFRESH_BUTTON_TEXT(selectedInterval),
					interval: selectedInterval
				});
			});
		});
	}
}

export interface AutoRefreshSetting {
	buttonText: string;
	interval: SupportedAutoRefreshIntervals;
}
