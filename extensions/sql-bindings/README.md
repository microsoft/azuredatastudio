# Microsoft SQL Bindings for VS Code

## Overview

Microsoft SQL Bindings for VS Code enables users to develop Azure Functions with Azure SQL bindings

### VS Code

This extension is bundled into the `SQL Server (MSSQL)` extension for VS Code and will be installed automatically when that extension is updated or installed.

## Getting Started with SQL Bindings
 **_NOTE:_** Currently, the SQL bindings extension only supports C# Azure Functions. JavaScript and Python Azure Functions support SQL bindings but are not supported by the SQL bindings extension at this time.

### From object explorer
* To create an Azure Function from a specific table in object explorer, right-click on a table in a connected server in object explorer and select `Create Azure Function with SQL Binding.` If you have not yet created the Azure Function project, the process will create one for you before populating the Azure Function.
![Create Azure Function with SQL Binding from SQL Server table](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/sql-bindings/media/CreateAzFuncTableOE.png)

### In an existing Azure Function
* Open the C# Azure Function in an editor and then run the `MS SQL: Add SQL Binding` command from the command palette to add a SQL binding to an existing function.
![Add SQL Binding in command palette](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/sql-bindings/media/AddSQLBinding.png)

### From the command palette
* Run the `MS SQL: Create Azure Function with SQL Binding` command from the command palette to create a new function with a SQL binding. If you have not yet created the Azure Function project, the process will create one for you before populating the Azure Function.
![Create Azure Function with SQL Binding in command palette](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/sql-bindings/media/CreateAzFunc.png)

Learn more about Azure Functions with SQL bindings [here](https://aka.ms/sqlbindings).

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Telemetry

This extensions collects telemetry data, which is used to help understand how to improve the product. For example, this usage data helps to debug issues, such as slow start-up times, and to prioritize new features. While we appreciate the insights this data provides, we also know that not everyone wants to send usage data and you can disable telemetry as described [here](https://code.visualstudio.com/docs/getstarted/telemetry#_disable-telemetry-reporting).

## Privacy Statement

To learn more about our Privacy Statement visit [this link](https://go.microsoft.com/fwlink/?LinkID=824704).

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
