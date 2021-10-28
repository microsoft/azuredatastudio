/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as os from 'os';
import * as constants from './constants';
import * as path from 'path';
import * as glob from 'fast-glob';
import * as dataworkspace from 'dataworkspace';
import * as mssql from '../../../mssql';
import * as vscodeMssql from 'vscode-mssql';
import * as childProcess from 'child_process';
import * as fse from 'fs-extra';
import * as which from 'which';
import { promises as fs } from 'fs';
import { Project } from '../models/project';

export interface ValidationResult {
	errorMessage: string;
	validated: boolean
}

/**
 * Consolidates on the error message string
 */
export function getErrorMessage(error: any): string {
	return (error instanceof Error)
		? (typeof error.message === 'string' ? error.message : '')
		: typeof error === 'string' ? error : `${JSON.stringify(error, undefined, '\t')}`;
}

/**
 * removes any leading portion shared between the two URIs from outerUri.
 * e.g. [@param innerUri: 'this\is'; @param outerUri: '\this\is\my\path'] => 'my\path' OR
 * e.g. [@param innerUri: 'this\was'; @param outerUri: '\this\is\my\path'] => '..\is\my\path'
 * @param innerUri the URI that will be cut away from the outer URI
 * @param outerUri the URI that will have any shared beginning portion removed
 */
export function trimUri(innerUri: vscode.Uri, outerUri: vscode.Uri): string {
	let innerParts = innerUri.path.split('/');
	let outerParts = outerUri.path.split('/');

	if (path.isAbsolute(outerUri.path)
		&& innerParts.length > 0 && outerParts.length > 0
		&& innerParts[0].toLowerCase() !== outerParts[0].toLowerCase()) {
		throw new Error(constants.outsideFolderPath);
	}

	while (innerParts.length > 0 && outerParts.length > 0 && innerParts[0].toLocaleLowerCase() === outerParts[0].toLocaleLowerCase()) {
		innerParts = innerParts.slice(1);
		outerParts = outerParts.slice(1);
	}

	while (innerParts.length > 1) {
		outerParts.unshift(constants.RelativeOuterPath);
		innerParts = innerParts.slice(1);
	}

	return outerParts.join('/');
}

/**
 * Trims any character contained in @param chars from both the beginning and end of @param input
 */
export function trimChars(input: string, chars: string): string {
	let output = input;

	let i = 0;
	while (chars.includes(output[i])) { i++; }
	output = output.substr(i);

	i = 0;
	while (chars.includes(output[output.length - i - 1])) { i++; }
	output = output.substring(0, output.length - i);

	return output;
}

/**
 * Ensures that folder path terminates with the slash.
 * By default SSDT-style slash (`\`) is used.
 *
 * @param path Folder path to ensure trailing slash for.
 * @param slashCharacter Slash character to ensure is present at the end of the path.
 * @returns Path that ends with the given slash character.
 */
export function ensureTrailingSlash(path: string, slashCharacter: string = constants.SqlProjPathSeparator): string {
	return path.endsWith(slashCharacter) ? path : path + slashCharacter;
}

/**
 * Checks if the folder or file exists @param path path of the folder/file
*/
export async function exists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * get quoted path to be used in any commandline argument
 * @param filePath
 */
export function getQuotedPath(filePath: string): string {
	return (os.platform() === 'win32') ?
		getQuotedWindowsPath(filePath) :
		getQuotedNonWindowsPath(filePath);
}

/**
 * ensure that path with spaces are handles correctly (return quoted path)
 */
function getQuotedWindowsPath(filePath: string): string {
	filePath = filePath.split('\\').join('\\\\').split('"').join('');
	return '"' + filePath + '"';
}

/**
 * ensure that path with spaces are handles correctly (return quoted path)
 */
function getQuotedNonWindowsPath(filePath: string): string {
	filePath = filePath.split('\\').join('/').split('"').join('');
	return '"' + filePath + '"';
}

/**
 * Get safe relative path for Windows and non-Windows Platform
 * This is needed to read sqlproj entried created on SSDT and opened in MAC
 * '/' in tree is recognized all platforms but "\\" only by windows
 *
 * @param filePath Path to the file or folder.
 */
export function getPlatformSafeFileEntryPath(filePath: string): string {
	return filePath.includes('\\')
		? filePath.split('\\').join('/')
		: filePath;
}

/**
 * Standardizes slashes to be "\" for consistency between platforms and compatibility with SSDT
 *
 * @param filePath Path to the file of folder.
 */
export function convertSlashesForSqlProj(filePath: string): string {
	return filePath.includes('/')
		? filePath.split('/').join(constants.SqlProjPathSeparator)
		: filePath;
}

/**
 * Read SQLCMD variables from xmlDoc and return them
 * @param xmlDoc xml doc to read SQLCMD variables from. Format must be the same that sqlproj and publish profiles use
 */
export function readSqlCmdVariables(xmlDoc: any): Record<string, string> {
	let sqlCmdVariables: Record<string, string> = {};
	for (let i = 0; i < xmlDoc.documentElement.getElementsByTagName(constants.SqlCmdVariable)?.length; i++) {
		const sqlCmdVar = xmlDoc.documentElement.getElementsByTagName(constants.SqlCmdVariable)[i];
		const varName = sqlCmdVar.getAttribute(constants.Include);

		if (sqlCmdVar.getElementsByTagName(constants.DefaultValue)[0] !== undefined) {
			// project file path
			sqlCmdVariables[varName] = sqlCmdVar.getElementsByTagName(constants.DefaultValue)[0].childNodes[0].nodeValue;
		}
		else {
			// profile path
			sqlCmdVariables[varName] = sqlCmdVar.getElementsByTagName(constants.Value)[0].childNodes[0].nodeValue;
		}
	}

	return sqlCmdVariables;
}

/**
 * 	Removes $() around a sqlcmd variable
 * @param name
 */
export function removeSqlCmdVariableFormatting(name: string | undefined): string {
	if (!name || name === '') {
		return '';
	}

	if (name.length > 3) {
		// Trim in case we get "  $(x)"
		name = name.trim();
		let indexStart = name.startsWith('$(') ? 2 : 0;
		let indexEnd = name.endsWith(')') ? 1 : 0;
		if (indexStart > 0 || indexEnd > 0) {
			name = name.substr(indexStart, name.length - indexEnd - indexStart);
		}
	}

	// Trim in case the customer types "  $(x   )"
	return name.trim();
}

/**
 * 	Format as sqlcmd variable by adding $() if necessary
 * if the variable already starts with $(, then add )
 * @param name
 */
export function formatSqlCmdVariable(name: string): string {
	if (!name || name === '') {
		return name;
	}

	// Trim in case we get "  $(x)"
	name = name.trim();

	if (!name.startsWith('$(') && !name.endsWith(')')) {
		name = `$(${name})`;
	} else if (name.startsWith('$(') && !name.endsWith(')')) {
		// add missing end parenthesis, same behavior as SSDT
		name = `${name})`;
	}

	return name;
}

/**
 * Checks if it's a valid sqlcmd variable name
 * https://docs.microsoft.com/en-us/sql/ssms/scripting/sqlcmd-use-with-scripting-variables?redirectedfrom=MSDN&view=sql-server-ver15#guidelines-for-scripting-variable-names-and-values
 * @param name variable name to validate
 */
export function isValidSqlCmdVariableName(name: string | undefined): boolean {
	// remove $() around named if it's there
	name = removeSqlCmdVariableFormatting(name);

	// can't contain whitespace
	if (!name || name.trim() === '' || name.includes(' ')) {
		return false;
	}

	// can't contain these characters
	if (name.includes('$') || name.includes('@') || name.includes('#') || name.includes('"') || name.includes('\'') || name.includes('-')) {
		return false;
	}

	// TODO: tsql parsing to check if it's a reserved keyword or invalid tsql https://github.com/microsoft/azuredatastudio/issues/12204
	// TODO: give more detail why variable name was invalid https://github.com/microsoft/azuredatastudio/issues/12231

	return true;
}

/**
 * Recursively gets all the sqlproj files at any depth in a folder
 * @param folderPath
 */
export async function getSqlProjectFilesInFolder(folderPath: string): Promise<string[]> {
	// path needs to use forward slashes for glob to work
	const escapedPath = glob.escapePath(folderPath.replace(/\\/g, '/'));
	const sqlprojFilter = path.posix.join(escapedPath, '**', '*.sqlproj');
	const results = await glob(sqlprojFilter);

	return results;
}

/**
 * Get all the projects in the workspace that are sqlproj
 */
export function getSqlProjectsInWorkspace(): Promise<vscode.Uri[]> {
	const api = getDataWorkspaceExtensionApi();
	return api.getProjectsInWorkspace(constants.sqlprojExtension);
}

export function getDataWorkspaceExtensionApi(): dataworkspace.IExtension {
	const dataworkspaceExtName = getAzdataApi() ? dataworkspace.extension.name : dataworkspace.extension.vscodeName;
	const extension = vscode.extensions.getExtension(dataworkspaceExtName)!;
	return extension.exports;
}

export type IDacFxService = mssql.IDacFxService | vscodeMssql.IDacFxService;
export type ISchemaCompareService = mssql.ISchemaCompareService | vscodeMssql.ISchemaCompareService;

export async function getDacFxService(): Promise<IDacFxService> {
	if (getAzdataApi()) {
		const ext = vscode.extensions.getExtension(mssql.extension.name) as vscode.Extension<mssql.IExtension>;
		const api = await ext.activate();
		return api.dacFx;
	} else {
		const api = await getVscodeMssqlApi();
		return api.dacFx;
	}
}

export async function getSchemaCompareService(): Promise<ISchemaCompareService> {
	if (getAzdataApi()) {
		const ext = vscode.extensions.getExtension(mssql.extension.name) as vscode.Extension<mssql.IExtension>;
		const api = await ext.activate();
		return api.schemaCompare;
	} else {
		const api = await getVscodeMssqlApi();
		return api.schemaCompare;
	}
}

export async function getAzureFunctionService(): Promise<vscodeMssql.IAzureFunctionsService> {
	if (getAzdataApi()) {
		// this isn't supported in ADS
		throw new Error('Azure Functions service is not supported in Azure Data Studio');
	} else {
		const api = await getVscodeMssqlApi();
		return api.azureFunctions;
	}
}

export async function getVscodeMssqlApi(): Promise<vscodeMssql.IExtension> {
	const ext = vscode.extensions.getExtension(vscodeMssql.extension.name) as vscode.Extension<vscodeMssql.IExtension>;
	return ext.activate();
}

/*
 * Returns the default deployment options from DacFx, filtered to appropriate options for the given project.
 */
export async function getDefaultPublishDeploymentOptions(project: Project): Promise<mssql.DeploymentOptions | vscodeMssql.DeploymentOptions> {
	const schemaCompareService = await getSchemaCompareService();
	const result = await schemaCompareService.schemaCompareGetDefaultOptions();
	const deploymentOptions = result.defaultDeploymentOptions;
	// re-include database-scoped credentials
	if (getAzdataApi()) {
		deploymentOptions.excludeObjectTypes = (deploymentOptions as mssql.DeploymentOptions).excludeObjectTypes.filter(x => x !== mssql.SchemaObjectType.DatabaseScopedCredentials);
	} else {
		deploymentOptions.excludeObjectTypes = (deploymentOptions as vscodeMssql.DeploymentOptions).excludeObjectTypes.filter(x => x !== vscodeMssql.SchemaObjectType.DatabaseScopedCredentials);
	}

	// this option needs to be true for same database references validation to work
	if (project.databaseReferences.length > 0) {
		deploymentOptions.includeCompositeObjects = true;
	}
	return result.defaultDeploymentOptions;
}

export interface IPackageInfo {
	name: string;
	fullName: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson?: any): IPackageInfo | undefined {
	if (!packageJson) {
		packageJson = require('../../package.json');
	}

	if (packageJson) {
		return {
			name: packageJson.name,
			fullName: `${packageJson.publisher}.${packageJson.name}`,
			version: packageJson.version,
			aiKey: packageJson.aiKey
		};
	}

	return undefined;
}

/**
 * Converts time in milliseconds to hr, min, sec
 * @param duration time in milliseconds
 * @returns string in "hr, min, sec" or "msec" format
 */
export function timeConversion(duration: number): string {
	const portions: string[] = [];

	const msInHour = 1000 * 60 * 60;
	const hours = Math.trunc(duration / msInHour);
	if (hours > 0) {
		portions.push(`${hours} ${constants.hr}`);
		duration = duration - (hours * msInHour);
	}

	const msInMinute = 1000 * 60;
	const minutes = Math.trunc(duration / msInMinute);
	if (minutes > 0) {
		portions.push(`${minutes} ${constants.min}`);
		duration = duration - (minutes * msInMinute);
	}

	const seconds = Math.trunc(duration / 1000);
	if (seconds > 0) {
		portions.push(`${seconds} ${constants.sec}`);
	}

	if (hours === 0 && minutes === 0 && seconds === 0) {
		portions.push(`${duration} ${constants.msec}`);
	}

	return portions.join(', ');
}

// Try to load the azdata API - but gracefully handle the failure in case we're running
// in a context where the API doesn't exist (such as VS Code)
let azdataApi: typeof azdataType | undefined = undefined;
try {
	azdataApi = require('azdata');
	if (!azdataApi?.version) {
		// webpacking makes the require return an empty object instead of throwing an error so make sure we clear the var
		azdataApi = undefined;
	}
} catch {
	// no-op
}

/**
 * Gets the azdata API if it's available in the context this extension is running in.
 * @returns The azdata API if it's available
 */
export function getAzdataApi(): typeof azdataType | undefined {
	return azdataApi;
}

export async function createFolderIfNotExist(folderPath: string): Promise<void> {
	try {
		await fse.mkdir(folderPath);
	} catch {
		// Ignore if failed
	}
}

export async function executeCommand(cmd: string, outputChannel: vscode.OutputChannel, sensitiveData: string[] = [], timeout: number = 5 * 60 * 1000): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		if (outputChannel) {
			let cmdOutputMessage = cmd;

			sensitiveData.forEach(element => {
				cmdOutputMessage = cmdOutputMessage.replace(element, '***');
			});

			outputChannel.appendLine(`    > ${cmdOutputMessage}`);
		}
		let child = childProcess.exec(cmd, {
			timeout: timeout
		}, (err, stdout) => {
			if (err) {

				// removing sensitive data from the exception
				sensitiveData.forEach(element => {
					err.cmd = err.cmd?.replace(element, '***');
					err.message = err.message?.replace(element, '***');
				});
				reject(err);
			} else {
				resolve(stdout);
			}
		});

		// Add listeners to print stdout and stderr if an output channel was provided

		if (child?.stdout) {
			child.stdout.on('data', data => { outputDataChunk(outputChannel, data, '    stdout: '); });
		}
		if (child?.stderr) {
			child.stderr.on('data', data => { outputDataChunk(outputChannel, data, '    stderr: '); });
		}
	});
}

export function outputDataChunk(outputChannel: vscode.OutputChannel, data: string | Buffer, header: string): void {
	data.toString().split(/\r?\n/)
		.forEach(line => {
			if (outputChannel) {
				outputChannel.appendLine(header + line);
			}
		});
}

export async function retry<T>(
	name: string,
	attempt: () => Promise<T>,
	verify: (result: T) => Promise<ValidationResult>,
	formatResult: (result: T) => Promise<string>,
	outputChannel: vscode.OutputChannel,
	numberOfAttempts: number = 10,
	waitInSeconds: number = 2
): Promise<T | undefined> {
	for (let count = 0; count < numberOfAttempts; count++) {
		outputChannel.appendLine(constants.retryWaitMessage(waitInSeconds, name));
		await new Promise(c => setTimeout(c, waitInSeconds * 1000));
		outputChannel.appendLine(constants.retryRunMessage(count, numberOfAttempts, name));

		try {
			let result = await attempt();
			const validationResult = await verify(result);
			const formattedResult = await formatResult(result);
			if (validationResult.validated) {
				outputChannel.appendLine(constants.retrySucceedMessage(name, formattedResult));
				return result;
			} else {
				outputChannel.appendLine(constants.retryFailedMessage(name, formattedResult, validationResult.errorMessage));
			}

		} catch (err) {
			outputChannel.appendLine(constants.retryMessage(name, err));
		}
	}

	return undefined;
}

/**
 * Detects whether the specified command-line command is available on the current machine
 */
export async function detectCommandInstallation(command: string): Promise<boolean> {
	try {
		const found = await which(command);

		if (found) {
			return true;
		}
	} catch (err) {
		console.log(getErrorMessage(err));
	}

	return false;
}

/**
 * Gets all the projects of the specified extension in the folder
 * @param folder
 * @param projectExtension project extension to filter on
 * @returns array of project uris
 */
export async function getAllProjectsInFolder(folder: vscode.Uri, projectExtension: string): Promise<vscode.Uri[]> {
	// path needs to use forward slashes for glob to work
	const escapedPath = glob.escapePath(folder.fsPath.replace(/\\/g, '/'));

	// filter for projects with the specified project extension
	const projFilter = path.posix.join(escapedPath, '**', `*${projectExtension}`);

	// glob will return an array of file paths with forward slashes, so they need to be converted back if on windows
	return (await glob(projFilter)).map(p => vscode.Uri.file(path.resolve(p)));
}

export function validateSqlServerPortNumber(port: string | undefined): boolean {
	if (!port) {
		return false;
	}
	const valueAsNum = +port;
	return !isNaN(valueAsNum) && valueAsNum > 0 && valueAsNum < 65535;
}

export function isEmptyString(input: string | undefined): boolean {
	return input === undefined || input === '';
}

export function isValidSQLPassword(password: string, userName: string = 'sa'): boolean {
	// Validate SQL Server password
	const containsUserName = password && userName !== undefined && password.toUpperCase().includes(userName.toUpperCase());
	// Instead of using one RegEx, I am separating it to make it more readable.
	const hasUpperCase = /[A-Z]/.test(password) ? 1 : 0;
	const hasLowerCase = /[a-z]/.test(password) ? 1 : 0;
	const hasNumbers = /\d/.test(password) ? 1 : 0;
	const hasNonAlphas = /\W/.test(password) ? 1 : 0;
	return !containsUserName && password.length >= 8 && password.length <= 128 && (hasUpperCase + hasLowerCase + hasNumbers + hasNonAlphas >= 3);
}

export async function showErrorMessageWithOutputChannel(errorMessageFunc: (error: string) => string, error: any, outputChannel: vscode.OutputChannel): Promise<void> {
	const result = await vscode.window.showErrorMessage(errorMessageFunc(getErrorMessage(error)), constants.checkoutOutputMessage);
	if (result === constants.checkoutOutputMessage) {
		outputChannel.show();
	}
}

export async function showInfoMessageWithOutputChannel(message: string, outputChannel: vscode.OutputChannel): Promise<void> {
	const result = await vscode.window.showInformationMessage(message, constants.checkoutOutputMessage);
	if (result === constants.checkoutOutputMessage) {
		outputChannel.show();
	}
}

/**
 * Recursively gets all the sql files at any depth in a folder
 * @param folderPath
 */
export async function getSqlFilesInFolder(folderPath: string): Promise<string[]> {
	// path needs to use forward slashes for glob to work
	const escapedPath = glob.escapePath(folderPath.replace(/\\/g, '/'));
	const sqlFilter = path.posix.join(escapedPath, '**', '*.sql');
	const results = await glob(sqlFilter);

	return results;
}

/**
 * Recursively gets all the folders at any depth in the given folder
 * @param folderPath
 */
export async function getFoldersInFolder(folderPath: string): Promise<string[]> {
	// path needs to use forward slashes for glob to work
	const escapedPath = glob.escapePath(folderPath.replace(/\\/g, '/'));
	const folderFilter = path.posix.join(escapedPath + '/**');
	const results = await glob(folderFilter, { onlyDirectories: true });

	return results;
}
