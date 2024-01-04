/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class TableDesignerMetadata {

	// Allowed metadata for every provider
	public static mssqlAllowedMetdata: Set<string> = new Set(['isNode', 'isEdge', 'isSystemVersioned']);

	// Provider ID to allowed metadata list set mapping
	public static providerMetadataMap: Map<string, Set<string>> = new Map<string, Set<string>>([
		['MSSQL', TableDesignerMetadata.mssqlAllowedMetdata]
	]);

	/**
	 * Validates given metadata and adds metadata from the allowed list
	 * @param providerId provider ID for the table designer provider
	 * @param metadata incoming metadata from the table designer provider
	 * @returns filtered telemetry info with only allowed metadata points
	 */
	public static getTelemetryInfo(providerId: string, metadata: { [key: string]: string }): { [key: string]: string } {
		if (!TableDesignerMetadata.providerMetadataMap.has(providerId) || !metadata) {
			return {};
		}
		const allowedSet = TableDesignerMetadata.providerMetadataMap.get(providerId);
		for (const key of Object.keys(metadata)) {
			if (!allowedSet.has(key)) {
				delete metadata[key];
			}
		}
		return metadata;
	}
}
