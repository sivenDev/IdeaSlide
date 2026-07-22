use crate::file_format::{
    new_canvas_resource, ordered_canvas_ids, IsFileData, ResourceData, ResourceEntry,
};
use crate::mcp::error::ToolError;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize)]
pub struct SlideInfo {
    pub id: String,
    pub title: String,
}

pub struct SlideService;

impl SlideService {
    fn canvas_ids(&self, data: &IsFileData) -> Result<Vec<String>, ToolError> {
        ordered_canvas_ids(&data.manifest.resources).map_err(ToolError::InvalidContent)
    }

    fn canvas_resource<'a>(
        &self,
        data: &'a IsFileData,
        canvas_id: &str,
    ) -> Result<&'a ResourceEntry, ToolError> {
        data.manifest
            .resources
            .iter()
            .find(|resource| resource.id == canvas_id && resource.resource_type == "canvas")
            .ok_or_else(|| ToolError::SlideNotFound(canvas_id.to_string()))
    }

    pub fn list(&self, data: &IsFileData) -> Vec<SlideInfo> {
        self.canvas_ids(data)
            .unwrap_or_default()
            .into_iter()
            .filter_map(|id| {
                data.manifest
                    .resources
                    .iter()
                    .find(|resource| resource.id == id)
                    .map(|resource| SlideInfo {
                        id,
                        title: resource.name.clone(),
                    })
            })
            .collect()
    }

    pub fn get_content(
        &self,
        data: &IsFileData,
        slide_id: &str,
    ) -> Result<serde_json::Value, ToolError> {
        self.canvas_resource(data, slide_id)?;
        data.contents
            .iter()
            .find(|content| content.id == slide_id)
            .map(|content| content.content.clone())
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))
    }

    pub fn set_content(
        &self,
        data: &mut IsFileData,
        slide_id: &str,
        content: serde_json::Value,
    ) -> Result<(), ToolError> {
        self.canvas_resource(data, slide_id)?;
        let canvas_content = data
            .contents
            .iter_mut()
            .find(|item| item.id == slide_id)
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))?;
        canvas_content.content = content;
        Ok(())
    }

    pub fn add(
        &self,
        data: &mut IsFileData,
        index: Option<usize>,
        content: Option<serde_json::Value>,
    ) -> Result<String, ToolError> {
        let canvas_ids = self.canvas_ids(data)?;
        let target_index = index.unwrap_or(canvas_ids.len()).min(canvas_ids.len());
        let root_order = if target_index == canvas_ids.len() {
            data.manifest
                .resources
                .iter()
                .filter(|resource| resource.parent_id.is_none())
                .map(|resource| resource.order)
                .max()
                .map_or(0, |order| order + 1)
        } else {
            let target_id = &canvas_ids[target_index];
            let target = self.canvas_resource(data, target_id)?;
            if target.parent_id.is_some() {
                return Err(ToolError::InvalidContent(
                    "Cannot insert a slide alias inside a nested folder; add at the end or use the workspace explorer"
                        .to_string(),
                ));
            }
            target.order
        };

        for resource in &mut data.manifest.resources {
            if resource.parent_id.is_none() && resource.order >= root_order {
                resource.order += 1;
            }
        }

        let id = uuid::Uuid::new_v4().to_string();
        let canvas_content = content.unwrap_or_else(|| {
            serde_json::json!({
                "type": "excalidraw",
                "version": 2,
                "elements": [],
                "appState": {},
                "files": {}
            })
        });
        data.manifest.resources.push(new_canvas_resource(
            id.clone(),
            "Untitled canvas".to_string(),
            None,
            root_order,
        ));
        data.contents.push(ResourceData {
            id: id.clone(),
            content: canvas_content,
        });

        Ok(id)
    }

    pub fn delete(&self, data: &mut IsFileData, slide_id: &str) -> Result<(), ToolError> {
        self.canvas_resource(data, slide_id)?;
        let canvas_ids = self.canvas_ids(data)?;
        if canvas_ids.len() == 1 {
            return Err(ToolError::InvalidContent(
                "A workspace must keep at least one canvas".to_string(),
            ));
        }

        let resource_index = data
            .manifest
            .resources
            .iter()
            .position(|resource| resource.id == slide_id)
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))?;
        let removed = data.manifest.resources.remove(resource_index);
        data.contents.retain(|content| content.id != slide_id);

        for resource in &mut data.manifest.resources {
            if resource.parent_id == removed.parent_id && resource.order > removed.order {
                resource.order -= 1;
            }
        }

        Ok(())
    }

    pub fn reorder(&self, data: &mut IsFileData, slide_ids: &[String]) -> Result<(), ToolError> {
        let current_ids = self.canvas_ids(data)?;
        let current_set: HashSet<&str> = current_ids.iter().map(String::as_str).collect();
        let requested_set: HashSet<&str> = slide_ids.iter().map(String::as_str).collect();

        if slide_ids
            .iter()
            .any(|id| !current_set.contains(id.as_str()))
        {
            let missing = slide_ids
                .iter()
                .find(|id| !current_set.contains(id.as_str()))
                .expect("checked above");
            return Err(ToolError::SlideNotFound(missing.clone()));
        }
        if slide_ids.len() != current_ids.len() || requested_set.len() != current_ids.len() {
            return Err(ToolError::InvalidContent(format!(
                "Expected {} unique slide IDs but got {}. All canvases must be included.",
                current_ids.len(),
                slide_ids.len()
            )));
        }
        if data
            .manifest
            .resources
            .iter()
            .any(|resource| resource.resource_type == "canvas" && resource.parent_id.is_some())
        {
            return Err(ToolError::InvalidContent(
                "Cannot globally reorder nested canvases through the slide compatibility API; use the workspace explorer"
                    .to_string(),
            ));
        }

        let mut canvas_orders: Vec<usize> = data
            .manifest
            .resources
            .iter()
            .filter(|resource| resource.resource_type == "canvas")
            .map(|resource| resource.order)
            .collect();
        canvas_orders.sort_unstable();

        for (id, order) in slide_ids.iter().zip(canvas_orders) {
            let resource = data
                .manifest
                .resources
                .iter_mut()
                .find(|resource| resource.id == *id)
                .expect("canvas IDs were validated");
            resource.order = order;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::file_format::{Manifest, CURRENT_FORMAT_VERSION};
    use serde_json::json;
    use std::collections::BTreeMap;

    fn make_test_data() -> IsFileData {
        let mut manifest = Manifest::new();
        manifest.resources = vec![
            new_canvas_resource("canvas-1".into(), "Canvas 1".into(), None, 0),
            new_canvas_resource("canvas-2".into(), "Canvas 2".into(), None, 1),
        ];
        IsFileData {
            manifest,
            contents: vec![
                ResourceData {
                    id: "canvas-1".into(),
                    content: json!({"elements": [], "appState": {}}),
                },
                ResourceData {
                    id: "canvas-2".into(),
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
        assert_eq!(list[0].id, "canvas-1");
        assert_eq!(list[1].title, "Canvas 2");
    }

    #[test]
    fn test_list_uses_depth_first_canvas_projection() {
        let svc = SlideService;
        let mut data = make_test_data();
        data.manifest.resources = vec![
            ResourceEntry {
                id: "folder-1".into(),
                resource_type: "folder".into(),
                name: "Folder".into(),
                parent_id: None,
                order: 0,
                content_ref: None,
                extra: BTreeMap::new(),
            },
            new_canvas_resource(
                "canvas-2".into(),
                "Canvas 2".into(),
                Some("folder-1".into()),
                0,
            ),
            new_canvas_resource("canvas-1".into(), "Canvas 1".into(), None, 1),
        ];

        let list = svc.list(&data);
        assert_eq!(
            list.iter().map(|item| item.id.as_str()).collect::<Vec<_>>(),
            ["canvas-2", "canvas-1"]
        );
    }

    #[test]
    fn test_get_content_found() {
        let svc = SlideService;
        let data = make_test_data();
        let content = svc.get_content(&data, "canvas-2").unwrap();
        assert!(!content["elements"].as_array().unwrap().is_empty());
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
        assert_eq!(data.contents.len(), 3);
        assert_eq!(data.manifest.resources.len(), 3);
        assert_eq!(svc.list(&data)[2].id, id);
        assert_eq!(data.manifest.version, CURRENT_FORMAT_VERSION);
    }

    #[test]
    fn test_add_slide_at_index() {
        let svc = SlideService;
        let mut data = make_test_data();
        let id = svc.add(&mut data, Some(0), None).unwrap();
        assert_eq!(data.contents.len(), 3);
        assert_eq!(svc.list(&data)[0].id, id);
    }

    #[test]
    fn test_add_slide_with_content() {
        let svc = SlideService;
        let mut data = make_test_data();
        let content = json!({"elements": [{"type": "rectangle"}], "appState": {}});
        let id = svc.add(&mut data, None, Some(content)).unwrap();
        let stored = svc.get_content(&data, &id).unwrap();
        assert_eq!(stored["elements"][0]["type"], "rectangle");
    }

    #[test]
    fn test_delete_slide() {
        let svc = SlideService;
        let mut data = make_test_data();
        svc.delete(&mut data, "canvas-1").unwrap();
        assert_eq!(data.contents.len(), 1);
        assert_eq!(data.manifest.resources.len(), 1);
        assert_eq!(svc.list(&data)[0].id, "canvas-2");
    }

    #[test]
    fn test_delete_last_canvas_is_rejected() {
        let svc = SlideService;
        let mut data = make_test_data();
        svc.delete(&mut data, "canvas-1").unwrap();
        let result = svc.delete(&mut data, "canvas-2");
        assert!(matches!(result, Err(ToolError::InvalidContent(_))));
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
        svc.set_content(&mut data, "canvas-1", new_content).unwrap();
        let stored = svc.get_content(&data, "canvas-1").unwrap();
        assert_eq!(stored["elements"][0]["type"], "ellipse");
    }

    #[test]
    fn test_reorder_slides() {
        let svc = SlideService;
        let mut data = make_test_data();
        svc.reorder(&mut data, &["canvas-2".into(), "canvas-1".into()])
            .unwrap();
        let ids: Vec<String> = svc.list(&data).into_iter().map(|item| item.id).collect();
        assert_eq!(ids, ["canvas-2", "canvas-1"]);
    }

    #[test]
    fn test_reorder_nested_canvases_is_rejected_without_tree_mutation() {
        let svc = SlideService;
        let mut data = make_test_data();
        data.manifest.resources.insert(
            0,
            ResourceEntry {
                id: "folder-1".into(),
                resource_type: "folder".into(),
                name: "Folder".into(),
                parent_id: None,
                order: 0,
                content_ref: None,
                extra: BTreeMap::new(),
            },
        );
        data.manifest.resources[1].parent_id = Some("folder-1".into());
        data.manifest.resources[1].order = 0;
        data.manifest.resources[2].order = 1;
        let before = data.manifest.resources.clone();

        let result = svc.reorder(&mut data, &["canvas-1".into(), "canvas-2".into()]);
        assert!(matches!(result, Err(ToolError::InvalidContent(_))));
        assert_eq!(
            data.manifest
                .resources
                .iter()
                .map(|resource| (&resource.id, &resource.parent_id, resource.order))
                .collect::<Vec<_>>(),
            before
                .iter()
                .map(|resource| (&resource.id, &resource.parent_id, resource.order))
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn test_reorder_with_invalid_ids() {
        let svc = SlideService;
        let mut data = make_test_data();
        let result = svc.reorder(&mut data, &["canvas-1".into(), "nonexistent".into()]);
        assert!(matches!(result, Err(ToolError::SlideNotFound(_))));
    }

    #[test]
    fn test_reorder_missing_slides() {
        let svc = SlideService;
        let mut data = make_test_data();
        let result = svc.reorder(&mut data, &["canvas-1".into()]);
        assert!(matches!(result, Err(ToolError::InvalidContent(_))));
    }
}
