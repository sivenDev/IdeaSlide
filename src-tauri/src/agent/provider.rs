use rig_core::{client::CompletionClient, providers::openai};

pub(crate) fn completion_model(
    api_key: String,
    base_url: &str,
    model: &str,
) -> Result<openai::completion::CompletionModel<reqwest::Client>, String> {
    let client = openai::Client::builder()
        .api_key(api_key)
        .base_url(base_url.trim_end_matches('/'))
        .build()
        .map_err(|error| format!("AI provider could not be initialized: {error}"))?
        .completions_api();
    Ok(client.completion_model(model))
}
