/**
 * SQL Server Big Data Cluster API
 * OpenAPI specification for **SQL Server Big Data Cluster**.
 *
 * The version of the OpenAPI document: 1.0.0
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


export class Endpoint {
    'name': string;
    'serviceType'?: string;
    'port': number;
    'dnsName'?: string;
    'dynamicDnsUpdate'?: boolean;

    static discriminator: string | undefined = undefined;

    static attributeTypeMap: Array<{name: string, baseName: string, type: string}> = [
        {
            "name": "name",
            "baseName": "name",
            "type": "string"
        },
        {
            "name": "serviceType",
            "baseName": "serviceType",
            "type": "string"
        },
        {
            "name": "port",
            "baseName": "port",
            "type": "number"
        },
        {
            "name": "dnsName",
            "baseName": "dnsName",
            "type": "string"
        },
        {
            "name": "dynamicDnsUpdate",
            "baseName": "dynamicDnsUpdate",
            "type": "boolean"
        }    ];

    static getAttributeTypeMap() {
        return Endpoint.attributeTypeMap;
    }
}

