use std::collections::VecDeque;

use super::types::{AgentProviderStrategy, AgentStreamingTelemetry, StreamingBehavior};

pub(crate) const DENSE_WINDOW_MS: u64 = 100;
pub(crate) const MAX_TEXT_SAMPLES: usize = 4_096;
const BURST_DENSITY_PERCENT: u8 = 90;
const INCREMENTAL_MIN_SPAN_MS: u64 = 400;

#[derive(Clone, Copy, Debug)]
struct TextSample {
    at_ms: u64,
    character_count: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct TextDeliveryMetrics {
    pub first_event_ms: Option<u64>,
    pub first_text_ms: Option<u64>,
    pub text_span_ms: u64,
    pub text_delta_count: u32,
    pub text_character_count: u32,
    pub p50_inter_delta_ms: Option<u64>,
    pub p95_inter_delta_ms: Option<u64>,
    pub densest_window_percent: u8,
    pub behavior: StreamingBehavior,
}

#[derive(Default)]
pub(crate) struct TextDeliveryTelemetryCollector {
    first_event_ms: Option<u64>,
    first_text_ms: Option<u64>,
    last_text_ms: Option<u64>,
    text_delta_count: u32,
    text_character_count: u32,
    samples: VecDeque<TextSample>,
    inter_delta_gaps_ms: VecDeque<u64>,
}

impl TextDeliveryTelemetryCollector {
    pub(crate) fn observe_event(&mut self, at_ms: u64) {
        self.first_event_ms.get_or_insert(at_ms);
    }

    pub(crate) fn observe_text(&mut self, at_ms: u64, text: &str) {
        if text.is_empty() {
            return;
        }
        self.observe_event(at_ms);
        let character_count = text.chars().count().min(u32::MAX as usize) as u32;
        if character_count == 0 {
            return;
        }
        if let Some(last_text_ms) = self.last_text_ms {
            push_bounded(
                &mut self.inter_delta_gaps_ms,
                at_ms.saturating_sub(last_text_ms),
            );
        }
        self.first_text_ms.get_or_insert(at_ms);
        self.last_text_ms = Some(at_ms);
        self.text_delta_count = self.text_delta_count.saturating_add(1);
        self.text_character_count = self.text_character_count.saturating_add(character_count);
        push_bounded(
            &mut self.samples,
            TextSample {
                at_ms,
                character_count,
            },
        );
    }

    pub(crate) fn metrics(&self) -> TextDeliveryMetrics {
        let text_span_ms = match (self.first_text_ms, self.last_text_ms) {
            (Some(first), Some(last)) => last.saturating_sub(first),
            _ => 0,
        };
        let mut gaps = self.inter_delta_gaps_ms.iter().copied().collect::<Vec<_>>();
        gaps.sort_unstable();
        let densest_window_percent = densest_window_percent(&self.samples);
        let behavior =
            classify_text_delivery(self.text_delta_count, text_span_ms, densest_window_percent);
        TextDeliveryMetrics {
            first_event_ms: self.first_event_ms,
            first_text_ms: self.first_text_ms,
            text_span_ms,
            text_delta_count: self.text_delta_count,
            text_character_count: self.text_character_count,
            p50_inter_delta_ms: percentile(&gaps, 50),
            p95_inter_delta_ms: percentile(&gaps, 95),
            densest_window_percent,
            behavior,
        }
    }

    pub(crate) fn finish(
        &self,
        strategy: AgentProviderStrategy,
        attempts: u8,
        request_ms: u64,
        total_ms: u64,
    ) -> AgentStreamingTelemetry {
        build_streaming_telemetry(strategy, attempts, request_ms, total_ms, self.metrics())
    }
}

pub(crate) fn build_streaming_telemetry(
    strategy: AgentProviderStrategy,
    attempts: u8,
    request_ms: u64,
    total_ms: u64,
    metrics: TextDeliveryMetrics,
) -> AgentStreamingTelemetry {
    AgentStreamingTelemetry {
        strategy,
        attempts,
        request_ms,
        first_event_ms: metrics.first_event_ms,
        first_text_ms: metrics.first_text_ms,
        text_span_ms: metrics.text_span_ms,
        total_ms,
        text_delta_count: metrics.text_delta_count,
        text_character_count: metrics.text_character_count,
        p50_inter_delta_ms: metrics.p50_inter_delta_ms,
        p95_inter_delta_ms: metrics.p95_inter_delta_ms,
        densest_window_percent: metrics.densest_window_percent,
        behavior: metrics.behavior,
    }
}

fn push_bounded<T>(values: &mut VecDeque<T>, value: T) {
    if values.len() == MAX_TEXT_SAMPLES {
        values.pop_front();
    }
    values.push_back(value);
}

fn percentile(sorted: &[u64], percentile: usize) -> Option<u64> {
    if sorted.is_empty() {
        return None;
    }
    let index = ((sorted.len() - 1) * percentile).div_ceil(100);
    sorted.get(index).copied()
}

fn densest_window_percent(samples: &VecDeque<TextSample>) -> u8 {
    if samples.is_empty() {
        return 0;
    }
    let samples = samples.iter().copied().collect::<Vec<_>>();
    let sampled_characters = samples.iter().fold(0_u64, |total, sample| {
        total.saturating_add(u64::from(sample.character_count))
    });
    if sampled_characters == 0 {
        return 0;
    }
    let mut left = 0_usize;
    let mut window_characters = 0_u64;
    let mut densest_characters = 0_u64;
    for right in 0..samples.len() {
        window_characters =
            window_characters.saturating_add(u64::from(samples[right].character_count));
        while samples[right].at_ms.saturating_sub(samples[left].at_ms) > DENSE_WINDOW_MS {
            window_characters =
                window_characters.saturating_sub(u64::from(samples[left].character_count));
            left += 1;
        }
        densest_characters = densest_characters.max(window_characters);
    }
    densest_characters
        .saturating_mul(100)
        .div_ceil(sampled_characters)
        .min(100) as u8
}

fn classify_text_delivery(
    text_delta_count: u32,
    text_span_ms: u64,
    densest_window_percent: u8,
) -> StreamingBehavior {
    if text_delta_count == 1 {
        StreamingBehavior::Atomic
    } else if text_delta_count >= 2 && densest_window_percent >= BURST_DENSITY_PERCENT {
        StreamingBehavior::Burst
    } else if text_delta_count >= 3 && text_span_ms >= INCREMENTAL_MIN_SPAN_MS {
        StreamingBehavior::Incremental
    } else {
        StreamingBehavior::Unknown
    }
}

#[cfg(test)]
mod tests {
    use super::{TextDeliveryTelemetryCollector, DENSE_WINDOW_MS, MAX_TEXT_SAMPLES};
    use crate::agent::types::{AgentProviderStrategy, StreamingBehavior};

    fn telemetry(
        samples: &[(u64, &str)],
        total_ms: u64,
    ) -> crate::agent::types::AgentStreamingTelemetry {
        let mut collector = TextDeliveryTelemetryCollector::default();
        for (at_ms, text) in samples {
            collector.observe_event(*at_ms);
            collector.observe_text(*at_ms, text);
        }
        collector.finish(AgentProviderStrategy::Responses, 1, 12, total_ms)
    }

    #[test]
    fn classifies_codex_style_dense_delivery_as_burst() {
        let samples = (0..149)
            .map(|index| (8_378 + (index * 4 / 148), "word "))
            .collect::<Vec<_>>();
        let telemetry = telemetry(&samples, 8_445);
        assert_eq!(telemetry.behavior, StreamingBehavior::Burst);
        assert_eq!(telemetry.text_delta_count, 149);
        assert_eq!(telemetry.text_span_ms, 4);
        assert!(telemetry.densest_window_percent >= 90);
    }

    #[test]
    fn distinguishes_atomic_incremental_and_unknown_delivery() {
        let atomic = telemetry(&[(500, "one complete answer")], 520);
        assert_eq!(atomic.behavior, StreamingBehavior::Atomic);

        let incremental = telemetry(&[(100, "first "), (350, "second "), (620, "third")], 700);
        assert_eq!(incremental.behavior, StreamingBehavior::Incremental);
        assert_eq!(incremental.text_span_ms, 520);
        assert_eq!(incremental.p50_inter_delta_ms, Some(270));

        let unknown = telemetry(&[(100, "first"), (350, "second")], 400);
        assert_eq!(unknown.behavior, StreamingBehavior::Unknown);
    }

    #[test]
    fn counts_only_non_empty_text_and_keeps_samples_bounded() {
        let mut collector = TextDeliveryTelemetryCollector::default();
        collector.observe_event(5);
        collector.observe_text(5, "");
        for index in 0..(MAX_TEXT_SAMPLES + 20) {
            collector.observe_text(index as u64, "x");
        }
        let collected = collector.finish(AgentProviderStrategy::Responses, 1, 5, 6_000);
        assert_eq!(collected.text_delta_count, (MAX_TEXT_SAMPLES + 20) as u32);
        assert_eq!(
            collected.text_character_count,
            (MAX_TEXT_SAMPLES + 20) as u32
        );
        assert_eq!(collector.samples.len(), MAX_TEXT_SAMPLES);
        assert_eq!(DENSE_WINDOW_MS, 100);

        let dense = telemetry(
            &(0..(MAX_TEXT_SAMPLES + 20))
                .map(|_| (42, "x"))
                .collect::<Vec<_>>(),
            50,
        );
        assert_eq!(dense.behavior, StreamingBehavior::Burst);
        assert_eq!(dense.densest_window_percent, 100);
    }
}
