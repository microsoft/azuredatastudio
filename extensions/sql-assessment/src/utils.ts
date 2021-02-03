/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as os from 'os';
import { promises as fs, existsSync, readdirSync } from 'fs';

export type TargetWithChildren = { target: string, children: string[] };

export function suggestFileName(prefix: string, ext: string, date: number): string {
	const fileName = `${prefix}${generateDefaultFileName(new Date(date))}${ext}`;
	return path.join(os.homedir(), fileName);
}

export function suggestReportFile(date: number): string {
	const fileName = `SqlAssessmentReport_${generateDefaultFileName(new Date(date))}.html`;
	return path.join(os.homedir(), fileName);
}

export async function createHistoryFileName(targetName: string, date: number): Promise<string> {
	const fileName = `${targetName}_${generateDefaultFileName(new Date(date))}.json`;
	const dirPath = path.join(os.homedir(), 'SqlAssessmentHistory');

	if (!existsSync(dirPath)) {
		await fs.mkdir(dirPath);
	}

	return path.join(dirPath, escapeFileName(fileName));
}

export async function readHistoryFileNames(targetName: string): Promise<TargetWithChildren[]> {
	const dirPath = path.join(os.homedir(), 'SqlAssessmentHistory');

	if (!existsSync(dirPath)) {
		return [];
	}
	const files: string[] = readdirSync(dirPath);

	return files
		.filter(file => file.startsWith(`${escapeFileName(targetName)}_`))
		.map(targetFile => {
			let result: TargetWithChildren = {
				target: path.join(dirPath, targetFile),
				children: []
			};

			const datePart = `_${targetFile.split('_')[1]}`;
			result.children.push(...files.filter(f => f.endsWith(datePart)));
			result.children = result.children.map(c => path.join(dirPath, c));

			return result;
		});
}

export function readHistoryFileName(fileName: string): string {
	return path.join(os.homedir(), 'SqlAssessmentHistory', `${fileName}`);
}

export function getAssessmentDate(fileName: string): number {
	const file = path.parse(fileName).name;
	return extractDate(file);
}

function extractDate(fileName: string): number {
	const strDate: string = fileName.split('_')[1].split('.')[0];
	const date = new Date(
		Number(strDate.substr(0, 4)), // y
		Number(strDate.substr(4, 2)) - 1, // m
		Number(strDate.substr(6, 2)), // d
		Number(strDate.substr(8, 2)), // h
		Number(strDate.substr(10, 2)), // m
		Number(strDate.substr(12, 2)) // s
	);
	return date.getTime() - date.getTimezoneOffset() * 60 * 1000;
}

function generateDefaultFileName(resultDate: Date): string {
	return `${resultDate.toISOString().replace(/-/g, '').replace('T', '').replace(/:/g, '').split('.')[0]}`;
}

export function htmlEscape(html: string): string {
	return html.replace(/[<|>|&|"]/g, function (match) {
		switch (match) {
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '&': return '&amp;';
			case '"': return '&quot;';
			case '\'': return '&#39';
			default: return match;
		}
	});
}

function escapeFileName(str: string): string {
	return str.replace(/\*/g, '_');
}

export function limitLongName(name: string, maxLength: number): string {
	if (name.length > maxLength) {
		return name.slice(0, maxLength) + '...';
	}
	return name;
}


