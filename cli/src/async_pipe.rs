/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::{constants::APPLICATION_NAME, util::errors::CodeError};
use std::path::{Path, PathBuf};
use uuid::Uuid;

// todo: we could probably abstract this into some crate, if one doesn't already exist

cfg_if::cfg_if! {
	if #[cfg(unix)] {
		pub type AsyncPipe = tokio::net::UnixStream;
		pub type AsyncPipeWriteHalf = tokio::net::unix::OwnedWriteHalf;
		pub type AsyncPipeReadHalf = tokio::net::unix::OwnedReadHalf;

		pub async fn get_socket_rw_stream(path: &Path) -> Result<AsyncPipe, CodeError> {
			tokio::net::UnixStream::connect(path)
				.await
				.map_err(CodeError::AsyncPipeFailed)
		}

		pub async fn listen_socket_rw_stream(path: &Path) -> Result<AsyncPipeListener, CodeError> {
			tokio::net::UnixListener::bind(path)
				.map(AsyncPipeListener)
				.map_err(CodeError::AsyncPipeListenerFailed)
		}

		pub struct AsyncPipeListener(tokio::net::UnixListener);

		impl AsyncPipeListener {
			pub async fn accept(&mut self) -> Result<AsyncPipe, CodeError> {
				self.0.accept().await.map_err(CodeError::AsyncPipeListenerFailed).map(|(s, _)| s)
			}
		}

		pub fn socket_stream_split(pipe: AsyncPipe) -> (AsyncPipeReadHalf, AsyncPipeWriteHalf) {
			pipe.into_split()
		}
	} else {
		use tokio::{time::sleep, io::{AsyncRead, AsyncWrite, ReadBuf}};
		use tokio::net::windows::named_pipe::{ClientOptions, ServerOptions, NamedPipeClient, NamedPipeServer};
		use std::{time::Duration, pin::Pin, task::{Context, Poll}, io};
		use pin_project::pin_project;

		#[pin_project(project = AsyncPipeProj)]
		pub enum AsyncPipe {
			PipeClient(#[pin] NamedPipeClient),
			PipeServer(#[pin] NamedPipeServer),
		}

		impl AsyncRead for AsyncPipe {
			fn poll_read(
				self: Pin<&mut Self>,
				cx: &mut Context<'_>,
				buf: &mut ReadBuf<'_>,
			) -> Poll<io::Result<()>> {
				match self.project() {
					AsyncPipeProj::PipeClient(c) => c.poll_read(cx, buf),
					AsyncPipeProj::PipeServer(c) => c.poll_read(cx, buf),
				}
			}
		}

		impl AsyncWrite for AsyncPipe {
			fn poll_write(
				self: Pin<&mut Self>,
				cx: &mut Context<'_>,
				buf: &[u8],
			) -> Poll<io::Result<usize>> {
				match self.project() {
					AsyncPipeProj::PipeClient(c) => c.poll_write(cx, buf),
					AsyncPipeProj::PipeServer(c) => c.poll_write(cx, buf),
				}
			}

			fn poll_write_vectored(
				self: Pin<&mut Self>,
				cx: &mut Context<'_>,
				bufs: &[io::IoSlice<'_>],
			) -> Poll<Result<usize, io::Error>> {
				match self.project() {
					AsyncPipeProj::PipeClient(c) => c.poll_write_vectored(cx, bufs),
					AsyncPipeProj::PipeServer(c) => c.poll_write_vectored(cx, bufs),
				}
			}

			fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
				match self.project() {
					AsyncPipeProj::PipeClient(c) => c.poll_flush(cx),
					AsyncPipeProj::PipeServer(c) => c.poll_flush(cx),
				}
			}

			fn is_write_vectored(&self) -> bool {
				match self {
					AsyncPipe::PipeClient(c) => c.is_write_vectored(),
					AsyncPipe::PipeServer(c) => c.is_write_vectored(),
				}
			}

			fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), io::Error>> {
				match self.project() {
					AsyncPipeProj::PipeClient(c) => c.poll_shutdown(cx),
					AsyncPipeProj::PipeServer(c) => c.poll_shutdown(cx),
				}
			}
		}

		pub type AsyncPipeWriteHalf = tokio::io::WriteHalf<AsyncPipe>;
		pub type AsyncPipeReadHalf = tokio::io::ReadHalf<AsyncPipe>;

		pub async fn get_socket_rw_stream(path: &Path) -> Result<AsyncPipe, CodeError> {
			// Tokio says we can need to try in a loop. Do so.
			// https://docs.rs/tokio/latest/tokio/net/windows/named_pipe/struct.NamedPipeClient.html
			let client = loop {
				match ClientOptions::new().open(path) {
					Ok(client) => break client,
					// ERROR_PIPE_BUSY https://docs.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499-
					Err(e) if e.raw_os_error() == Some(231) => sleep(Duration::from_millis(100)).await,
					Err(e) => return Err(CodeError::AsyncPipeFailed(e)),
				}
			};

			Ok(AsyncPipe::PipeClient(client))
		}

		pub struct AsyncPipeListener {
			path: PathBuf,
			server: NamedPipeServer
		}

		impl AsyncPipeListener {
			pub async fn accept(&mut self) -> Result<AsyncPipe, CodeError> {
				// see https://docs.rs/tokio/latest/tokio/net/windows/named_pipe/struct.NamedPipeServer.html
				// this is a bit weird in that the server becomes the client once
				// they get a connection, and we create a new client.

				self.server
					.connect()
					.await
					.map_err(CodeError::AsyncPipeListenerFailed)?;

				// Construct the next server to be connected before sending the one
				// we already have of onto a task. This ensures that the server
				// isn't closed (after it's done in the task) before a new one is
				// available. Otherwise the client might error with
				// `io::ErrorKind::NotFound`.
				let next_server = ServerOptions::new()
					.create(&self.path)
					.map_err(CodeError::AsyncPipeListenerFailed)?;


				Ok(AsyncPipe::PipeServer(std::mem::replace(&mut self.server, next_server)))
			}
		}

		pub async fn listen_socket_rw_stream(path: &Path) -> Result<AsyncPipeListener, CodeError> {
			let server = ServerOptions::new()
					.first_pipe_instance(true)
					.create(path)
					.map_err(CodeError::AsyncPipeListenerFailed)?;

			Ok(AsyncPipeListener { path: path.to_owned(), server })
		}

		pub fn socket_stream_split(pipe: AsyncPipe) -> (AsyncPipeReadHalf, AsyncPipeWriteHalf) {
			tokio::io::split(pipe)
		}
	}
}

/// Gets a random name for a pipe/socket on the paltform
pub fn get_socket_name() -> PathBuf {
	cfg_if::cfg_if! {
		if #[cfg(unix)] {
			std::env::temp_dir().join(format!("{}-{}", APPLICATION_NAME, Uuid::new_v4()))
		} else {
			PathBuf::from(format!(r"\\.\pipe\{}-{}", APPLICATION_NAME, Uuid::new_v4()))
		}
	}
}
