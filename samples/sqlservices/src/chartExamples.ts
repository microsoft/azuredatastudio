/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export const barConfig: azdata.BarChartConfiguration = {
	chartTitle: 'Test Bar Chart - Belgian Flag',
	datasets: [
		{
			data: [3, 4, 5, 4],
			backgroundColor: 'rgb(0, 0, 0, 0.8)',
			borderColor: 'black',
			dataLabel: 'Black Stripes'
		},
		{
			data: [4, 4.5, 4, 3.5],
			backgroundColor: 'rgb(255, 255, 0, 0.8)',
			borderColor: 'yellow',
			dataLabel: 'Yellow Stripes'
		},
		{
			data: [5, 3.5, 3, 4],
			backgroundColor: 'rgb(255, 0, 0, 0.8)',
			borderColor: 'red',
			dataLabel: 'Red Stripes'
		}
	],
	labels: ['Een', 'Twee', 'Drie', 'Vier'],
	options: {
		scales: {
			x: {
				max: 8
			}
		}
	}
};

export const horizontalBarConfig: azdata.BarChartConfiguration = {
	chartTitle: 'Test Horizontal Bar Chart - Indian Flag',
	datasets: [
		{
			data: [3, 8],
			backgroundColor: '#FF8800BB',
			borderColor: 'orange',
			dataLabel: 'Orange Stripes'
		},
		{
			data: [3.5, 7],
			backgroundColor: '#FFFFFFBB',
			borderColor: 'white',
			dataLabel: 'White Stripes'
		},
		{
			data: [4, 9],
			backgroundColor: '#008800BB',
			borderColor: '#008800',
			dataLabel: 'Green Stripes'
		}
	],
	labels: ['Ek', 'Do'],
	options: {
		scales: {
			x: {
				max: 8
			}
		}
	}
};

export const lineConfig: azdata.LineChartConfiguration = {
	chartTitle: 'Test Line Chart',
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
		scales: {
			x: {
				max: 8
			}
		}
	}
};

export const pieConfig: azdata.PieChartConfiguration = {
	chartTitle: 'Test Pie Chart - Pacman',
	dataset: [
		{
			value: 3,
			backgroundColor: 'rgb(255, 255, 0, 0.5)',
			borderColor: 'yellow',
			dataLabel: 'Pacman'
		},
		{
			value: 1,
			backgroundColor: 'rgb(50, 50, 50, 0.5)',
			borderColor: 'black',
			dataLabel: 'Not Pacman'
		}
	],
	options: {
		rotation: 135
	}
};

export const doughnutConfig: azdata.PieChartConfiguration = {
	chartTitle: 'Test Doughnut Chart - Strawberry Doughnut',
	dataset: [
		{
			value: 50,
			backgroundColor: 'rgb(50, 50, 50, 0.5)',
			borderColor: 'black',
			dataLabel: 'Eaten'
		},
		{
			value: 100,
			backgroundColor: 'rgb(180, 130, 85, 0.5)',
			borderColor: 'brown',
			dataLabel: 'No Icing'
		},
		{
			value: 300,
			backgroundColor: 'rgb(255, 150, 200, 0.5)',
			borderColor: 'pink',
			dataLabel: 'Icing'
		}
	],
	options: {

	}
};

export const scatterConfig: azdata.ScatterplotConfiguration = {
	chartTitle: 'Test Scatter Chart',
	datasets: [
		{
			data: [
				{ x: -10, y: 0 },
				{ x: 0, y: 10 },
				{ x: 10, y: 5 },
				{ x: 0.5, y: 5.5 }
			],
			backgroundColor: 'rgb(255, 99, 132)',
			borderColor: 'rgb(0, 255, 132)',
			dataLabel: 'Scatter Dataset'
		}
	],
	options: {
		scales: {
			x: {
				// type: 'linear',
				position: 'bottom'
			}
		}
	}
};

export const bubbleConfig: azdata.BubbleChartConfiguration = {
	chartTitle: 'Test Bubble Chart - Yin and Yang',
	datasets: [
		{
			data:
				[
					{ x: 0, y: -5, r: 2 },
					{ x: -2, y: -4.6, r: 4 },
					{ x: -3.5, y: -3.5, r: 6 },
					{ x: -4.6, y: -2, r: 8 },
					{ x: -5, y: 0, r: 10 },
					{ x: -4.6, y: 2, r: 12 },
					{ x: -3.5, y: 3.5, r: 14 },
					{ x: -2, y: 4.6, r: 16 },
					{ x: 0, y: 5, r: 18 }
				],
			backgroundColor: '#FFFFFF88',
			borderColor: 'white',
			dataLabel: 'Yin'
		},
		{
			data:
				[
					{ x: 0, y: 5, r: 2 },
					{ x: 2, y: 4.6, r: 4 },
					{ x: 3.5, y: 3.5, r: 6 },
					{ x: 4.6, y: 2, r: 8 },
					{ x: 5, y: 0, r: 10 },
					{ x: 4.6, y: -2, r: 12 },
					{ x: 3.5, y: -3.5, r: 14 },
					{ x: 2, y: -4.6, r: 16 },
					{ x: 0, y: -5, r: 18 }
				],
			backgroundColor: '#00000088',
			borderColor: 'black',
			dataLabel: 'Yang'
		}
	],
	options: {
		scales: {
			x: {
				// type: 'linear',
				position: 'bottom'
			}
		}
	}
};

export const polarConfig: azdata.PolarAreaChartConfiguration = {
	chartTitle: 'Test Polar Chart - Rainbow',
	dataset:
		[
			{
				value: 1,
				dataLabel: 'Rouge',
				backgroundColor: '#FF0000',
				borderColor: '#880000'
			},
			{
				value: 2,
				dataLabel: 'Orange',
				backgroundColor: '#FF8800',
				borderColor: '#884400'
			},
			{
				value: 3,
				dataLabel: 'Jaune',
				backgroundColor: '#FFFF00',
				borderColor: '#888800'
			},
			{
				value: 4,
				dataLabel: 'Vert',
				backgroundColor: '#00FF00',
				borderColor: '#008800'
			},
			{
				value: 5,
				dataLabel: 'Bleu',
				backgroundColor: '#0000FF',
				borderColor: '#000088'
			},
			{
				value: 6,
				dataLabel: 'Violet',
				backgroundColor: '#8800FF',
				borderColor: '#440088'
			}
		],
	options: {}
};

export const radarConfig: azdata.RadarChartConfiguration = {
	chartTitle: 'Test Radar Chart - Firebird',
	datasets: [
		{
			data: [2, 2, 2, 2, 4, 7, 10, 11, 12, 2],
			dataLabel: 'Left Wing',
			backgroundColor: '#FF000033',
			borderColor: '#FF0000'
		},
		{
			data: [2, 2, 12, 11, 10, 7, 4, 2, 2, 2],
			dataLabel: 'Right Wing',
			backgroundColor: '#FF880033',
			borderColor: '#FF8800'
		},
		{
			data: [8, 6, 2, 1, 1, 1, 1, 1, 2, 6],
			dataLabel: 'Head',
			backgroundColor: '#FFFF0033',
			borderColor: '#FFFF00'
		}
	],
	labels: ['She\'ll', 'Be', 'Coming', 'Around', 'The', 'Firebird', 'When', 'She', 'Comes', 'Encore']
};
