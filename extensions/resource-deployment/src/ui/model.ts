/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EOL } from 'os';
import { ITool, NoteBookEnvironmentVariablePrefix } from '../interfaces';
import { setEnvironmentVariablesForInstallPaths, getRuntimeBinaryPathEnvironmentVariableName } from '../utils';
import { ToolsInstallPath } from '../constants';
import { delimiter } from 'path';


const NotebookEnvironmentVariablePrefixRegex = new RegExp(`^${NoteBookEnvironmentVariablePrefix}`);

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
	 * Returns python code statements for setting variables starting with {@see NoteBookEnvironmentVariablePrefix} as python variables.
	 * The prefix {@see NoteBookEnvironmentVariablePrefix} is removed and variable name changed to all lowercase to arrive at python variable name.
	 * The statements returned are escaped for use in cell of a python notebook.
	 *
	 * @param tools - optional set of tools for which variable value setting statements need to be generated;
	 * @param inputFilter - optional parameter to filter out setting of specific variable names. Every variable for which this function returns false is not included
	 * 						in the emitted code.
	 */
	public getCodeCellContentForNotebook(tools: ITool[] = [], inputFilter: (varName: string) => boolean = () => true): string[] {
		const statements: string[] = Object.keys(this.propValueObject)
			.filter(propertyName => propertyName.startsWith(NoteBookEnvironmentVariablePrefix) && inputFilter(propertyName))
			.map(propertyName => {
				const value = this.escapeForNotebookCodeCell(this.getStringValue(propertyName, ''));
				const varName = propertyName.replace(NotebookEnvironmentVariablePrefixRegex, '').toLocaleLowerCase();
				return `${varName} = '${value}'${EOL}`;
			});
		statements.push(`print('Variables have been set successfully.')${EOL}`);
		const env: NodeJS.ProcessEnv = {};
		setEnvironmentVariablesForInstallPaths(tools, env);
		tools.forEach(tool => {
			const envVarName: string = getRuntimeBinaryPathEnvironmentVariableName(tool.name);
			statements.push(`os.environ["${envVarName}"] = "${this.escapeForNotebookCodeCell(env[envVarName]!)}"${EOL}`);
		});
		if (env[ToolsInstallPath]) {
			statements.push(`os.environ["PATH"] = os.environ["PATH"] + "${delimiter}" + "${this.escapeForNotebookCodeCell(env[ToolsInstallPath])}"${EOL}`);
		}
		statements.push(`print('Environment Variables for tools have been set successfully.')${EOL}`);
		return statements;
	}

	protected escapeForNotebookCodeCell(original?: string): string | undefined {
		// Escape the \ character for the code cell string value
		return original && original.replace(/\\/g, '\\\\');
	}

	/**
	 * Sets the environment variable for each model variable that starts with {@see NoteBookEnvironmentVariablePrefix} in the
	 * current process.
	 *
	 * @param env - env variable object in which the environment variables are populated. Default: process.env
	 * @param inputFilter - an optional filter to further restrict the variables that are set into the env object.
	 *						Every variable for which this function returns false is not included does not get the env variable set.
	 * 						Default all variable meeting prefix requirements are set.
	 */
	public setEnvironmentVariables(env: NodeJS.ProcessEnv = process.env, inputFilter: (varName: string) => boolean = () => true): void {
		Object.keys(this.propValueObject)
			.filter(propertyName => propertyName.startsWith(NoteBookEnvironmentVariablePrefix) && inputFilter(propertyName))
			.forEach(propertyName => {
				const value = this.getStringValue(propertyName);
				env[propertyName] = value === undefined ? '' : value;
			});
	}
}
