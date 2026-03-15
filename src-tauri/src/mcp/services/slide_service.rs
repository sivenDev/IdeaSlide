use serde::{Deserialize, Serialize};
use crate::file_format::{IsFileData, SlideData, SlideEntry};
use crate::mcp::error::ToolError;

#[derive(Debug, Serialize, Deserialize)]
pub struct SlideInfo {
    pub id: String,
    pub title: String,
}

pub struct SlideService;

impl SlideService {
    pub fn list(&self, data: &IsFileData) -> Vec<SlideInfo> {
        data.manifest.slides.iter().map(|entry| SlideInfo {
            id: entry.id.clone(),
            title: entry.title.clone(),
        }).collect()
    }

    pub fn get_content(&self, data: &IsFileData, slide_id: &str) -> Result<serde_json::Value, ToolError> {
        data.slides.iter()
            .find(|s| s.id == slide_id)
            .map(|s| s.content.clone())
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))
    }

    pub fn set_content(
        &self,
        data: &mut IsFileData,
        slide_id: &str,
        content: serde_json::Value,
    ) -> Result<(), ToolError> {
        let slide = data.slides.iter_mut()
            .find(|s| s.id == slide_id)
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))?;
        slide.content = content;
        Ok(())
    }

    pub fn add(
        &self,
        data: &mut IsFileData,
        index: Option<usize>,
        content: Option<serde_json::Value>,
    ) -> Result<String, ToolError> {
        let id = uuid::Uuid::new_v4().to_string();
        let slide_content = content.unwrap_or_else(|| {
            serde_json::json!({"elements": [], "appState": {}})
        });

        let slide_data = SlideData {
            id: id.clone(),
            content: slide_content,
        };
        let slide_entry = SlideEntry {
            id: id.clone(),
            title: String::new(),
        };

        let idx = index.unwrap_or(data.slides.len()).min(data.slides.len());
        data.slides.insert(idx, slide_data);
        data.manifest.slides.insert(idx, slide_entry);

        Ok(id)
    }

    pub fn delete(&self, data: &mut IsFileData, slide_id: &str) -> Result<(), ToolError> {
        let slide_idx = data.slides.iter().position(|s| s.id == slide_id)
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))?;
        data.slides.remove(slide_idx);

        if let Some(manifest_idx) = data.manifest.slides.iter().position(|s| s.id == slide_id) {
            data.manifest.slides.remove(manifest_idx);
        }

        Ok(())
    }

    pub fn reorder(&self, data: &mut IsFileData, slide_ids: &[String]) -> Result<(), ToolError> {
        // Verify all provided IDs exist
        for id in slide_ids {
            if !data.slides.iter().any(|s| s.id == *id) {
                return Err(ToolError::SlideNotFound(id.clone()));
            }
        }
        // Verify all existing slides are included
        if slide_ids.len() != data.slides.len() {
            return Err(ToolError::InvalidContent(format!(
                "Expected {} slide IDs but got {}. All slides must be included.",
                data.slides.len(), slide_ids.len()
            )));
        }

        let mut new_slides = Vec::with_capacity(slide_ids.len());
        let mut new_manifest_slides = Vec::with_capacity(slide_ids.len());

        for id in slide_ids {
            let slide = data.slides.iter().find(|s| s.id == *id).unwrap().clone();
            let entry = data.manifest.slides.iter().find(|s| s.id == *id).unwrap().clone();
            new_slides.push(slide);
            new_manifest_slides.push(entry);
        }

        data.slides = new_slides;
        data.manifest.slides = new_manifest_slides;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::file_format::Manifest;
    use serde_json::json;

    fn make_test_data() -> IsFileData {
        IsFileData {
            manifest: Manifest {
                version: "1.0".to_string(),
                created: "2026-01-01T00:00:00Z".to_string(),
                modified: "2026-01-01T00:00:00Z".to_string(),
                slides: vec![
                    SlideEntry { id: "slide-1".into(), title: "Slide 1".into() },
                    SlideEntry { id: "slide-2".into(), title: "Slide 2".into() },
                ],
            },
            slides: vec![
                SlideData {
                    id: "slide-1".into(),
                    content: json!({"elements": [], "appState": {}}),
                },
                SlideData {
                    id: "slide-2".into(),
                    content: json!({"elements": [{"type": "text"}], "appState": {}}),
                },
            ],
            media: vec![],
        }
    }

    #[test]
    fn test_list_slides() {
        let svc = SlideService;
        let data = make_test_data();
        let list = svc.list(&data);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, "slide-1");
        assert_eq!(list[1].title, "Slide 2");
    }

    #[test]
    fn test_get_content_found() {
        let svc = SlideService;
        let data = make_test_data();
        let content = svc.get_content(&data, "slide-2").unwrap();
        assert!(content["elements"].as_array().unwrap().len() > 0);
    }

    #[test]
    fn test_get_content_not_found() {
        let svc = SlideService;
        let data = make_test_data();
        let result = svc.get_content(&data, "nonexistent");
        assert!(matches!(result, Err(ToolError::SlideNotFound(_))));
    }

    #[test]
    fn test_add_slide_at_end() {
        let svc = SlideService;
        let mut data = make_test_data();
        let id = svc.add(&mut data, None, None).unwrap();
        assert_eq!(data.slides.len(), 3);
        assert_eq!(data.manifest.slides.len(), 3);
        assert_eq!(data.slides[2].id, id);
    }

    #[test]
    fn test_add_slide_at_index() {
        let svc = SlideService;
        let mut data = make_test_data();
        let id = svc.add(&mut data, Some(0), None).unwrap();
        assert_eq!(data.slides.len(), 3);
        assert_eq!(data.slides[0].id, id);
    }

    #[test]
    fn test_add_slide_with_content() {
        let svc = SlideService;
        let mut data = make_test_data();
        let content = json!({"elements": [{"type": "rectangle"}], "appState": {}});
        let id = svc.add(&mut data, None, Some(content.clone())).unwrap();
        let stored = svc.get_content(&data, &id).unwrap();
        assert_eq!(stored["elements"][0]["type"], "rectangle");
    }

    #[test]
    fn test_delete_slide() {
        let svc = SlideService;
        let mut data = make_test_data();
        svc.delete(&mut data, "slide-1").unwrap();
        assert_eq!(data.slides.len(), 1);
        assert_eq!(data.manifest.slides.len(), 1);
        assert_eq!(data.slides[0].id, "slide-2");
    }

    #[test]
    fn test_delete_nonexistent_slide() {
        let svc = SlideService;
        let mut data = make_test_data();
        let result = svc.delete(&mut data, "nonexistent");
        assert!(matches!(result, Err(ToolError::SlideNotFound(_))));
    }

    #[test]
    fn test_set_content() {
        let svc = SlideService;
        let mut data = make_test_data();
        let new_content = json!({"elements": [{"type": "ellipse"}], "appState": {"zoom": 2}});
        svc.set_content(&mut data, "slide-1", new_content).unwrap();
        let stored = svc.get_content(&data, "slide-1").unwrap();
        assert_eq!(stored["elements"][0]["type"], "ellipse");
    }

    #[test]
    fn test_reorder_slides() {
        let svc = SlideService;
        let mut data = make_test_data();
        svc.reorder(&mut data, &["slide-2".into(), "slide-1".into()]).unwrap();
        assert_eq!(data.slides[0].id, "slide-2");
        assert_eq!(data.slides[1].id, "slide-1");
        assert_eq!(data.manifest.slides[0].id, "slide-2");
    }

    #[test]
    fn test_reorder_with_invalid_ids() {
        let svc = SlideService;
        let mut data = make_test_data();
        let result = svc.reorder(&mut data, &["slide-1".into(), "nonexistent".into()]);
        assert!(matches!(result, Err(ToolError::SlideNotFound(_))));
    }

    #[test]
    fn test_reorder_missing_slides() {
        let svc = SlideService;
        let mut data = make_test_data();
        let result = svc.reorder(&mut data, &["slide-1".into()]);
        assert!(matches!(result, Err(ToolError::InvalidContent(_))));
    }
}
