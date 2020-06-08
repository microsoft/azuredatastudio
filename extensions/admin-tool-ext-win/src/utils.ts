/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson: any): IPackageInfo {
	return {
		name: packageJson.name,
		version: packageJson.version,
		aiKey: packageJson.aiKey
	};
}

/**
 * Escapes all single-quotes (') by prefixing them with another single quote ('')
 * ' => ''
 * @param value The string to escape
 */
export function doubleEscapeSingleQuotes(value: string): string {
	return value.replace(/'/g, '\'\'');
}

/**
 * Escape all double-quotes (") by prefixing them with a \
 *  " => \"
 * @param value The string to escape
 */
export function backEscapeDoubleQuotes(value: string): string {
	return value.replace(/"/g, '\\"');
}

/**
 * Map an error message into a friendly short name for the type of error.
 * @param msg The error message to map
 */
export function getTelemetryErrorType(msg: string): string {
	if (msg.indexOf('is not recognized as an internal or external command') !== -1) {
		return 'ExeNotFound';
	}
	else if (msg.indexOf('Unknown Action') !== -1) {
		return 'UnknownAction';
	}
	else if (msg.indexOf('No Action Provided') !== -1) {
		return 'NoActionProvided';
	}
	else if (msg.indexOf('Run exception') !== -1) {
		return 'RunException';
	}
	else {
		return 'Other';
	}
}

// Params to pass to SsmsMin.exe, only an action and server are required - the rest are optional based on the
// action used. Exported for use in testing.
export interface LaunchSsmsDialogParams {
	action: string;
	server: string;
	database?: string;
	user?: string;
	useAad?: boolean;
	urn?: string;
}

/**
 * Builds the command arguments to pass to SsmsMin.exe. Values are expected to be escaped correctly
 * already per their - they will be further escaped * for command-line usage but no additional
 * escaping will occur.
 * @param params The params used to build up the command parameter string
 */
export function buildSsmsMinCommandArgs(params: LaunchSsmsDialogParams): string {
	return `-a "${backEscapeDoubleQuotes(params.action)}" \
-S "${backEscapeDoubleQuotes(params.server)}"\
${params.database ? ' -D "' + backEscapeDoubleQuotes(params.database) + '"' : ''}\
${params.user ? ' -U "' + backEscapeDoubleQuotes(params.user) + '"' : ''}\
${params.useAad === true ? ' -G' : ''}\
${params.urn ? ' -u "' + backEscapeDoubleQuotes(params.urn) + '"' : ''}`;
}


interface SmoMapping {
	action: string;
	urnName: string;
}

export const nodeTypeToUrnNameMapping: { [oeNodeType: string]: SmoMapping } = {
	'Database': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Database', urnName: 'Database' },
	'Server': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Server', urnName: 'Server' },
	'ServerLevelServerAudit': { action: 'sqla:AuditProperties', urnName: 'Audit' },
	'ServerLevelCredential': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Credential', urnName: 'Credential' },
	'ServerLevelServerRole': { action: 'sqla:ManageServerRole', urnName: 'Role' },
	'ServerLevelServerAuditSpecification': { action: 'sqla:ServerAuditSpecificationProperties', urnName: 'ServerAuditSpecification' },
	'ServerLevelLinkedServer': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.LinkedServer', urnName: 'LinkedServer' },
	'Table': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Table', urnName: 'Table' },
	'View': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.View', urnName: 'View' },
	'Column': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Column', urnName: 'Column' },
	'Index': { action: 'sqla:IndexProperties', urnName: 'Index' },
	'Statistic': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Statistic', urnName: 'Statistic' },
	'StoredProcedure': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.StoredProcedure', urnName: 'StoredProcedure' },
	'ScalarValuedFunction': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedFunction', urnName: 'UserDefinedFunction' },
	'TableValuedFunction': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedFunction', urnName: 'UserDefinedFunction' },
	'AggregateFunction': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedFunction', urnName: 'UserDefinedFunction' },
	'Synonym': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Synonym', urnName: 'Synonym' },
	'Assembly': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.SqlAssembly', urnName: 'SqlAssembly' },
	'UserDefinedDataType': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedDataType', urnName: 'UserDefinedDataType' },
	'UserDefinedType': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedType', urnName: 'UserDefinedType' },
	'UserDefinedTableType': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedTableType', urnName: 'UserDefinedTableType' },
	'Sequence': { action: 'sqla:SequenceProperties', urnName: 'Sequence' },
	'User': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.User', urnName: 'User' },
	'DatabaseRole': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.DatabaseRole', urnName: 'Role' },
	'ApplicationRole': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.ApplicationRole', urnName: 'ApplicationRole' },
	'Schema': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Schema', urnName: 'Schema' },
	'SecurityPolicy': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.SecurityPolicy', urnName: 'SecurityPolicy' },
	'ServerLevelLogin': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Login', urnName: 'Login' },
};

/**
 * Builds the URN string for a given ObjectExplorerNode in the form understood by SsmsMin
 * @param node The node to get the URN of
 */
export async function buildUrn(node: azdata.objectexplorer.ObjectExplorerNode): Promise<string> {
	let urnNodes: string[] = [];
	while (node) {
		// Server is special since it's a connection node - always add it as the root
		if (node.nodeType === 'Server') {
			break;
		}
		else if (node.metadata && node.nodeType !== 'Folder') {
			// SFC URN expects Name and Schema to be separate properties
			const urnSegment = node.metadata.schema && node.metadata.schema !== '' ?
				`${nodeTypeToUrnNameMapping[node.nodeType].urnName}[@Name='${doubleEscapeSingleQuotes(node.metadata.name)}' and @Schema='${doubleEscapeSingleQuotes(node.metadata.schema)}']` :
				`${nodeTypeToUrnNameMapping[node.nodeType].urnName}[@Name='${doubleEscapeSingleQuotes(node.metadata.name)}']`;
			urnNodes = [urnSegment].concat(urnNodes);
		}
		node = await node.getParent();
	}

	return ['Server'].concat(urnNodes).join('/');
}
