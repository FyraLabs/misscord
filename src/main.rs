use color_eyre::{
    eyre::{eyre, Context},
    Result,
};
use dotenvy::dotenv;
use futures::{future::try_join_all, stream::TryStreamExt};
use misskey::{
    model::{antenna::Antenna, id::Id},
    prelude::*,
    WebSocketClient,
};
use std::env;
use url::Url;
use webhook::client::WebhookClient;

async fn relay_antenna_to_discord(
    client: &WebSocketClient,
    url: &Url,
    id: Id<Antenna>,
    discord_webhook: &str,
) -> Result<()> {
    let discord_client = WebhookClient::new(discord_webhook);

    let mut channel = client.antenna_timeline(id).await?;

    while let Some(note) = channel.try_next().await? {
        let note_url = url.join("notes/")?.join(&note.id.to_string())?;
        discord_client
            .send(|message| message.content(note_url.as_str()))
            .await
            .map_err(|e| eyre!(e))?;
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    dotenv().ok();

    let misskey_token = env::var("MISSKEY_TOKEN").context("MISSKEY_TOKEN is not set")?;
    let misskey_url = Url::parse(&env::var("MISSKEY_URL").context("MISSKEY_URL is not set")?)
        .context("MISSKEY_URL is not a valid URL")?;

    let mut streaming_url = misskey_url.join("/streaming")?;

    streaming_url
        .set_scheme("wss")
        .map_err(|_| eyre!("Could not change URL scheme to wss"))?;

    let client = WebSocketClient::builder(streaming_url)
        .token(misskey_token)
        .connect()
        .await?;

    let antenna_mappings =
        env::var("MISSKEY_ANTENNA_MAPPINGS").context("MISSKEY_ANTENNA_MAPPINGS is not set")?;
    let relays: Result<Vec<_>> = antenna_mappings
        .split(' ')
        .map(|pair| {
            let mut split = pair.split('=');
            let id = split
                .next()
                .ok_or_else(|| eyre!("Could not get ID from antenna pair"))?;
            let webhook = split
                .next()
                .ok_or_else(|| eyre!("Could not get webhook URL from antenna pair"))?;

            Ok(relay_antenna_to_discord(
                &client,
                &misskey_url,
                id.parse().context("Could not parse into a Misskey ID")?,
                webhook,
            ))
        })
        .collect();

    try_join_all(relays?).await?;

    Ok(())
}
