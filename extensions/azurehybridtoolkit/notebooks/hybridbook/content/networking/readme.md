# Networking
[Home](../readme.md)

This chapter contains notebooks to configure and make a secure network connection in an Azure hybrid cloud environment. 

<img width="50%" src="https://docs.microsoft.com/en-us/azure/vpn-gateway/media/point-to-site-about/p2s.png">

## Notebooks in this Chapter
- [Download VPN Client Certificate](download-VpnClient.ipynb) - Used to install certificates that encrypt communication between on-site and Azure services

- [Create Point-to-Site VPN](p2svnet-creation.ipynb) - Enables secure **Point-to-Site** (P2S) communication between a virtual private network in Azure and local resources. P2S is used by individuals and small groups for remote connectivity. A Point-to-Site (P2S) VPN gateway connection lets you create a secure connection to your VPN from an individual client computer. A P2S connection is established by starting it from the client computer. This solution is useful for telecommuters who want to connect to Azure VNets from a remote location, such as from home or a conference. P2S VPN is also a useful solution to use instead of S2S VPN when you have only a few clients that need to connect to a virtual network.

- [Create Site-to-Site VPN](s2svnet-creation.ipynb) - **Site-to-site** (S2S) is normally used by organizations that want greater control between on-premise and cloud resources using a VPN gateway. A S2S VPN gateway connection is used to connect your on-premises network to an Azure virtual network over an IPsec/IKE (IKEv1 or IKEv2) VPN tunnel. This type of connection requires a VPN device located on-premises that has an externally facing public IP address assigned to it. For more information about VPN gateways, see [About VPN gateway](https://docs.microsoft.com/en-us/azure/vpn-gateway/vpn-gateway-about-vpngateways) and [Create and manage S2S VPN connections using PowerShell](https://docs.microsoft.com/en-us/azure/vpn-gateway/vpn-gateway-tutorial-vpnconnection-powershell "https://docs.microsoft.com/en-us/azure/vpn-gateway/vpn-gateway-tutorial-vpnconnection-powershell"). **NOTE:** *May require the help of a Network Administrator or similar role to setup a secure Gateway*.