/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { NoteBookEnvironmentVariablePrefix } from '../interfaces';
import { EOL } from 'os';

export class Model {
	private propValueObject: { [s: string]: string | undefined } = {};

	public setPropertyValue(property: string, value: string | number | boolean | undefined): void {
		if (typeof value === 'boolean') {
			this.propValueObject[property] = value ? 'true' : 'false';
		} else if (typeof value === 'number') {
			this.propValueObject[property] = value.toString();
		} else {
			this.propValueObject[property] = value;
		}
	}

	public getIntegerValue(propName: string, defaultValue: number = 0): number {
		const value = this.propValueObject[propName];
		return value === undefined ? defaultValue : Number.parseInt(value);
	}

	public getStringValue(propName: string, defaultValue?: string): string | undefined {
		const value = this.propValueObject[propName];
		return value === undefined ? defaultValue : value;
	}

	public getBooleanValue(propName: string, defaultValue: boolean = false): boolean {
		const value = this.propValueObject[propName];
		return value === undefined ? defaultValue : value === 'true';
	}

	/**
	 * returns python code statements for setting variables starting with {@see NoteBookEnvironmentVariablePrefix} as python variables.
	 * The prefix {@see NoteBookEnvironmentVariablePrefix} is removed and variable name changed to all lowercase to arrive at python variable name.
	 * The statements returned are escaped for use in cell of a python notebook.
	 */
	public getCodeCellContentForNotebook(): string[] {
		const regex = new RegExp(`^${NoteBookEnvironmentVariablePrefix}`);
		const statements: string[] = Object.keys(this.propValueObject)
			.filter(propertyName => propertyName.startsWith(NoteBookEnvironmentVariablePrefix))
			.map(propertyName => {
				const value = this.escapeForNotebookCodeCell(this.getStringValue(propertyName, ''));
				const varName = propertyName.replace(regex, '').toLocaleLowerCase();
				return `${varName} = '${value}'${EOL}`;
			});
		statements.push(`print('Variables have been set successfully.')${EOL}`);
		return statements;
	}

	protected escapeForNotebookCodeCell(original?: string): string | undefined {
		// Escape the \ character for the code cell string value
		return original && original.replace(/\\/g, '\\\\');
	}

	/**
	 * sets the environment variable for each model variable that starts with {@see NoteBookEnvironmentVariablePrefix} in the
	 * current process.
	 */
	public setEnvironmentVariables(): void {
		Object.keys(this.propValueObject).filter(propertyName => propertyName.startsWith(NoteBookEnvironmentVariablePrefix)).forEach(propertyName => {
			const value = this.getStringValue(propertyName);
			if (value !== undefined && value !== '') {
				process.env[propertyName] = value;
			}
			process.env[propertyName] = value === undefined ? '' : value;
		});
	}

	/**
	 * Returns a string that interpolates all variable names in the {@param inputValue} string de-marked as $(VariableName)
	 * substituted with their corresponding values.
	 *
	 * Only variables in the current model starting with {@see NoteBookEnvironmentVariablePrefix} are replaced.
	 *
	 * @param inputValue
	 */
	public substituteVariableValues(inputValue: string): string {
		Object.keys(this.propValueObject)
			.filter(propertyName => propertyName.startsWith(NoteBookEnvironmentVariablePrefix))
			.forEach(propertyName => {
				const value = this.getStringValue(propertyName) || '';
				const re: RegExp = new RegExp(`\\\$\\\(${propertyName}\\\)`, 'gi');
				inputValue = inputValue.replace(re, value);
			});
		return inputValue;
	}
}
