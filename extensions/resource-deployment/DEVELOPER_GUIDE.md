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

`platforms` - The OS platforms that the type supports running on, use `*` for all.

`icon` - The icon to display for the type - supports either single icon or separate ones for light and dark mode.

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

There are a number of different types of providers that can be used which affect what happens when the user selects that provider. These are indicated by what fields the provider contains - the provider is checked in order of top to bottom for each property and use the first type that it finds in the properties for that provider.

`Notebook Wizard` - A wizard is opened that can be used to prompt the user for values and display information, and then at the very end will open the specified Notebook with those values injected in. Indicated by the presence of the `notebookWizard` property.

`Dialog` - A single page dialog is opened that can be used to prompt the user for values. Indicated by the presence of the `dialog` property.

`Notebook` - The specified Notebook is opened for the user to run. Indicated by the presence of the `notebook` property.

`Download` - An installer is downloaded and ran. Indicated by the presence of the `downloadUrl` property.

`Web Page` - The specified URL is opened in the default browser for the user. Indicated by the presence of the `webPageUrl` property.

`Command` - The specified command is executed. Indicated by the presence of the `command` property.

### AgreementInfo

**TODO**


