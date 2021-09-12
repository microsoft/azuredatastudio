# Azure Monitor Logs extension for Azure Data Studio (Preview)

Connect and query Log Analytics workspaces with Azure Data Studio, a modern data editor available for Linux, MacOS, and Windows. This extension enables you to interact with Azure Monitor Logs using Azure Data Studio features like:

- Connect to Log Analytics workspaces.
- Searchable object explorer view for database objects.
- Query authoring and editing with Intellisense and syntax highlighting.
- Create a notebook with Azure Monitor Logs.
- View query results and save to CSV, JSON, XML, Excel, or as a chart.

## Connect to an Log Analytics workspace

You can connect to an Log Analytics workspace with Azure Data Studio.

Select **New Connection** and choose **Azure Monitor Logs** for the **Connection Type**.

Once connected to a cluster, you can start writing a KQL query, run it and a view the results to save it to CSV, JSON, XML, Excel, or as a chart as shown below.

![Azure Monitor Logs query in Azure Data Studio](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/azuremonitor/resources/images/azuremonitorlogs-readme-query.png)

## Contributing to the Extension

This extension lives in the [azuredatastudio repo](https://github.com/microsoft/azuredatastudio) and follows the same guidelines for contribution. If you are interested in fixing issues and contributing directly to the code base, see the document [How to Contribute](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute), which covers the following:

- [How to build and run from source](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute#Build-and-Run-From-Source)
- [The development workflow, including debugging and running tests](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute#development-workflow)
- [Submitting pull requests](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute#pull-requests)

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Privacy Statement

The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/privacystatement) describes the privacy statement of this software.

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
