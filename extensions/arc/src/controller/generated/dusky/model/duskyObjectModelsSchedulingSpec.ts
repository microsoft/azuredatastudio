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

import { DuskyObjectModelsSchedulingOptions } from './duskyObjectModelsSchedulingOptions';

export class DuskyObjectModelsSchedulingSpec {
    '_default'?: DuskyObjectModelsSchedulingOptions;
    'roles'?: { [key: string]: DuskyObjectModelsSchedulingOptions; };
    'availabilityZones'?: { [key: string]: DuskyObjectModelsSchedulingOptions; };

    static discriminator: string | undefined = undefined;

    static attributeTypeMap: Array<{name: string, baseName: string, type: string}> = [
        {
            "name": "_default",
            "baseName": "default",
            "type": "DuskyObjectModelsSchedulingOptions"
        },
        {
            "name": "roles",
            "baseName": "roles",
            "type": "{ [key: string]: DuskyObjectModelsSchedulingOptions; }"
        },
        {
            "name": "availabilityZones",
            "baseName": "availability-zones",
            "type": "{ [key: string]: DuskyObjectModelsSchedulingOptions; }"
        }    ];

    static getAttributeTypeMap() {
        return DuskyObjectModelsSchedulingSpec.attributeTypeMap;
    }
}

