/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MetadataType } from 'sql/platform/connection/common/connectionManagement';
import { ObjectMetadata } from 'azdata';

export class ObjectMetadataWrapper implements ObjectMetadata {
	public metadataType: MetadataType;
	public metadataTypeName: string;
	public urn: string;
	public name: string;
	public schema: string;

	public get fullName(): string {
		return `${this.schema}.${this.name}`;
	}

	constructor(from?: ObjectMetadata) {
		if (from) {
			this.metadataType = from.metadataType;
			this.metadataTypeName = from.metadataTypeName;
			this.urn = from.urn;
			this.name = from.name;
			this.schema = from.schema;
		}
	}

	public matches(other: ObjectMetadataWrapper): boolean {
		if (!other) {
			return false;
		}

		return this.metadataType === other.metadataType
			&& this.schema === other.schema
			&& this.name === other.name;
	}

	public static createFromObjectMetadata(objectMetadata: ObjectMetadata[]): ObjectMetadataWrapper[] {
		if (!objectMetadata) {
			return undefined;
		}

		return objectMetadata.map(m => new ObjectMetadataWrapper(m));
	}

	// custom sort : Table > View > Stored Procedures > Function
	public static sort(metadata1: ObjectMetadataWrapper, metadata2: ObjectMetadataWrapper): number {
		// compare the object type
		if (metadata1.metadataType < metadata2.metadataType) {
			return -1;
		} else if (metadata1.metadataType > metadata2.metadataType) {
			return 1;

			// otherwise compare the schema
		} else {
			const schemaCompare: number = metadata1.schema && metadata2.schema
				? metadata1.schema.localeCompare(metadata2.schema)
				// schemas are not expected to be undefined, but if they are then compare using object names
				: 0;

			if (schemaCompare !== 0) {
				return schemaCompare;

				// otherwise compare the object name
			} else {
				return metadata1.name.localeCompare(metadata2.name);
			}
		}
	}
}
