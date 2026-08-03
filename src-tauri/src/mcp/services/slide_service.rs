use crate::document_formats::{DocumentFileData, IdeaSketchFileData, SlideData, SlideEntry};
use crate::mcp::error::ToolError;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Serialize, Deserialize)]
pub struct SlideInfo {
    pub id: String,
    pub title: String,
}

pub struct SlideService;

impl SlideService {
    fn page_entry<'a>(
        &self,
        data: &'a IdeaSketchFileData,
        slide_id: &str,
    ) -> Result<&'a SlideEntry, ToolError> {
        data.manifest
            .slides
            .iter()
            .find(|entry| entry.id == slide_id)
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))
    }

    pub fn list(&self, data: &DocumentFileData) -> Vec<SlideInfo> {
        let Ok(data) = data.as_idea_sketch() else {
            return Vec::new();
        };
        data.manifest
            .slides
            .iter()
            .map(|entry| SlideInfo {
                id: entry.id.clone(),
                title: entry.title.clone(),
            })
            .collect()
    }

    pub fn get_content(
        &self,
        data: &DocumentFileData,
        slide_id: &str,
    ) -> Result<serde_json::Value, ToolError> {
        let data = data.as_idea_sketch().map_err(ToolError::InvalidContent)?;
        self.page_entry(data, slide_id)?;
        data.slides
            .iter()
            .find(|slide| slide.id == slide_id)
            .map(|slide| slide.content.clone())
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))
    }

    pub fn set_content(
        &self,
        data: &mut DocumentFileData,
        slide_id: &str,
        content: serde_json::Value,
    ) -> Result<(), ToolError> {
        let data = data
            .as_idea_sketch_mut()
            .map_err(ToolError::InvalidContent)?;
        self.page_entry(data, slide_id)?;
        let slide = data
            .slides
            .iter_mut()
            .find(|slide| slide.id == slide_id)
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))?;
        slide.content = content;
        Ok(())
    }

    pub fn add(
        &self,
        data: &mut DocumentFileData,
        index: Option<usize>,
        content: Option<serde_json::Value>,
    ) -> Result<String, ToolError> {
        let data = data
            .as_idea_sketch_mut()
            .map_err(ToolError::InvalidContent)?;
        let target_index = index
            .unwrap_or(data.manifest.slides.len())
            .min(data.manifest.slides.len());
        let id = uuid::Uuid::new_v4().to_string();
        let content = content.unwrap_or_else(|| {
            serde_json::json!({
                "type": "excalidraw",
                "version": 2,
                "elements": [],
                "appState": {},
                "files": {}
            })
        });

        data.manifest.slides.insert(
            target_index,
            SlideEntry {
                id: id.clone(),
                title: "Untitled page".to_string(),
            },
        );
        data.slides.insert(
            target_index,
            SlideData {
                id: id.clone(),
                content,
            },
        );
        Ok(id)
    }

    pub fn delete(&self, data: &mut DocumentFileData, slide_id: &str) -> Result<(), ToolError> {
        let data = data
            .as_idea_sketch_mut()
            .map_err(ToolError::InvalidContent)?;
        self.page_entry(data, slide_id)?;
        if data.manifest.slides.len() == 1 {
            return Err(ToolError::InvalidContent(
                "IdeaSketch must keep at least one Page".to_string(),
            ));
        }

        data.manifest.slides.retain(|entry| entry.id != slide_id);
        data.slides.retain(|slide| slide.id != slide_id);
        Ok(())
    }

    pub fn reorder(
        &self,
        data: &mut DocumentFileData,
        slide_ids: &[String],
    ) -> Result<(), ToolError> {
        let data = data
            .as_idea_sketch_mut()
            .map_err(ToolError::InvalidContent)?;
        let current_ids: Vec<&str> = data
            .manifest
            .slides
            .iter()
            .map(|entry| entry.id.as_str())
            .collect();
        let current_set: HashSet<&str> = current_ids.iter().copied().collect();
        let requested_set: HashSet<&str> = slide_ids.iter().map(String::as_str).collect();

        if let Some(missing) = slide_ids
            .iter()
            .find(|id| !current_set.contains(id.as_str()))
        {
            return Err(ToolError::SlideNotFound(missing.clone()));
        }
        if slide_ids.len() != current_ids.len() || requested_set.len() != current_ids.len() {
            return Err(ToolError::InvalidContent(format!(
                "Expected {} unique slide IDs but got {}. All Pages must be included.",
                current_ids.len(),
                slide_ids.len()
            )));
        }

        let entries_by_id: HashMap<&str, &SlideEntry> = data
            .manifest
            .slides
            .iter()
            .map(|entry| (entry.id.as_str(), entry))
            .collect();
        let payloads_by_id: HashMap<&str, &SlideData> = data
            .slides
            .iter()
            .map(|slide| (slide.id.as_str(), slide))
            .collect();

        let ordered_entries = slide_ids
            .iter()
            .map(|id| {
                (*entries_by_id
                    .get(id.as_str())
                    .expect("Page ids were validated"))
                .clone()
            })
            .collect();
        let ordered_payloads = slide_ids
            .iter()
            .map(|id| {
                (*payloads_by_id
                    .get(id.as_str())
                    .expect("Page ids were validated"))
                .clone()
            })
            .collect();

        data.manifest.slides = ordered_entries;
        data.slides = ordered_payloads;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document_formats::idea_sketch::{Manifest, CURRENT_FORMAT_VERSION};
    use serde_json::json;

    fn make_test_data() -> DocumentFileData {
        DocumentFileData::IdeaSketch(IdeaSketchFileData {
            manifest: Manifest {
                version: CURRENT_FORMAT_VERSION.to_string(),
                created: "2026-08-03T00:00:00Z".to_string(),
                modified: "2026-08-03T00:00:00Z".to_string(),
                slides: vec![
                    SlideEntry {
                        id: "page-1".into(),
                        title: "Page 1".into(),
                    },
                    SlideEntry {
                        id: "page-2".into(),
                        title: "Page 2".into(),
                    },
                ],
            },
            slides: vec![
                SlideData {
                    id: "page-1".into(),
                    content: json!({"elements": [], "appState": {}, "files": {}}),
                },
                SlideData {
                    id: "page-2".into(),
                    content: json!({"elements": [{"type": "text"}], "appState": {}, "files": {}}),
                },
            ],
            media: vec![],
        })
    }

    #[test]
    fn list_uses_manifest_page_order_and_titles() {
        let data = make_test_data();
        let list = SlideService.list(&data);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, "page-1");
        assert_eq!(list[1].title, "Page 2");
    }

    #[test]
    fn get_and_set_content_use_page_payloads() {
        let mut data = make_test_data();
        assert!(
            !SlideService.get_content(&data, "page-2").unwrap()["elements"]
                .as_array()
                .unwrap()
                .is_empty()
        );

        let content = json!({"elements": [{"type": "ellipse"}], "appState": {}, "files": {}});
        SlideService
            .set_content(&mut data, "page-1", content)
            .unwrap();
        assert_eq!(
            SlideService.get_content(&data, "page-1").unwrap()["elements"][0]["type"],
            "ellipse"
        );
    }

    #[test]
    fn add_inserts_manifest_and_payload_at_requested_index() {
        let mut data = make_test_data();
        let id = SlideService.add(&mut data, Some(1), None).unwrap();
        let data = data.as_idea_sketch().unwrap();
        assert_eq!(data.manifest.slides[1].id, id);
        assert_eq!(data.slides[1].id, id);
        assert_eq!(data.manifest.slides[1].title, "Untitled page");
    }

    #[test]
    fn delete_keeps_at_least_one_page() {
        let mut data = make_test_data();
        SlideService.delete(&mut data, "page-1").unwrap();
        assert_eq!(
            data.as_idea_sketch().unwrap().manifest.slides[0].id,
            "page-2"
        );
        assert!(matches!(
            SlideService.delete(&mut data, "page-2"),
            Err(ToolError::InvalidContent(_))
        ));
    }

    #[test]
    fn reorder_keeps_manifest_and_payload_vectors_aligned() {
        let mut data = make_test_data();
        SlideService
            .reorder(&mut data, &["page-2".into(), "page-1".into()])
            .unwrap();
        let idea_sketch = data.as_idea_sketch().unwrap();
        assert_eq!(idea_sketch.manifest.slides[0].id, "page-2");
        assert_eq!(idea_sketch.slides[0].id, "page-2");
        assert_eq!(
            SlideService.get_content(&data, "page-2").unwrap()["elements"][0]["type"],
            "text"
        );
    }

    #[test]
    fn reorder_rejects_unknown_duplicate_or_missing_ids() {
        let mut data = make_test_data();
        assert!(matches!(
            SlideService.reorder(&mut data, &["page-1".into(), "missing".into()]),
            Err(ToolError::SlideNotFound(_))
        ));
        assert!(matches!(
            SlideService.reorder(&mut data, &["page-1".into(), "page-1".into()]),
            Err(ToolError::InvalidContent(_))
        ));
        assert!(matches!(
            SlideService.reorder(&mut data, &["page-1".into()]),
            Err(ToolError::InvalidContent(_))
        ));
    }
}
