/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import { MigrationStateModel } from '../../models/stateMachine';
import { WizardController } from '../../wizard/wizardController';
import * as styles from '../../constants/styles';
import { ServiceContextChangeEvent } from '../../dashboard/tabBase';

export class SavedAssessmentDialog {

	private static readonly OkButtonText: string = constants.NEXT_LABEL;
	private static readonly CancelButtonText: string = constants.CANCEL_LABEL;

	private dialog: azdata.window.Dialog | undefined;
	private stateModel: MigrationStateModel;
	private context: vscode.ExtensionContext;
	private _serviceContextChangedEvent: vscode.EventEmitter<ServiceContextChangeEvent>;
	private _disposables: vscode.Disposable[] = [];
	private _isOpen: boolean = false;
	private _rootContainer!: azdata.FlexContainer;

	constructor(
		context: vscode.ExtensionContext,
		stateModel: MigrationStateModel,
		serviceContextChangedEvent: vscode.EventEmitter<ServiceContextChangeEvent>) {
		this.stateModel = stateModel;
		this.context = context;
		this._serviceContextChangedEvent = serviceContextChangedEvent;
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					this._rootContainer = this.initializePageContent(view);
					await view.initializeModel(this._rootContainer);
					this._disposables.push(
						dialog.okButton.onClick(
							async e => await this.execute()));

					this._disposables.push(
						dialog.cancelButton.onClick(
							e => this.cancel()));
					this._disposables.push(
						view.onClosed(
							e => this._disposables.forEach(
								d => { try { d.dispose(); } catch { } })));

					resolve();
				} catch (ex) {
					reject(ex);
				}
			});

			dialog.registerCloseValidator(async () => {
				if (this.stateModel.resumeAssessment) {
					if (!this.stateModel.loadSavedInfo()) {
						void vscode.window.showInformationMessage(constants.OPEN_SAVED_INFO_ERROR);
						return false;
					}
				}
				return true;
			});
		});
	}

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(constants.SAVED_ASSESSMENT_RESULT, constants.SAVED_ASSESSMENT_RESULT, '60%');
			this.dialog.okButton.label = SavedAssessmentDialog.OkButtonText;
			this.dialog.okButton.position = 'left';
			this.dialog.cancelButton.label = SavedAssessmentDialog.CancelButtonText;
			this.dialog.cancelButton.position = 'left';

			const dialogSetupPromises: Thenable<void>[] = [];
			dialogSetupPromises.push(this.initializeDialog(this.dialog));
			azdata.window.openDialog(this.dialog);
			await Promise.all(dialogSetupPromises);
		}
	}

	protected async execute() {
		const wizardController = new WizardController(
			this.context,
			this.stateModel,
			this._serviceContextChangedEvent);

		await wizardController.openWizard();
		this._isOpen = false;
	}

	protected cancel() {
		this._isOpen = false;
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}

	public initializePageContent(view: azdata.ModelView): azdata.FlexContainer {
		const buttonGroup = 'resumeMigration';

		const radioStart = view.modelBuilder.radioButton()
			.withProps({
				label: constants.START_NEW_SESSION,
				name: buttonGroup,
				CSSStyles: { ...styles.BODY_CSS, 'margin-bottom': '8px' },
				checked: true
			}).component();

		this._disposables.push(
			radioStart.onDidChangeCheckedState(checked => {
				if (checked) {
					this.stateModel.resumeAssessment = false;
				}
			}));
		const radioContinue = view.modelBuilder.radioButton()
			.withProps({
				label: constants.RESUME_SESSION,
				name: buttonGroup,
				CSSStyles: { ...styles.BODY_CSS },
				checked: false
			}).component();

		this._disposables.push(
			radioContinue.onDidChangeCheckedState(checked => {
				if (checked) {
					this.stateModel.resumeAssessment = true;
				}
			}));

		const barConfig: azdata.BarChartConfiguration = {
			datasets: [
				{
					data: [2, 3, 4],
					backgroundColor: '#FFFF88',
					borderColor: '#FFFF00',
					dataLabel: 'By One'
				},
				{
					data: [3.5, 4, 4.5],
					backgroundColor: '#88FFFF',
					borderColor: '#00FFFF',
					dataLabel: 'By Half'
				},
				{
					data: [1, 3, 5],
					backgroundColor: '#FF88FF',
					borderColor: '#FF00FF',
					dataLabel: 'By Two'
				}
			],
			labels: ['uno', 'dos', 'tres', 'quatro'],
			options: {
				chartTitle: 'Test Bar Chart',
				scales: {
					x: {
						max: 8
					}
				}
			}
		};

		const barChart = view.modelBuilder.chart<azdata.BarChartConfiguration>()
			.withProps({
				chartType: 'bar',
				configuration: barConfig,
				chartId: 'barChart1',
				width: '500px',
				height: '300px'
			}).component();

		// const horizontalBarConfig: azdata.BarChartConfiguration = {
		// 	datasets: barConfig.datasets,
		// 	labels: ['uno', 'dos', 'tres', 'quatro'],
		// 	options: {
		// 		legendVisible: false,
		// 		scales: {
		// 			x: {
		// 				max: 8
		// 			}
		// 		}
		// 	}
		// };

		// const horizontalBarChart = view.modelBuilder.chart<azdata.BarChartConfiguration>()
		// 	.withProps({
		// 		chartType: 'horizontalBar',
		// 		configuration: horizontalBarConfig,
		// 		chartId: 'horizChart1'
		// 	}).component();

		// const lineConfig: azdata.LineChartConfiguration = {
		// 	chartTitle: 'Test Line Chart',
		// 	datasets: [
		// 		{
		// 			data: [2, 3, 4],
		// 			backgroundColor: '#FFFF88',
		// 			borderColor: '#FFFF00',
		// 			dataLabel: 'By One'
		// 		},
		// 		{
		// 			data: [3.5, 4, 4.5],
		// 			backgroundColor: '#88FFFF',
		// 			borderColor: '#00FFFF',
		// 			dataLabel: 'By Half'
		// 		},
		// 		{
		// 			data: [1, 3, 5],
		// 			backgroundColor: '#FF88FF',
		// 			borderColor: '#FF00FF',
		// 			dataLabel: 'By Two'
		// 		}
		// 	],
		// 	labels: ['uno', 'dos', 'tres', 'quatro'],
		// 	options: {
		// 		scales: {
		// 			x: {
		// 				max: 8
		// 			}
		// 		}
		// 	}
		// };

		// const lineChart = view.modelBuilder.chart<azdata.LineChartConfiguration>()
		// 	.withProps({
		// 		chartType: 'line',
		// 		configuration: lineConfig
		// 	}).component();

		// const pieConfig: azdata.PieChartConfiguration = {
		// 	chartTitle: 'Test Pie Chart',
		// 	dataset: [
		// 		{
		// 			value: 50,
		// 			backgroundColor: "#FF8888",
		// 			borderColor: "#FF0000",
		// 			dataLabel: "Some"
		// 		},
		// 		{
		// 			value: 100,
		// 			backgroundColor: "#88FF88",
		// 			borderColor: "#00FF00",
		// 			dataLabel: "More"
		// 		},
		// 		{
		// 			value: 300,
		// 			backgroundColor: "#8888FF",
		// 			borderColor: "#0000FF",
		// 			dataLabel: "Most"
		// 		}
		// 	],
		// 	options: {

		// 	}
		// }

		// const pieChart = view.modelBuilder.chart<azdata.PieChartConfiguration>()
		// 	.withProps({
		// 		chartType: 'pie',
		// 		configuration: pieConfig
		// 	}).component();

		// const doughnutConfig: azdata.PieChartConfiguration = {
		// 	chartTitle: 'Test Doughnut Chart',
		// 	dataset: pieConfig.dataset,
		// 	options: {

		// 	}
		// }

		// const doughnutChart = view.modelBuilder.chart<azdata.PieChartConfiguration>()
		// 	.withProps({
		// 		chartType: 'doughnut',
		// 		configuration: doughnutConfig
		// 	}).component();

		// const scatterplotConfig: azdata.ScatterplotConfiguration = {
		// 	chartTitle: 'Test Scatterplot',
		// 	datasets: [
		// 		{
		// 			data:
		// 				[
		// 					{ x: -10, y: 0 },
		// 					{ x: 0, y: 10 },
		// 					{ x: 10, y: 5 },
		// 					{ x: 0.5, y: 5.5 }
		// 				],
		// 			backgroundColor: 'rgb(255, 99, 132)',
		// 			borderColor: 'rgb(255, 99, 132)',
		// 			dataLabel: 'Rojo'
		// 		},
		// 		{
		// 			data:
		// 				[
		// 					{ x: -5, y: 8 },
		// 					{ x: 2, y: 6 },
		// 					{ x: -1, y: 1 }
		// 				],
		// 			backgroundColor: 'rgb(0, 102, 204)',
		// 			borderColor: 'rgb(0, 102, 204)',
		// 			dataLabel: 'Azul'
		// 		}
		// 	],
		// 	options: {
		// 		scales: {
		// 			x: {
		// 				//type: 'linear',
		// 				position: 'bottom'
		// 			}
		// 		}
		// 	}
		// };

		// const scatterplot = view.modelBuilder.chart<azdata.ScatterplotConfiguration>()
		// 	.withProps({
		// 		chartType: 'scatter',
		// 		configuration: scatterplotConfig
		// 	}).component();

		// const bubbleConfig: azdata.BubbleChartConfiguration = {
		// 	chartTitle: 'Test Bubble Chart',
		// 	datasets: [
		// 		{
		// 			data:
		// 				[
		// 					{ x: 5, y: 5, r: 2 },
		// 					{ x: 10, y: 10, r: 4 },
		// 					{ x: 15, y: 15, r: 6 },
		// 					{ x: 20, y: 20, r: 8 }
		// 				],
		// 			backgroundColor: '#FF6666',
		// 			borderColor: 'red',
		// 			dataLabel: 'Red Dataset'
		// 		},
		// 		{
		// 			data:
		// 				[
		// 					{ x: 5, y: 20, r: 8 },
		// 					{ x: 10, y: 15, r: 6 },
		// 					{ x: 15, y: 10, r: 4 },
		// 					{ x: 20, y: 5, r: 2 }
		// 				],
		// 			backgroundColor: '#6666FF',
		// 			borderColor: 'blue',
		// 			dataLabel: 'Blue Dataset'
		// 		},
		// 	],
		// 	options: {
		// 		scales: {
		// 			x: {
		// 				//type: 'linear',
		// 				position: 'bottom'
		// 			}
		// 		}
		// 	}
		// };

		// const bubbleChart = view.modelBuilder.chart<azdata.BubbleChartConfiguration>()
		// 	.withProps(
		// 		{
		// 			chartType: 'bubble',
		// 			configuration: bubbleConfig
		// 		}).component();

		// const polarConfig: azdata.PolarAreaChartConfiguration = {
		// 	chartTitle: 'Test Polar Chart',
		// 	dataset:
		// 		[
		// 			{
		// 				value: 1,
		// 				dataLabel: 'Rouge',
		// 				backgroundColor: '#FF0000',
		// 				borderColor: '#880000'
		// 			},
		// 			{
		// 				value: 2,
		// 				dataLabel: 'Orange',
		// 				backgroundColor: '#FF8800',
		// 				borderColor: '#884400'
		// 			},
		// 			{
		// 				value: 3,
		// 				dataLabel: 'Jaune',
		// 				backgroundColor: '#FFFF00',
		// 				borderColor: '#888800'
		// 			},
		// 			{
		// 				value: 4,
		// 				dataLabel: 'Vert',
		// 				backgroundColor: '#00FF00',
		// 				borderColor: '#008800'
		// 			},
		// 			{
		// 				value: 5,
		// 				dataLabel: 'Bleu',
		// 				backgroundColor: '#0000FF',
		// 				borderColor: '#000088'
		// 			},
		// 			{
		// 				value: 6,
		// 				dataLabel: 'Violet',
		// 				backgroundColor: '#8800FF',
		// 				borderColor: '#440088'
		// 			}
		// 		],
		// 	options: {}
		// }

		// const polarChart = view.modelBuilder.chart<azdata.PolarAreaChartConfiguration>()
		// 	.withProps(
		// 		{
		// 			chartType: 'polarArea',
		// 			configuration: polarConfig
		// 		}).component();

		// const radarConfig: azdata.RadarChartConfiguration = {
		// 	chartTitle: 'Test Radar Chart',
		// 	datasets: [
		// 		{
		// 			data: [2, 2, 2, 2, 4, 7, 10, 11, 12, 2],
		// 			dataLabel: 'Left Wing',
		// 			backgroundColor: '#FF000033',
		// 			borderColor: '#FF0000'
		// 		},
		// 		{
		// 			data: [2, 2, 12, 11, 10, 7, 4, 2, 2, 2],
		// 			dataLabel: 'Right Wing',
		// 			backgroundColor: '#FF880033',
		// 			borderColor: '#FF8800'
		// 		},
		// 		{
		// 			data: [8, 6, 2, 1, 1, 1, 1, 1, 2, 6],
		// 			dataLabel: 'Head',
		// 			backgroundColor: '#FFFF0033',
		// 			borderColor: '#FFFF00'
		// 		},
		// 	],
		// 	labels: ['Ek', 'Do', 'Teen', 'Chaar', 'Panch', 'Chah', 'Saat', 'Aath', 'Nau', 'Das']
		// };

		// const radarChart = view.modelBuilder.chart<azdata.RadarChartConfiguration>()
		// 	.withProps(
		// 		{
		// 			chartType: 'radar',
		// 			configuration: radarConfig
		// 		}
		// 	).component();

		const button = view.modelBuilder.button()
			.withProps({
				label: 'Click to change chart data'
			}).component();

		this._disposables.push(button.onDidClick(async () => {
			for (let set of barConfig.datasets) {
				for (let i = 0; i < set.data.length; i++) {
					set.data[i] = Math.random() * 8;
				}
			}

			const newConfig: azdata.BarChartConfiguration = {
				...barConfig,
				datasets: barConfig.datasets
			};

			await barChart.updateProperty('configuration', newConfig);
		}));

		const flex = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column', })
			.withProps({ CSSStyles: { 'padding': '20px 15px', } })
			.component();
		flex.addItem(radioStart, { flex: '0 0 auto' });
		flex.addItem(radioContinue, { flex: '0 0 auto' });

		flex.addItem(button);

		flex.addItem(barChart, { flex: '0 0 auto' });
		// flex.addItem(horizontalBarChart, { flex: '0 0 auto' });
		// flex.addItem(lineChart, { flex: '0 0 auto' });
		// flex.addItem(pieChart, { flex: '0 0 auto' });
		// flex.addItem(doughnutChart, { flex: '0 0 auto' });
		// flex.addItem(scatterplot, { flex: '0 0 auto' });
		// flex.addItem(bubbleChart, { flex: '0 0 auto' });
		// flex.addItem(polarChart, { flex: '0 0 auto' });
		// flex.addItem(radarChart, { flex: '0 0 auto' });

		return flex;
	}
}
