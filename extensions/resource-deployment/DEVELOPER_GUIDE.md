# Resource Deployment Extension Developer Guide

This guide is meant to provide details on what this extension does and how other extension authors are meant to use it. If there is any missing or incorrect information please submit an [issue](https://github.com/microsoft/azuredatastudio/issues).

## Overview

This extension provides a way for other extension authors to contribute types to the Resource Deployment Wizard which allows users to create and deploy resources such as servers.

This wizard is launched by either running the `Deployment: New Deployment...` command from the command palette or by clicking the `...` on the `Connections` pane and selecting `New Deployment...`

## How to Contribute a new Type

Resource Deployment types are contributed through the `package.json` of a loaded extension. This is done by adding an `resourceDeploymentTypes` property under the `contributes` section of your `package.json`.

``` json
   ... // Other sections in your package.json
   "contributes": {
	   ..., // Other contributions
	   "resourceDeploymentTypes": [
		   // provided types go here
	   ]
   }
```

The rest of this guide will detail the various options and configuration available to provided types - most contributions will only need a subset of the available features.

The [sample-resource-deployment](https://github.com/microsoft/azuredatastudio/tree/main/samples/sample-resource-deployment) extension provides working examples of contributed sample resource deployment types.

## resourceDeploymentTypes Schema

The contribution must adhere to a specific schema, if there is an error in your `package.json` such as an unexpected type then this may result in errors in both your extension and the feature as a whole.

**!! THIS IS A WORK IN PROGRESS, IF YOU NEED INFORMATION ON A SPECIFIC TOPIC PLEASE OPEN AN ISSUE!**

### resourceDeploymentTypes

This is the top contribution and must be an array of [ResourceType](#resourcetype) objects.

``` json
"resourceDeploymentTypes": [
	{
		... // Contributed type
	},
	{
		... // Another contributed type
	}
]
```

### ResourceType

The type is defined [here](https://github.com/microsoft/azuredatastudio/blob/main/extensions/resource-deployment/src/interfaces.ts#L13).

There are a number of properties on each `ResourceType`.

`name` - The name of the type, this is not displayed to the user so should be a non-localized value and typically `-` delimited (e.g. `my-resource-type`)

`displayName` - The name of the type displayed to the user, this should be a localized string

`description` - The description of the type displayed to the user

`platforms` - The OS platforms that the type supports running on, options are `linux` (Linux distros), `darwin` (MacOS), `win32` (Windows) or`*` for all.

`icon` - The icon to display for the type - supports either single icon or separate ones for light and dark mode. The icon should be in `svg` format.

`options` - An array of [ResourceTypeOption](#resourcetypeoption) objects, allowing users to provide different sub-options for a given resource type. (e.g. the specific version of SQL Server to deploy)

`providers` - An array of [DeploymentProvider](#deploymentprovider) objects which define the wizards, dialogs or other means for a user to deploy their resource.

`agreements` - **OPTIONAL** An array of [AgreementInfo](#agreementinfo) objects which define any agreements the user must accept before proceeding with the deployment.

`displayIndex` - **OPTIONAL** A number corresponding to where the type should be displayed relative to the other types. A lower number means it will show up earlier in the list. Any types which don't specify this value will be shown last.

`okButtonText` - **OPTIONAL** The text to use for the `OK` button at the bottom of the Type Picker dialog. Default is `Select`.

`helpTexts` - **OPTIONAL** An array of strings to display to the user providing more information for the resource type (such as links to docs)

`tags` - **OPTIONAL** An array of strings that are used to indicate the category that the resource type belongs to. The usable tags are defined [here](https://github.com/microsoft/azuredatastudio/blob/main/extensions/resource-deployment/src/constants.ts#L10).


### ResourceTypeOption

**TODO**

### DeploymentProvider

#### Provider Types

There are a number of different types of providers that can be used which affect what happens when the user selects that provider. These are indicated by what fields the provider contains - the provider is checked in order of top to bottom for each property and uses the first type that it finds in the properties for that provider.

`Notebook Wizard` - A wizard is opened that can be used to prompt the user for values and display information, and then at the very end will open the specified Notebook with those values injected in. Indicated by the presence of the `notebookWizard` property.

`Dialog` - A single page dialog is opened that can be used to prompt the user for values. Indicated by the presence of the `dialog` property.

`Notebook` - The specified Notebook is opened for the user to run. Indicated by the presence of the `notebook` property.

`Download` - An installer is downloaded and ran. Indicated by the presence of the `downloadUrl` property.

`Web Page` - The specified URL is opened in the default browser for the user. Indicated by the presence of the `webPageUrl` property.

`Command` - The specified command is executed. Indicated by the presence of the `command` property.

### AgreementInfo

**TODO**

### NotebookWizard (extends [WizardInfoBase](#wizardinfobase))

See [NotebookWizardInfo](https://github.com/microsoft/azuredatastudio/blob/main/extensions/resource-deployment/src/interfaces.ts#L170) for how it's defined in code.

`notebook` - The path to the Python-based Notebook that is used as a template for the wizard.

`pages` - An array of [NotebookWizardPageInfo](#notebookwizardpageinfo) containing information for each page in the Notebook Wizard.

`codeCellInsertionPosition` - **OPTIONAL** The index of the code cell to insert the injected parameters cell. Default is 0.

### WizardInfoBase

`type` - **OPTIONAL** This is an internal type only used for BDC deployment wizards. Any other deployment providers can leave it out.

`doneAction`

`scriptAction` - **OPTIONAL**

`title`

`name` - **OPTIONAL**

`pages` - An array of the pages for this wizard. Each wizard implementation will usually have its own page type that extends [PageInfoBase](#pageinfobase).

`isSummaryPageAutoGenerated` - **OPTIONAL**

### NotebookWizardPageInfo (extends [PageInfoBase](#pageinfobase))

`description` - **OPTIONAL** The page description to display at the top of the page.

### PageInfoBase

`title` - The title to display for the page

`isSummaryPage` - **OPTIONAL** Whether this page is set as a summary page that displays a summary of the Note

`sections` - An array of [SectionInfo] objects containing the details of each section to display on this page.

### SectionInfo (extends [FieldInfoBase](#fieldinfobase))

`title` - **OPTIONAL** The title to display at the top of the section

`fields` - **OPTIONAL** An array of [FieldInfo](#fieldinfo) objects containing details for each field in this section.

`rows` - **OPTIONAL** Used for wide dialogs or wizards, the label for each field will be placed to the left of the field component.

`collapsible` - **OPTIONAL** Whether the section is collapsible or not. Default is `true`.

`collapsed` - **OPTIONAL** Whether the section starts off collapsed. Default is `false`.

`spaceBetweenFields` - **OPTIONAL** A string defining how much space should be between each field. Default is `50px`.

### FieldInfo

`subFields`

`type`

`defaultValue`

`confirmationRequired`

`confirmationLabel`

`min`

`max`

`required`

`options` - **REQUIRED** if `type` is `options`. See [Options](#options) for more information.

`placeHolder`

`description`

`labelCSSStyles`

`fontWeight`

`editable`

`enabled`

`dynamicOptions`

`isEvaluated`

`validations`

`valueProvider` - **OPTIONAL** If defined then the value for this field is retrieved using the specified [Value Provider](#value-provider).

#### Options

This defines the set of options for this field to display. There are a number of different ways to configure the set of options :

* String array (`string[]`) - A static list of values that will be shown as a dropdown. Default value selected is defined as `FieldInfo.defaultValue`.

* CategoryValue array (`azdata.CategoryValue[]`) - A static list of CategoryValue objects that will be shown as a dropdown. Each value will define a display name separate from its value - use this for values you want to display differently to the user (such as names for an Azure region). If you use a CategoryValue array as your options, ensure you set the defaultValue to the CategoryValue's displayName rather than the name.

* [OptionsInfo](#optionsinfo) - An object allowing more control over the option values.

* [Dynamic Options](#dynamicoptions) - Change the options available for one field based on the option selected in another. Radio buttons only. Can use CategoryValue type as values.

See [sample-options](https://github.com/microsoft/azuredatastudio/blob/main/samples/sample-resource-deployment/package.json) for example implementations.

##### OptionsInfo

This object defines a set of options for a field, similar to the arrays that can be used for the [options](#options) field but with greater control over of the options. Currently there are two reasons that you would use this object over the arrays - either you want to display the options as something other than a dropdown or you wish to use an [Options Source Provider](#options-source-provider) to populate the options dynamically.

`values` - An array of either `strings` or `azdata.CategoryValue` objects. See [options](#options) for more details on each of those.
`defaultValue` - The string value of the default option to have selected
`optionsType` - How to display the options, either `radio` or `dropdown`
`source` - OPTIONAL If set defines the [Options Source Provider](#options-source-provider) to use for populating the options dynamically.

### Dynamic Options
This enables you to dynamically change what options for a field are displayed to the user based on a previous selection they made. 
For example, if a user selects "Cookies" over "Cakes" in the first field, the second field will show options ["Chocolate chip", "Snickerdoodle"] instead of ["Red velvet", "Cheesecake", "Black forest"], and vice versa.

**NOTE** This is currently only enabled for radio buttons. This works with [CategoryValue](#fieldinfo) values as well.

Placement of the `dynamicOptions` object in the package.json should be in the field whose values are doing the changing, **not** in the field whose value **determines** the other fields' options.

`target` - The *variable name* of the field to look at in order to detemine what options the current field should use.

`alternates` - An array of objects in which the objects represent the *alternate* options of the current field. An object has three values: `selection`, `alternateValues`, and `defaultValue`. `selection` is the variable name of a value in the target field that was not selected by default. `alternateValues` is an array of values that will be shown as options *if* the value in `selection` is chosen in the target field. `defaultValue` is simply the value that is selected by default out of the array of `alternateValues`.

``` json
			...
			"variableName": "AZDATA_NB_VAR_COOKIE_TYPES", // Our current field's name
                        "options": {
                          "values": ["Chocolate chip", "Snickerdoodle"], // Since Cookies is the default selection for the target field, these will be the values shown for this current field.
                          "defaultValue": "Chocolate chip",
                          "optionsType": "radio"
                        },
                        "dynamicOptions":
                        {
                          "target": "AZDATA_NB_VAR_DESSERT_TYPES", // The field that determines what options our current field will show
                          "alternates": [
                            {
                              "selection": "Cakes", // If the user selected Cakes previously, the options shown will be as follows:
                              "alternateValues": [
                                "Red velvet",
				"Cheesecake",
				"Black forest"
                              ],
                              "defaultValue": "Red velvet"
                            }
                          ]
                        }
```


### Options Source Provider

### Value Provider

When a field specifies a value provider then it is saying that the value for that field is dynamic and will be retrieved from a value provider that is registered by an extension separately. This can be used for more complex logic such as running calculations, reading files, making web requests, etc.

See [sample-value-provider](https://github.com/microsoft/azuredatastudio/blob/main/samples/sample-resource-deployment/package.json) for an example implementation.

**NOTE** There is currently some behavior that should be known before using this :

1. The value providers are hooked up after all the components are made, so order doesn't generally matter (you don't have to define the trigger fields before the target field) when the values are on the same page.
2. If the fields are on different pages then currently the hookup logic is non-deterministic and so you may end up with trigger components not existing yet if they are on a different page which hasn't completed its initialization. **So currently having a value provider that has trigger fields on another page is not something officially supported. Contact the dev team if you need this for your scenario**

`providerId` - The string ID of this provider, this must be registered by an extension using [registerValueProvider](https://github.com/microsoft/azuredatastudio/blob/main/extensions/resource-deployment/src/typings/resource-deployment.d.ts#L47).

`triggerFields` - The field IDs (`variableName` or `label`) of the fields that - when changed - will trigger `getValue` to be called and the result set as the value of the dependent field. **NOTE** While `variableName` OR `label` is supported it is generally strongly suggested to use a `variableName` (even if you don't need that variable in the final deployment target) due to potential localization mismatches that could happen between the localized strings in the package.json and the ones used by the `valueProvider`.

