# Database Admin Tool Extensions for Windows *(preview)*

The Database Admin Tool Extensions for Windows adds Windows-specific functionality into Azure Data Studio. Currently this
functionality includes the ability to launch a set of SQL Server Management Studio experiences directly from Azure Data Studio.

These experiences include:

* SSMS Property dialogs for select object types, such as Databases, Views, Stored Procedures and more
* The [Generate Scripts Wizard](https://docs.microsoft.com/en-us/sql/ssms/scripting/generate-and-publish-scripts-wizard)

### How do I launch these experiences?

Both of these are available as menu items on the context menu for nodes in the Object Explorer tree. Right click on a node that supports one of the experiences and select the appropriate item.

**Properties** for the property dialogs of supported object types

![Properties](https://user-images.githubusercontent.com/28519865/58999549-13a93080-87bb-11e9-82e4-6dd3f5de5c13.png)

**Generate Scripts...** for the Generate Scripts Wizard (only available on Database nodes)

![Generate Scripts Wizard](https://user-images.githubusercontent.com/28519865/58999482-e2306500-87ba-11e9-9f21-6c5a4996e529.png)

## Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Privacy Statement

The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement) describes the privacy statement of this software.

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
