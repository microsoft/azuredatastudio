/**
 * Dusky API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: v1
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


export class V1PhotonPersistentDiskVolumeSource {
    'fsType'?: string;
    'pdID'?: string;

    static discriminator: string | undefined = undefined;

    static attributeTypeMap: Array<{name: string, baseName: string, type: string}> = [
        {
            "name": "fsType",
            "baseName": "fsType",
            "type": "string"
        },
        {
            "name": "pdID",
            "baseName": "pdID",
            "type": "string"
        }    ];

    static getAttributeTypeMap() {
        return V1PhotonPersistentDiskVolumeSource.attributeTypeMap;
    }
}

