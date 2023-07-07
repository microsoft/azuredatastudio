/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
use crate::auth;
use crate::constants::{
	CONTROL_PORT, IS_INTERACTIVE_CLI, PROTOCOL_VERSION_TAG, PROTOCOL_VERSION_TAG_PREFIX,
	TUNNEL_SERVICE_USER_AGENT,
};
use crate::state::{LauncherPaths, PersistedState};
use crate::util::errors::{
	wrap, AnyError, DevTunnelError, InvalidTunnelName, TunnelCreationFailed, WrappedError,
};
use crate::util::input::prompt_placeholder;
use crate::{debug, info, log, spanf, trace, warning};
use async_trait::async_trait;
use futures::TryFutureExt;
use lazy_static::lazy_static;
use rand::prelude::IteratorRandom;
use regex::Regex;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::{mpsc, watch};
use tunnels::connections::{ForwardedPortConnection, RelayTunnelHost};
use tunnels::contracts::{
	Tunnel, TunnelPort, TunnelRelayTunnelEndpoint, PORT_TOKEN, TUNNEL_PROTOCOL_AUTO,
};
use tunnels::management::{
	new_tunnel_management, HttpError, TunnelLocator, TunnelManagementClient, TunnelRequestOptions,
	NO_REQUEST_OPTIONS,
};

#[derive(Clone, Serialize, Deserialize)]
pub struct PersistedTunnel {
	pub name: String,
	pub id: String,
	pub cluster: String,
}

impl PersistedTunnel {
	pub fn into_locator(self) -> TunnelLocator {
		TunnelLocator::ID {
			cluster: self.cluster,
			id: self.id,
		}
	}
	pub fn locator(&self) -> TunnelLocator {
		TunnelLocator::ID {
			cluster: self.cluster.clone(),
			id: self.id.clone(),
		}
	}
}

#[async_trait]
trait AccessTokenProvider: Send + Sync {
	/// Gets the current access token.
	async fn refresh_token(&self) -> Result<String, WrappedError>;
}

/// Access token provider that provides a fixed token without refreshing.
struct StaticAccessTokenProvider(String);

impl StaticAccessTokenProvider {
	pub fn new(token: String) -> Self {
		Self(token)
	}
}

#[async_trait]
impl AccessTokenProvider for StaticAccessTokenProvider {
	async fn refresh_token(&self) -> Result<String, WrappedError> {
		Ok(self.0.clone())
	}
}

/// Access token provider that looks up the token from the tunnels API.
struct LookupAccessTokenProvider {
	client: TunnelManagementClient,
	locator: TunnelLocator,
	log: log::Logger,
	initial_token: Arc<Mutex<Option<String>>>,
}

impl LookupAccessTokenProvider {
	pub fn new(
		client: TunnelManagementClient,
		locator: TunnelLocator,
		log: log::Logger,
		initial_token: Option<String>,
	) -> Self {
		Self {
			client,
			locator,
			log,
			initial_token: Arc::new(Mutex::new(initial_token)),
		}
	}
}

#[async_trait]
impl AccessTokenProvider for LookupAccessTokenProvider {
	async fn refresh_token(&self) -> Result<String, WrappedError> {
		if let Some(token) = self.initial_token.lock().unwrap().take() {
			return Ok(token);
		}

		let tunnel_lookup = spanf!(
			self.log,
			self.log.span("dev-tunnel.tag.get"),
			self.client.get_tunnel(
				&self.locator,
				&TunnelRequestOptions {
					token_scopes: vec!["host".to_string()],
					..Default::default()
				}
			)
		);

		trace!(self.log, "Successfully refreshed access token");

		match tunnel_lookup {
			Ok(tunnel) => Ok(get_host_token_from_tunnel(&tunnel)),
			Err(e) => Err(wrap(e, "failed to lookup tunnel for host token")),
		}
	}
}

#[derive(Clone)]
pub struct DevTunnels {
	log: log::Logger,
	launcher_tunnel: PersistedState<Option<PersistedTunnel>>,
	client: TunnelManagementClient,
}

/// Representation of a tunnel returned from the `start` methods.
pub struct ActiveTunnel {
	/// Name of the tunnel
	pub name: String,
	/// Underlying dev tunnels ID
	pub id: String,
	manager: ActiveTunnelManager,
}

impl ActiveTunnel {
	/// Closes and unregisters the tunnel.
	pub async fn close(&mut self) -> Result<(), AnyError> {
		self.manager.kill().await?;
		Ok(())
	}

	/// Forwards a port to local connections.
	pub async fn add_port_direct(
		&mut self,
		port_number: u16,
	) -> Result<mpsc::UnboundedReceiver<ForwardedPortConnection>, AnyError> {
		let port = self.manager.add_port_direct(port_number).await?;
		Ok(port)
	}

	/// Forwards a port over TCP.
	pub async fn add_port_tcp(&mut self, port_number: u16) -> Result<(), AnyError> {
		self.manager.add_port_tcp(port_number).await?;
		Ok(())
	}

	/// Removes a forwarded port TCP.
	pub async fn remove_port(&mut self, port_number: u16) -> Result<(), AnyError> {
		self.manager.remove_port(port_number).await?;
		Ok(())
	}

	/// Gets the public URI on which a forwarded port can be access in browser.
	pub async fn get_port_uri(&mut self, port: u16) -> Result<String, AnyError> {
		let endpoint = self.manager.get_endpoint().await?;
		let format = endpoint
			.base
			.port_uri_format
			.expect("expected to have port format");

		Ok(format.replace(PORT_TOKEN, &port.to_string()))
	}
}

const VSCODE_CLI_TUNNEL_TAG: &str = "vscode-server-launcher";
const MAX_TUNNEL_NAME_LENGTH: usize = 20;

fn get_host_token_from_tunnel(tunnel: &Tunnel) -> String {
	tunnel
		.access_tokens
		.as_ref()
		.expect("expected to have access tokens")
		.get("host")
		.expect("expected to have host token")
		.to_string()
}

fn is_valid_name(name: &str) -> Result<(), InvalidTunnelName> {
	if name.len() > MAX_TUNNEL_NAME_LENGTH {
		return Err(InvalidTunnelName(format!(
			"Names cannot be longer than {} characters. Please try a different name.",
			MAX_TUNNEL_NAME_LENGTH
		)));
	}

	let re = Regex::new(r"^([\w-]+)$").unwrap();

	if !re.is_match(name) {
		return Err(InvalidTunnelName(
            "Names can only contain letters, numbers, and '-'. Spaces, commas, and all other special characters are not allowed. Please try a different name.".to_string()
        ));
	}

	Ok(())
}

lazy_static! {
	static ref HOST_TUNNEL_REQUEST_OPTIONS: TunnelRequestOptions = TunnelRequestOptions {
		include_ports: true,
		token_scopes: vec!["host".to_string()],
		..Default::default()
	};
}

/// Structure optionally passed into `start_existing_tunnel` to forward an existing tunnel.
#[derive(Clone, Debug)]
pub struct ExistingTunnel {
	/// Name you'd like to assign preexisting tunnel to use to connect to the VS Code Server
	pub tunnel_name: String,

	/// Token to authenticate and use preexisting tunnel
	pub host_token: String,

	/// Id of preexisting tunnel to use to connect to the VS Code Server
	pub tunnel_id: String,

	/// Cluster of preexisting tunnel to use to connect to the VS Code Server
	pub cluster: String,
}

impl DevTunnels {
	pub fn new(log: &log::Logger, auth: auth::Auth, paths: &LauncherPaths) -> DevTunnels {
		let mut client = new_tunnel_management(&TUNNEL_SERVICE_USER_AGENT);
		client.authorization_provider(auth);

		DevTunnels {
			log: log.clone(),
			client: client.into(),
			launcher_tunnel: PersistedState::new(paths.root().join("code_tunnel.json")),
		}
	}

	pub async fn remove_tunnel(&mut self) -> Result<(), AnyError> {
		let tunnel = match self.launcher_tunnel.load() {
			Some(t) => t,
			None => {
				return Ok(());
			}
		};

		spanf!(
			self.log,
			self.log.span("dev-tunnel.delete"),
			self.client
				.delete_tunnel(&tunnel.into_locator(), NO_REQUEST_OPTIONS)
		)
		.map_err(|e| wrap(e, "failed to execute `tunnel delete`"))?;

		self.launcher_tunnel.save(None)?;
		Ok(())
	}

	/// Renames the current tunnel to the new name.
	pub async fn rename_tunnel(&mut self, name: &str) -> Result<(), AnyError> {
		self.update_tunnel_name(None, name).await.map(|_| ())
	}

	/// Updates the name of the existing persisted tunnel to the new name.
	/// Gracefully creates a new tunnel if the previous one was deleted.
	async fn update_tunnel_name(
		&mut self,
		persisted: Option<PersistedTunnel>,
		name: &str,
	) -> Result<(Tunnel, PersistedTunnel), AnyError> {
		let name = name.to_ascii_lowercase();
		self.check_is_name_free(&name).await?;

		debug!(self.log, "Tunnel name changed, applying updates...");

		let (mut full_tunnel, mut persisted, is_new) = match persisted {
			Some(persisted) => {
				self.get_or_create_tunnel(persisted, Some(&name), NO_REQUEST_OPTIONS)
					.await
			}
			None => self
				.create_tunnel(&name, NO_REQUEST_OPTIONS)
				.await
				.map(|(pt, t)| (t, pt, true)),
		}?;

		if is_new {
			return Ok((full_tunnel, persisted));
		}

		full_tunnel.tags = vec![name.to_string(), VSCODE_CLI_TUNNEL_TAG.to_string()];

		let new_tunnel = spanf!(
			self.log,
			self.log.span("dev-tunnel.tag.update"),
			self.client.update_tunnel(&full_tunnel, NO_REQUEST_OPTIONS)
		)
		.map_err(|e| wrap(e, "failed to rename tunnel"))?;

		persisted.name = name;
		self.launcher_tunnel.save(Some(persisted.clone()))?;

		Ok((new_tunnel, persisted))
	}

	/// Gets the persisted tunnel from the service, or creates a new one.
	/// If `create_with_new_name` is given, the new tunnel has that name
	/// instead of the one previously persisted.
	async fn get_or_create_tunnel(
		&mut self,
		persisted: PersistedTunnel,
		create_with_new_name: Option<&str>,
		options: &TunnelRequestOptions,
	) -> Result<(Tunnel, PersistedTunnel, /* is_new */ bool), AnyError> {
		let tunnel_lookup = spanf!(
			self.log,
			self.log.span("dev-tunnel.tag.get"),
			self.client.get_tunnel(&persisted.locator(), options)
		);

		match tunnel_lookup {
			Ok(ft) => Ok((ft, persisted, false)),
			Err(HttpError::ResponseError(e))
				if e.status_code == StatusCode::NOT_FOUND
					|| e.status_code == StatusCode::FORBIDDEN =>
			{
				let (persisted, tunnel) = self
					.create_tunnel(create_with_new_name.unwrap_or(&persisted.name), options)
					.await?;
				Ok((tunnel, persisted, true))
			}
			Err(e) => Err(wrap(e, "failed to lookup tunnel").into()),
		}
	}

	/// Starts a new tunnel for the code server on the port. Unlike `start_new_tunnel`,
	/// this attempts to reuse or create a tunnel of a preferred name or of a generated friendly tunnel name.
	pub async fn start_new_launcher_tunnel(
		&mut self,
		preferred_name: Option<&str>,
		use_random_name: bool,
	) -> Result<ActiveTunnel, AnyError> {
		let (mut tunnel, persisted) = match self.launcher_tunnel.load() {
			Some(mut persisted) => {
				if let Some(preferred_name) = preferred_name.map(|n| n.to_ascii_lowercase()) {
					if persisted.name.to_ascii_lowercase() != preferred_name {
						(_, persisted) = self
							.update_tunnel_name(Some(persisted), &preferred_name)
							.await?;
					}
				}

				let (tunnel, persisted, _) = self
					.get_or_create_tunnel(persisted, None, &HOST_TUNNEL_REQUEST_OPTIONS)
					.await?;
				(tunnel, persisted)
			}
			None => {
				debug!(self.log, "No code server tunnel found, creating new one");
				let name = self
					.get_name_for_tunnel(preferred_name, use_random_name)
					.await?;
				let (persisted, full_tunnel) = self
					.create_tunnel(&name, &HOST_TUNNEL_REQUEST_OPTIONS)
					.await?;
				(full_tunnel, persisted)
			}
		};

		if !tunnel.tags.iter().any(|t| t == PROTOCOL_VERSION_TAG) {
			tunnel = self
				.update_protocol_version_tag(tunnel, &HOST_TUNNEL_REQUEST_OPTIONS)
				.await?;
		}

		let locator = TunnelLocator::try_from(&tunnel).unwrap();
		let host_token = get_host_token_from_tunnel(&tunnel);

		for port_to_delete in tunnel
			.ports
			.iter()
			.filter(|p| p.port_number != CONTROL_PORT)
		{
			let output_fut = self.client.delete_tunnel_port(
				&locator,
				port_to_delete.port_number,
				NO_REQUEST_OPTIONS,
			);
			spanf!(
				self.log,
				self.log.span("dev-tunnel.port.delete"),
				output_fut
			)
			.map_err(|e| wrap(e, "failed to delete port"))?;
		}

		// cleanup any old trailing tunnel endpoints
		for endpoint in tunnel.endpoints {
			let fut = self.client.delete_tunnel_endpoints(
				&locator,
				&endpoint.host_id,
				None,
				NO_REQUEST_OPTIONS,
			);

			spanf!(self.log, self.log.span("dev-tunnel.endpoint.prune"), fut)
				.map_err(|e| wrap(e, "failed to prune tunnel endpoint"))?;
		}

		self.start_tunnel(
			locator.clone(),
			&persisted,
			self.client.clone(),
			LookupAccessTokenProvider::new(
				self.client.clone(),
				locator,
				self.log.clone(),
				Some(host_token),
			),
		)
		.await
	}

	async fn create_tunnel(
		&mut self,
		name: &str,
		options: &TunnelRequestOptions,
	) -> Result<(PersistedTunnel, Tunnel), AnyError> {
		info!(self.log, "Creating tunnel with the name: {}", name);

		let mut tried_recycle = false;

		let new_tunnel = Tunnel {
			tags: vec![
				name.to_string(),
				PROTOCOL_VERSION_TAG.to_string(),
				VSCODE_CLI_TUNNEL_TAG.to_string(),
			],
			..Default::default()
		};

		loop {
			let result = spanf!(
				self.log,
				self.log.span("dev-tunnel.create"),
				self.client.create_tunnel(&new_tunnel, options)
			);

			match result {
				Err(HttpError::ResponseError(e))
					if e.status_code == StatusCode::TOO_MANY_REQUESTS =>
				{
					if !tried_recycle && self.try_recycle_tunnel().await? {
						tried_recycle = true;
						continue;
					}

					return Err(AnyError::from(TunnelCreationFailed(
						name.to_string(),
						"You've exceeded the 10 machine limit for the port fowarding service. Please remove other machines before trying to add this machine.".to_string(),
					)));
				}
				Err(e) => {
					return Err(AnyError::from(TunnelCreationFailed(
						name.to_string(),
						format!("{:?}", e),
					)))
				}
				Ok(t) => {
					let pt = PersistedTunnel {
						cluster: t.cluster_id.clone().unwrap(),
						id: t.tunnel_id.clone().unwrap(),
						name: name.to_string(),
					};

					self.launcher_tunnel.save(Some(pt.clone()))?;
					return Ok((pt, t));
				}
			}
		}
	}

	/// Ensures the tunnel contains a tag for the current PROTCOL_VERSION, and no
	/// other version tags.
	async fn update_protocol_version_tag(
		&self,
		tunnel: Tunnel,
		options: &TunnelRequestOptions,
	) -> Result<Tunnel, AnyError> {
		debug!(
			self.log,
			"Updating tunnel protocol version tag to {}", PROTOCOL_VERSION_TAG
		);
		let mut new_tags: Vec<String> = tunnel
			.tags
			.into_iter()
			.filter(|t| !t.starts_with(PROTOCOL_VERSION_TAG_PREFIX))
			.collect();
		new_tags.push(PROTOCOL_VERSION_TAG.to_string());

		let tunnel_update = Tunnel {
			tags: new_tags,
			tunnel_id: tunnel.tunnel_id.clone(),
			cluster_id: tunnel.cluster_id.clone(),
			..Default::default()
		};

		let result = spanf!(
			self.log,
			self.log.span("dev-tunnel.protocol-tag-update"),
			self.client.update_tunnel(&tunnel_update, options)
		);

		result.map_err(|e| wrap(e, "tunnel tag update failed").into())
	}

	/// Tries to delete an unused tunnel, and then creates a tunnel with the
	/// given `new_name`.
	async fn try_recycle_tunnel(&mut self) -> Result<bool, AnyError> {
		trace!(
			self.log,
			"Tunnel limit hit, trying to recycle an old tunnel"
		);

		let existing_tunnels = self.list_all_server_tunnels().await?;

		let recyclable = existing_tunnels
			.iter()
			.filter(|t| {
				t.status
					.as_ref()
					.and_then(|s| s.host_connection_count.as_ref())
					.map(|c| c.get_count())
					.unwrap_or(0) == 0
			})
			.choose(&mut rand::thread_rng());

		match recyclable {
			Some(tunnel) => {
				trace!(self.log, "Recycling tunnel ID {:?}", tunnel.tunnel_id);
				spanf!(
					self.log,
					self.log.span("dev-tunnel.delete"),
					self.client
						.delete_tunnel(&tunnel.try_into().unwrap(), NO_REQUEST_OPTIONS)
				)
				.map_err(|e| wrap(e, "failed to execute `tunnel delete`"))?;
				Ok(true)
			}
			None => {
				trace!(self.log, "No tunnels available to recycle");
				Ok(false)
			}
		}
	}

	async fn list_all_server_tunnels(&mut self) -> Result<Vec<Tunnel>, AnyError> {
		let tunnels = spanf!(
			self.log,
			self.log.span("dev-tunnel.listall"),
			self.client.list_all_tunnels(&TunnelRequestOptions {
				tags: vec![VSCODE_CLI_TUNNEL_TAG.to_string()],
				require_all_tags: true,
				..Default::default()
			})
		)
		.map_err(|e| wrap(e, "error listing current tunnels"))?;

		Ok(tunnels)
	}

	async fn check_is_name_free(&mut self, name: &str) -> Result<(), AnyError> {
		let existing = spanf!(
			self.log,
			self.log.span("dev-tunnel.rename.search"),
			self.client.list_all_tunnels(&TunnelRequestOptions {
				tags: vec![VSCODE_CLI_TUNNEL_TAG.to_string(), name.to_string()],
				require_all_tags: true,
				..Default::default()
			})
		)
		.map_err(|e| wrap(e, "failed to list existing tunnels"))?;
		if !existing.is_empty() {
			return Err(AnyError::from(TunnelCreationFailed(
				name.to_string(),
				"tunnel name already in use".to_string(),
			)));
		};
		Ok(())
	}

	async fn get_name_for_tunnel(
		&mut self,
		preferred_name: Option<&str>,
		mut use_random_name: bool,
	) -> Result<String, AnyError> {
		let existing_tunnels = self.list_all_server_tunnels().await?;
		let is_name_free = |n: &str| {
			!existing_tunnels.iter().any(|v| {
				v.status
					.as_ref()
					.and_then(|s| s.host_connection_count.as_ref().map(|c| c.get_count()))
					.unwrap_or(0) > 0 && v.tags.iter().any(|t| t == n)
			})
		};

		if let Some(machine_name) = preferred_name {
			let name = machine_name.to_ascii_lowercase();
			if let Err(e) = is_valid_name(&name) {
				info!(self.log, "{} is an invalid name", e);
				return Err(AnyError::from(wrap(e, "invalid name")));
			}
			if is_name_free(&name) {
				return Ok(name);
			}
			info!(
				self.log,
				"{} is already taken, using a random name instead", &name
			);
			use_random_name = true;
		}

		let mut placeholder_name =
			clean_hostname_for_tunnel(&gethostname::gethostname().to_string_lossy());
		placeholder_name.make_ascii_lowercase();

		if !is_name_free(&placeholder_name) {
			for i in 2.. {
				let fixed_name = format!("{}{}", placeholder_name, i);
				if is_name_free(&fixed_name) {
					placeholder_name = fixed_name;
					break;
				}
			}
		}

		if use_random_name || !*IS_INTERACTIVE_CLI {
			return Ok(placeholder_name);
		}

		loop {
			let mut name = prompt_placeholder(
				"What would you like to call this machine?",
				&placeholder_name,
			)?;

			name.make_ascii_lowercase();

			if let Err(e) = is_valid_name(&name) {
				info!(self.log, "{}", e);
				continue;
			}

			if is_name_free(&name) {
				return Ok(name);
			}

			info!(self.log, "The name {} is already in use", name);
		}
	}

	/// Hosts an existing tunnel, where the tunnel ID and host token are given.
	pub async fn start_existing_tunnel(
		&mut self,
		tunnel: ExistingTunnel,
	) -> Result<ActiveTunnel, AnyError> {
		let tunnel_details = PersistedTunnel {
			name: tunnel.tunnel_name,
			id: tunnel.tunnel_id,
			cluster: tunnel.cluster,
		};

		let mut mgmt = self.client.build();
		mgmt.authorization(tunnels::management::Authorization::Tunnel(
			tunnel.host_token.clone(),
		));

		self.start_tunnel(
			tunnel_details.locator(),
			&tunnel_details,
			mgmt.into(),
			StaticAccessTokenProvider::new(tunnel.host_token),
		)
		.await
	}

	async fn start_tunnel(
		&mut self,
		locator: TunnelLocator,
		tunnel_details: &PersistedTunnel,
		client: TunnelManagementClient,
		access_token: impl AccessTokenProvider + 'static,
	) -> Result<ActiveTunnel, AnyError> {
		let mut manager = ActiveTunnelManager::new(self.log.clone(), client, locator, access_token);

		let endpoint_result = spanf!(
			self.log,
			self.log.span("dev-tunnel.serve.callback"),
			manager.get_endpoint()
		);

		let endpoint = match endpoint_result {
			Ok(endpoint) => endpoint,
			Err(e) => {
				error!(self.log, "Error connecting to tunnel endpoint: {}", e);
				manager.kill().await.ok();
				return Err(e);
			}
		};

		debug!(self.log, "Connected to tunnel endpoint: {:?}", endpoint);

		Ok(ActiveTunnel {
			name: tunnel_details.name.clone(),
			id: tunnel_details.id.clone(),
			manager,
		})
	}
}

struct ActiveTunnelManager {
	close_tx: Option<mpsc::Sender<()>>,
	endpoint_rx: watch::Receiver<Option<Result<TunnelRelayTunnelEndpoint, WrappedError>>>,
	relay: Arc<tokio::sync::Mutex<RelayTunnelHost>>,
}

impl ActiveTunnelManager {
	pub fn new(
		log: log::Logger,
		mgmt: TunnelManagementClient,
		locator: TunnelLocator,
		access_token: impl AccessTokenProvider + 'static,
	) -> ActiveTunnelManager {
		let (endpoint_tx, endpoint_rx) = watch::channel(None);
		let (close_tx, close_rx) = mpsc::channel(1);

		let relay = Arc::new(tokio::sync::Mutex::new(RelayTunnelHost::new(locator, mgmt)));
		let relay_spawned = relay.clone();

		tokio::spawn(async move {
			ActiveTunnelManager::spawn_tunnel(
				log,
				relay_spawned,
				close_rx,
				endpoint_tx,
				access_token,
			)
			.await;
		});

		ActiveTunnelManager {
			endpoint_rx,
			relay,
			close_tx: Some(close_tx),
		}
	}

	/// Adds a port for TCP/IP forwarding.
	#[allow(dead_code)] // todo: port forwarding
	pub async fn add_port_tcp(&self, port_number: u16) -> Result<(), WrappedError> {
		self.relay
			.lock()
			.await
			.add_port(&TunnelPort {
				port_number,
				protocol: Some(TUNNEL_PROTOCOL_AUTO.to_owned()),
				..Default::default()
			})
			.await
			.map_err(|e| wrap(e, "error adding port to relay"))?;
		Ok(())
	}

	/// Adds a port for TCP/IP forwarding.
	pub async fn add_port_direct(
		&self,
		port_number: u16,
	) -> Result<mpsc::UnboundedReceiver<ForwardedPortConnection>, WrappedError> {
		self.relay
			.lock()
			.await
			.add_port_raw(&TunnelPort {
				port_number,
				protocol: Some(TUNNEL_PROTOCOL_AUTO.to_owned()),
				..Default::default()
			})
			.await
			.map_err(|e| wrap(e, "error adding port to relay"))
	}

	/// Removes a port from TCP/IP forwarding.
	pub async fn remove_port(&self, port_number: u16) -> Result<(), WrappedError> {
		self.relay
			.lock()
			.await
			.remove_port(port_number)
			.await
			.map_err(|e| wrap(e, "error remove port from relay"))
	}

	/// Gets the most recent details from the tunnel process. Returns None if
	/// the process exited before providing details.
	pub async fn get_endpoint(&mut self) -> Result<TunnelRelayTunnelEndpoint, AnyError> {
		loop {
			if let Some(details) = &*self.endpoint_rx.borrow() {
				return details.clone().map_err(AnyError::from);
			}

			if self.endpoint_rx.changed().await.is_err() {
				return Err(DevTunnelError("tunnel creation cancelled".to_string()).into());
			}
		}
	}

	/// Kills the process, and waits for it to exit.
	/// See https://tokio.rs/tokio/topics/shutdown#waiting-for-things-to-finish-shutting-down for how this works
	pub async fn kill(&mut self) -> Result<(), AnyError> {
		if let Some(tx) = self.close_tx.take() {
			drop(tx);
		}

		self.relay
			.lock()
			.await
			.unregister()
			.await
			.map_err(|e| wrap(e, "error unregistering relay"))?;

		while self.endpoint_rx.changed().await.is_ok() {}

		Ok(())
	}

	async fn spawn_tunnel(
		log: log::Logger,
		relay: Arc<tokio::sync::Mutex<RelayTunnelHost>>,
		mut close_rx: mpsc::Receiver<()>,
		endpoint_tx: watch::Sender<Option<Result<TunnelRelayTunnelEndpoint, WrappedError>>>,
		access_token_provider: impl AccessTokenProvider + 'static,
	) {
		let mut backoff = Backoff::new(Duration::from_secs(5), Duration::from_secs(120));

		macro_rules! fail {
			($e: expr, $msg: expr) => {
				warning!(log, "{}: {}", $msg, $e);
				endpoint_tx.send(Some(Err($e))).ok();
				backoff.delay().await;
			};
		}

		loop {
			debug!(log, "Starting tunnel to server...");

			let access_token = match access_token_provider.refresh_token().await {
				Ok(t) => t,
				Err(e) => {
					fail!(e, "Error refreshing access token, will retry");
					continue;
				}
			};

			// we don't bother making a client that can refresh the token, since
			// the tunnel won't be able to host as soon as the access token expires.
			let handle_res = {
				let mut relay = relay.lock().await;
				relay
					.connect(&access_token)
					.await
					.map_err(|e| wrap(e, "error connecting to tunnel"))
			};

			let mut handle = match handle_res {
				Ok(handle) => handle,
				Err(e) => {
					fail!(e, "Error connecting to relay, will retry");
					continue;
				}
			};

			backoff.reset();
			endpoint_tx.send(Some(Ok(handle.endpoint().clone()))).ok();

			tokio::select! {
				// error is mapped like this prevent it being used across an await,
				// which Rust dislikes since there's a non-sendable dyn Error in there
				res = (&mut handle).map_err(|e| wrap(e, "error from tunnel connection")) => {
					if let Err(e) = res {
						fail!(e, "Tunnel exited unexpectedly, reconnecting");
					} else {
						warning!(log, "Tunnel exited unexpectedly but gracefully, reconnecting");
						backoff.delay().await;
					}
				},
				_ = close_rx.recv() => {
					trace!(log, "Tunnel closing gracefully");
					trace!(log, "Tunnel closed with result: {:?}", handle.close().await);
					break;
				}
			}
		}
	}
}

struct Backoff {
	failures: u32,
	base_duration: Duration,
	max_duration: Duration,
}

impl Backoff {
	pub fn new(base_duration: Duration, max_duration: Duration) -> Self {
		Self {
			failures: 0,
			base_duration,
			max_duration,
		}
	}

	pub async fn delay(&mut self) {
		tokio::time::sleep(self.next()).await
	}

	pub fn next(&mut self) -> Duration {
		self.failures += 1;
		let duration = self
			.base_duration
			.checked_mul(self.failures)
			.unwrap_or(self.max_duration);
		std::cmp::min(duration, self.max_duration)
	}

	pub fn reset(&mut self) {
		self.failures = 0;
	}
}

/// Cleans up the hostname so it can be used as a tunnel name.
/// See TUNNEL_NAME_PATTERN in the tunnels SDK for the rules we try to use.
fn clean_hostname_for_tunnel(hostname: &str) -> String {
	let mut out = String::new();
	for char in hostname.chars().take(60) {
		match char {
			'-' | '_' | ' ' => {
				out.push('-');
			}
			'0'..='9' | 'a'..='z' | 'A'..='Z' => {
				out.push(char);
			}
			_ => {}
		}
	}

	let trimmed = out.trim_matches('-');
	if trimmed.len() < 2 {
		"remote-machine".to_string() // placeholder if the result was empty
	} else {
		trimmed.to_owned()
	}
}

#[cfg(test)]
mod test {
	use super::*;

	#[test]
	fn test_clean_hostname_for_tunnel() {
		assert_eq!(
			clean_hostname_for_tunnel("hello123"),
			"hello123".to_string()
		);
		assert_eq!(
			clean_hostname_for_tunnel("-cool-name-"),
			"cool-name".to_string()
		);
		assert_eq!(
			clean_hostname_for_tunnel("cool!name with_chars"),
			"coolname-with-chars".to_string()
		);
		assert_eq!(clean_hostname_for_tunnel("z"), "remote-machine".to_string());
	}
}
