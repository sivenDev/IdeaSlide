use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_yaml_ng::Value as YamlValue;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::skills;
use super::types::{
    AgentSkillActivationMode, AgentSkillMetadata, AgentSkillOrigin, AgentSkillProvenance,
    AgentSkillResourceMetadata, AgentToolCall, AgentToolDescriptor,
};
use crate::safe_write::{self, WriteMode};

const REGISTRY_SCHEMA_VERSION: u32 = 1;
const MAX_FILES: usize = 64;
const MAX_DEPTH: usize = 4;
const MAX_FILE_BYTES: u64 = 256 * 1024;
const MAX_TOTAL_BYTES: u64 = 2 * 1024 * 1024;
const MAX_INSTRUCTIONS_BYTES: usize = 64 * 1024;
const MAX_REFERENCE_BYTES: usize = 32 * 1024;
const MAX_MANAGED_SKILLS: usize = 64;
const MAX_CATALOG_SKILLS: usize = 32;
const MAX_CATALOG_CHARS: usize = 8 * 1024;

#[derive(Clone, Debug)]
pub(crate) struct SkillSnapshot {
    pub metadata: AgentSkillMetadata,
    pub instructions: String,
    pub references: BTreeMap<String, String>,
}

pub(crate) struct SkillTurnState {
    registry: SkillRegistry,
    editor_scope: String,
    eligible: BTreeMap<String, AgentSkillMetadata>,
    snapshots: HashMap<String, SkillSnapshot>,
    activated: BTreeMap<String, AgentSkillProvenance>,
}

impl SkillTurnState {
    pub(crate) fn capture(
        registry: &SkillRegistry,
        editor_scope: &str,
        mandatory_skill_id: Option<&str>,
        selected_ids: &[String],
        editor_tools: &[AgentToolDescriptor],
    ) -> Result<Self, String> {
        if editor_tools.iter().any(|tool| {
            matches!(
                tool.name.as_str(),
                "activate_skill" | "read_skill_reference"
            )
        }) {
            return Err(
                "Editor Tool names cannot use reserved managed Skill host Tool ids.".to_string(),
            );
        }
        let eligible = registry
            .eligible_custom_metadata(editor_scope)?
            .into_iter()
            .map(|metadata| (metadata.id.clone(), metadata))
            .collect::<BTreeMap<_, _>>();
        let mut snapshots = HashMap::new();
        let mut activated = BTreeMap::new();
        if let Some(id) = mandatory_skill_id {
            let snapshot = registry.snapshot(id)?;
            validate_required_tools(&snapshot, editor_tools)?;
            activated.insert(
                id.to_string(),
                provenance(&snapshot, AgentSkillActivationMode::Mandatory, editor_scope),
            );
            snapshots.insert(id.to_string(), snapshot);
        }
        for id in selected_ids {
            let expected = eligible.get(id).ok_or_else(|| {
                format!("Selected custom Skill is unavailable or incompatible: {id}")
            })?;
            let snapshot = registry.snapshot(id)?;
            validate_captured_metadata(expected, &snapshot.metadata)?;
            validate_required_tools(&snapshot, editor_tools)?;
            activated.insert(
                id.clone(),
                provenance(&snapshot, AgentSkillActivationMode::Explicit, editor_scope),
            );
            snapshots.insert(id.clone(), snapshot);
        }
        Ok(Self {
            registry: registry.clone(),
            editor_scope: editor_scope.to_string(),
            eligible,
            snapshots,
            activated,
        })
    }

    pub(crate) fn host_tools(&self) -> Vec<AgentToolDescriptor> {
        let implicit_ids = self
            .eligible
            .values()
            .filter(|metadata| {
                metadata.implicit_invocation && !self.activated.contains_key(&metadata.id)
            })
            .map(|metadata| metadata.id.clone())
            .collect::<Vec<_>>();
        let mut tools = Vec::new();
        if !implicit_ids.is_empty() {
            tools.push(AgentToolDescriptor {
                name: "activate_skill".to_string(),
                description: "Activate one eligible managed custom Skill for this Turn. The Skill can add instructions but cannot add Tools or permissions.".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": { "skillId": { "type": "string", "enum": implicit_ids } },
                    "required": ["skillId"],
                    "additionalProperties": false
                }),
                requires: Vec::new(),
                source: super::types::AgentToolSource::Skill,
                effect: super::types::AgentToolEffect::Read,
            });
        }
        if self
            .eligible
            .values()
            .any(|metadata| !metadata.resources.is_empty())
            || self.activated.keys().any(|id| {
                self.snapshots
                    .get(id)
                    .is_some_and(|snapshot| !snapshot.references.is_empty())
            })
        {
            tools.push(AgentToolDescriptor {
                name: "read_skill_reference".to_string(),
                description: "Read one bounded text reference from an already activated Skill snapshot using opaque ids.".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "skillId": { "type": "string" },
                        "referenceId": { "type": "string", "pattern": "^ref-[0-9]+$" }
                    },
                    "required": ["skillId", "referenceId"],
                    "additionalProperties": false
                }),
                requires: Vec::new(),
                source: super::types::AgentToolSource::Skill,
                effect: super::types::AgentToolEffect::Read,
            });
        }
        tools
    }

    pub(crate) fn catalog_prompt(&self) -> (String, usize) {
        let mut lines = self
            .eligible
            .values()
            .map(|metadata| {
                format!(
                    "- {} ({}){}: {}",
                    metadata.name,
                    metadata.id,
                    if metadata.implicit_invocation {
                        " [implicit eligible]"
                    } else {
                        " [explicit only]"
                    },
                    metadata.description,
                )
            })
            .collect::<Vec<_>>();
        lines.sort();
        if lines.is_empty() {
            return (
                "No compatible managed custom Skills are available.".to_string(),
                0,
            );
        }
        let total = lines.len();
        let mut included = Vec::new();
        let mut characters = 0_usize;
        for line in lines.into_iter().take(MAX_CATALOG_SKILLS) {
            let next = line.len() + usize::from(!included.is_empty());
            if characters.saturating_add(next) > MAX_CATALOG_CHARS {
                break;
            }
            characters += next;
            included.push(line);
        }
        let omitted = total.saturating_sub(included.len());
        (included.join("\n"), omitted)
    }

    pub(crate) fn activated_instructions(&self) -> String {
        self.activated
            .keys()
            .filter_map(|id| self.snapshots.get(id))
            .map(|snapshot| {
                let resources = if snapshot.metadata.resources.is_empty() {
                    "No references.".to_string()
                } else {
                    snapshot
                        .metadata
                        .resources
                        .iter()
                        .map(|resource| format!("{} ({})", resource.label, resource.id))
                        .collect::<Vec<_>>()
                        .join(", ")
                };
                format!(
                    "SKILL {} [{}]\n{}\nAvailable references: {}",
                    snapshot.metadata.name, snapshot.metadata.id, snapshot.instructions, resources,
                )
            })
            .collect::<Vec<_>>()
            .join("\n\n")
    }

    pub(crate) fn provenance(&self) -> Vec<AgentSkillProvenance> {
        self.activated.values().cloned().collect()
    }

    pub(crate) fn execute_host_tool(
        &mut self,
        call: &AgentToolCall,
        editor_tools: &[AgentToolDescriptor],
    ) -> Option<serde_json::Value> {
        match call.name.as_str() {
            "activate_skill" => Some(self.activate(call, editor_tools)),
            "read_skill_reference" => Some(self.read_reference(call)),
            _ => None,
        }
    }

    fn activate(
        &mut self,
        call: &AgentToolCall,
        editor_tools: &[AgentToolDescriptor],
    ) -> serde_json::Value {
        let result = (|| -> Result<(String, String), String> {
            let id = call
                .arguments
                .get("skillId")
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| "activate_skill requires skillId.".to_string())?;
            let expected = self
                .eligible
                .get(id)
                .ok_or_else(|| "The requested Skill is unavailable for this editor.".to_string())?;
            if !expected.implicit_invocation {
                return Err("The requested Skill does not allow implicit invocation.".to_string());
            }
            if self.activated.contains_key(id) {
                let snapshot = self
                    .snapshots
                    .get(id)
                    .ok_or_else(|| "The activated Skill snapshot is unavailable.".to_string())?;
                return Ok((
                    snapshot.metadata.name.clone(),
                    snapshot.instructions.clone(),
                ));
            }
            let snapshot = self.registry.snapshot(id)?;
            validate_captured_metadata(expected, &snapshot.metadata)?;
            validate_required_tools(&snapshot, editor_tools)?;
            self.activated.insert(
                id.to_string(),
                provenance(
                    &snapshot,
                    AgentSkillActivationMode::Implicit,
                    &self.editor_scope,
                ),
            );
            let name = snapshot.metadata.name.clone();
            let instructions = snapshot.instructions.clone();
            self.snapshots.insert(id.to_string(), snapshot);
            Ok((name, instructions))
        })();
        match result {
            Ok((name, instructions)) => host_read_result(
                call,
                format!("Activated {name}"),
                serde_json::json!({
                    "instructions": instructions,
                    "message": "The Skill instructions are active for this immutable Turn snapshot."
                }),
            ),
            Err(message) => host_failure(call, message),
        }
    }

    fn read_reference(&self, call: &AgentToolCall) -> serde_json::Value {
        let result = (|| -> Result<(String, String), String> {
            let skill_id = call
                .arguments
                .get("skillId")
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| "read_skill_reference requires skillId.".to_string())?;
            let reference_id = call
                .arguments
                .get("referenceId")
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| "read_skill_reference requires referenceId.".to_string())?;
            if !self.activated.contains_key(skill_id) {
                return Err(
                    "Activate or explicitly select the Skill before reading a reference."
                        .to_string(),
                );
            }
            let snapshot = self
                .snapshots
                .get(skill_id)
                .ok_or_else(|| "The captured Skill snapshot is unavailable.".to_string())?;
            let content = snapshot
                .references
                .get(reference_id)
                .ok_or_else(|| "Unknown Skill reference id.".to_string())?;
            let label = snapshot
                .metadata
                .resources
                .iter()
                .find(|resource| resource.id == reference_id)
                .map(|resource| resource.label.clone())
                .unwrap_or_else(|| "Skill reference".to_string());
            Ok((label, content.clone()))
        })();
        match result {
            Ok((label, content)) => host_read_result(
                call,
                format!("Read {label}"),
                serde_json::json!({ "text": content }),
            ),
            Err(message) => host_failure(call, message),
        }
    }
}

fn host_read_result(
    call: &AgentToolCall,
    summary: String,
    content: serde_json::Value,
) -> serde_json::Value {
    serde_json::json!({
        "kind": "read", "callId": call.call_id, "name": call.name, "success": true,
        "summary": summary, "content": content, "truncated": false, "persistable": false
    })
}

fn host_failure(call: &AgentToolCall, message: String) -> serde_json::Value {
    serde_json::json!({
        "kind": "failure", "callId": call.call_id, "name": call.name, "success": false,
        "summary": message, "error": {
            "code": "toolExecutionFailed", "message": message,
            "recovery": "Choose an enabled compatible Skill and retry.",
            "diagnosticId": Uuid::new_v4().to_string(), "retryable": true
        },
        "truncated": false, "persistable": true
    })
}

fn provenance(
    snapshot: &SkillSnapshot,
    activation_mode: AgentSkillActivationMode,
    editor_scope: &str,
) -> AgentSkillProvenance {
    AgentSkillProvenance {
        id: snapshot.metadata.id.clone(),
        name: snapshot.metadata.name.clone(),
        origin: snapshot.metadata.origin,
        digest: snapshot.metadata.digest.clone(),
        activation_mode,
        editor_scope: editor_scope.to_string(),
    }
}

fn validate_required_tools(
    snapshot: &SkillSnapshot,
    tools: &[AgentToolDescriptor],
) -> Result<(), String> {
    let available = tools
        .iter()
        .map(|tool| tool.name.as_str())
        .collect::<HashSet<_>>();
    let missing = snapshot
        .metadata
        .required_tools
        .iter()
        .filter(|tool| !available.contains(tool.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    if missing.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "Skill {} requires unavailable existing Tools: {}",
            snapshot.metadata.name,
            missing.join(", ")
        ))
    }
}

fn validate_captured_metadata(
    expected: &AgentSkillMetadata,
    actual: &AgentSkillMetadata,
) -> Result<(), String> {
    if expected.id != actual.id || expected.digest != actual.digest {
        return Err(
            "The managed Skill changed after this Turn started. Start a new Turn to use the refreshed version."
                .to_string(),
        );
    }
    Ok(())
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedResource {
    id: String,
    label: String,
    relative_path: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedSkillManifest {
    schema_version: u32,
    id: String,
    name: String,
    description: String,
    source_label: String,
    enabled: bool,
    implicit_invocation: bool,
    editor_scopes: Vec<String>,
    digest: String,
    refreshed_at: u64,
    files: Vec<String>,
    resources: Vec<ManagedResource>,
    required_tools: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct SkillFrontmatter {
    name: String,
    description: String,
    #[serde(default)]
    metadata: Option<YamlValue>,
    #[serde(default, rename = "allowed-tools")]
    allowed_tools: Option<YamlValue>,
    #[serde(default)]
    scripts: Option<YamlValue>,
    #[serde(default)]
    dependencies: Option<YamlValue>,
    #[serde(default)]
    mcp: Option<YamlValue>,
    #[serde(flatten)]
    extra: BTreeMap<String, YamlValue>,
}

#[derive(Debug, Default, Deserialize)]
struct OpenAiConfig {
    #[serde(default)]
    policy: OpenAiPolicy,
}

#[derive(Debug, Default, Deserialize)]
struct OpenAiPolicy {
    #[serde(default)]
    allow_implicit_invocation: bool,
}

#[derive(Clone)]
pub(crate) struct SkillRegistry {
    root: PathBuf,
}

impl SkillRegistry {
    pub(crate) fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn skills_dir(&self) -> PathBuf {
        self.root.join("skills")
    }

    fn staging_dir(&self) -> PathBuf {
        self.root.join("skill-staging")
    }

    pub(crate) fn list(&self) -> Result<Vec<AgentSkillMetadata>, String> {
        let mut metadata = skills::discover_skills();
        let directory = self.skills_dir();
        if !directory.exists() {
            return Ok(metadata);
        }
        for entry in fs::read_dir(&directory)
            .map_err(|error| format!("Managed Skill directory could not be read: {error}"))?
        {
            let entry =
                entry.map_err(|error| format!("Managed Skill entry could not be read: {error}"))?;
            if !entry
                .file_type()
                .map(|value| value.is_dir())
                .unwrap_or(false)
            {
                continue;
            }
            match self.read_manifest(&entry.path()) {
                Ok(manifest) => metadata.push(metadata_from_manifest(&manifest, true, None)),
                Err(message) => metadata.push(AgentSkillMetadata {
                    id: format!("custom:{}", entry.file_name().to_string_lossy()),
                    name: entry.file_name().to_string_lossy().to_string(),
                    description: "Managed Skill metadata is invalid.".to_string(),
                    origin: AgentSkillOrigin::Custom,
                    source_label: "Managed copy".to_string(),
                    enabled: false,
                    implicit_invocation: false,
                    editor_scopes: Vec::new(),
                    digest: String::new(),
                    valid: false,
                    validation_message: Some(message),
                    last_refreshed_at: None,
                    resources: Vec::new(),
                    required_tools: Vec::new(),
                }),
            }
        }
        metadata.sort_by(|left, right| {
            left.origin_string()
                .cmp(right.origin_string())
                .then_with(|| left.name.cmp(&right.name))
        });
        Ok(metadata)
    }

    pub(crate) fn import(
        &self,
        source: &Path,
        replace_id: Option<&str>,
    ) -> Result<AgentSkillMetadata, String> {
        let source_metadata = fs::symlink_metadata(source)
            .map_err(|_| "The selected Skill folder is unavailable.".to_string())?;
        if source_metadata.file_type().is_symlink() {
            return Err("Select the real Skill folder rather than a symbolic link.".to_string());
        }
        let canonical = source
            .canonicalize()
            .map_err(|_| "The selected Skill folder is unavailable.".to_string())?;
        if !canonical.is_dir() {
            return Err("Select a Skill folder containing SKILL.md.".to_string());
        }
        let scanned = scan_source(&canonical)?;
        if scanned.iter().any(|path| path == "skill.json") {
            return Err("skill.json is reserved for the managed Skill manifest.".to_string());
        }
        let skill_source = fs::read_to_string(canonical.join("SKILL.md"))
            .map_err(|_| "SKILL.md must be valid UTF-8 text.".to_string())?;
        if skill_source.len() > MAX_INSTRUCTIONS_BYTES {
            return Err("SKILL.md exceeds the 64 KiB instruction limit.".to_string());
        }
        let (frontmatter, _instructions) = parse_skill_document(&skill_source)?;
        validate_frontmatter(&frontmatter)?;
        let generated_id = format!("custom:{}", slug(&frontmatter.name)?);
        let id = replace_id.unwrap_or(&generated_id).to_string();
        validate_custom_id(&id)?;
        let bundled = skills::discover_skills();
        if bundled.iter().any(|skill| {
            skill
                .id
                .eq_ignore_ascii_case(id.trim_start_matches("custom:"))
                || skill.name.eq_ignore_ascii_case(frontmatter.name.trim())
        }) {
            return Err("The Skill name or id is reserved by a bundled editor Skill.".to_string());
        }
        let target = self.skill_path(&id)?;
        if target.exists() && replace_id.is_none() {
            return Err("A managed Skill with this id already exists. Use Refresh to replace it deliberately.".to_string());
        }
        if replace_id.is_some() && !target.exists() {
            return Err("The managed Skill to refresh no longer exists.".to_string());
        }
        let current = self.list()?;
        if replace_id.is_none()
            && current
                .iter()
                .filter(|skill| skill.origin == AgentSkillOrigin::Custom)
                .count()
                >= MAX_MANAGED_SKILLS
        {
            return Err("The managed Skill limit has been reached.".to_string());
        }
        if current.iter().any(|skill| {
            skill.origin == AgentSkillOrigin::Custom
                && skill.id != id
                && skill.name.eq_ignore_ascii_case(frontmatter.name.trim())
        }) {
            return Err("A managed Skill with this name already exists.".to_string());
        }
        let previous = if target.exists() {
            self.read_manifest(&target).ok()
        } else {
            None
        };
        let openai = read_openai_config(&canonical)?;
        let metadata = parse_ideanote_metadata(frontmatter.metadata.as_ref())?;
        let implicit_invocation = previous
            .as_ref()
            .map(|value| value.implicit_invocation)
            .unwrap_or(openai.policy.allow_implicit_invocation || metadata.implicit_invocation);
        let editor_scopes = previous
            .as_ref()
            .map(|value| value.editor_scopes.clone())
            .unwrap_or(metadata.editor_scopes);
        let resources = scanned
            .iter()
            .filter(|path| path.starts_with("references/") && is_text_reference(path))
            .enumerate()
            .map(|(index, path)| {
                let bytes = fs::read(canonical.join(path))
                    .map_err(|_| "Skill reference could not be read.".to_string())?;
                if bytes.len() > MAX_REFERENCE_BYTES {
                    return Err("A Skill text reference exceeds the 32 KiB read limit.".to_string());
                }
                String::from_utf8(bytes)
                    .map_err(|_| "Skill text references must be valid UTF-8.".to_string())?;
                Ok(ManagedResource {
                    id: format!("ref-{}", index + 1),
                    label: safe_display_label(
                        Path::new(path)
                            .file_stem()
                            .and_then(|value| value.to_str())
                            .unwrap_or("Reference"),
                        "Reference",
                    ),
                    relative_path: path.clone(),
                })
            })
            .collect::<Result<Vec<_>, String>>()?;
        let digest = content_digest(&canonical, &scanned)?;
        let manifest = ManagedSkillManifest {
            schema_version: REGISTRY_SCHEMA_VERSION,
            id: id.clone(),
            name: frontmatter.name.trim().to_string(),
            description: frontmatter.description.trim().to_string(),
            source_label: safe_display_label(
                canonical
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("Imported Skill"),
                "Imported Skill",
            ),
            enabled: previous.as_ref().map(|value| value.enabled).unwrap_or(true),
            implicit_invocation,
            editor_scopes,
            digest,
            refreshed_at: now_millis(),
            files: scanned.clone(),
            resources,
            required_tools: metadata.required_tools,
        };
        self.commit_import(&canonical, &scanned, &target, &manifest)?;
        Ok(metadata_from_manifest(&manifest, true, None))
    }

    pub(crate) fn update(
        &self,
        id: &str,
        enabled: bool,
        implicit_invocation: bool,
        editor_scopes: Vec<String>,
    ) -> Result<AgentSkillMetadata, String> {
        let path = self.skill_path(id)?;
        let mut manifest = self.read_manifest(&path)?;
        manifest.enabled = enabled;
        manifest.implicit_invocation = implicit_invocation;
        manifest.editor_scopes = normalize_string_list(editor_scopes, 16, 80)?;
        self.write_manifest(&path, &manifest)?;
        Ok(metadata_from_manifest(&manifest, true, None))
    }

    pub(crate) fn remove(&self, id: &str) -> Result<bool, String> {
        let path = self.skill_path(id)?;
        if !path.exists() {
            return Ok(false);
        }
        fs::remove_dir_all(&path)
            .map_err(|error| format!("Managed Skill could not be removed: {error}"))?;
        Ok(true)
    }

    pub(crate) fn snapshot(&self, id: &str) -> Result<SkillSnapshot, String> {
        if let Some(metadata) = skills::discover_skills()
            .into_iter()
            .find(|skill| skill.id == id)
        {
            let instructions = skills::load_skill(id)?;
            let references = metadata
                .resources
                .iter()
                .map(|resource| {
                    Ok((
                        resource.id.clone(),
                        skills::load_bundled_reference(id, &resource.id)?,
                    ))
                })
                .collect::<Result<BTreeMap<_, _>, String>>()?;
            return Ok(SkillSnapshot {
                metadata,
                instructions,
                references,
            });
        }
        let path = self.skill_path(id)?;
        let manifest = self.read_manifest(&path)?;
        let skill_source = fs::read_to_string(path.join("SKILL.md"))
            .map_err(|_| "Managed Skill instructions are unavailable.".to_string())?;
        let (_, instructions) = parse_skill_document(&skill_source)?;
        let mut references = BTreeMap::new();
        for resource in &manifest.resources {
            let bytes = fs::read(path.join(&resource.relative_path))
                .map_err(|_| "Managed Skill reference is unavailable.".to_string())?;
            if bytes.len() > MAX_REFERENCE_BYTES {
                return Err("Managed Skill reference exceeds the read limit.".to_string());
            }
            let text = String::from_utf8(bytes)
                .map_err(|_| "Managed Skill references must be UTF-8 text.".to_string())?;
            references.insert(resource.id.clone(), text);
        }
        Ok(SkillSnapshot {
            metadata: metadata_from_manifest(&manifest, true, None),
            instructions: instructions.to_string(),
            references,
        })
    }

    pub(crate) fn eligible_custom_metadata(
        &self,
        editor_scope: &str,
    ) -> Result<Vec<AgentSkillMetadata>, String> {
        Ok(self
            .list()?
            .into_iter()
            .filter(|skill| {
                skill.origin == AgentSkillOrigin::Custom
                    && skill.enabled
                    && skill.valid
                    && (skill.editor_scopes.is_empty()
                        || skill
                            .editor_scopes
                            .iter()
                            .any(|scope| scope == editor_scope))
            })
            .collect())
    }

    fn skill_path(&self, id: &str) -> Result<PathBuf, String> {
        validate_custom_id(id)?;
        Ok(self.skills_dir().join(id.trim_start_matches("custom:")))
    }

    fn read_manifest(&self, directory: &Path) -> Result<ManagedSkillManifest, String> {
        let directory_metadata = fs::symlink_metadata(directory)
            .map_err(|_| "Managed Skill directory is unavailable.".to_string())?;
        if directory_metadata.file_type().is_symlink() || !directory_metadata.is_dir() {
            return Err("Managed Skill directories cannot be symbolic links.".to_string());
        }
        let bytes = fs::read(directory.join("skill.json"))
            .map_err(|_| "Managed Skill manifest is unavailable.".to_string())?;
        let manifest: ManagedSkillManifest = serde_json::from_slice(&bytes)
            .map_err(|_| "Managed Skill manifest is invalid.".to_string())?;
        if manifest.schema_version != REGISTRY_SCHEMA_VERSION {
            return Err("Managed Skill manifest uses an unsupported version.".to_string());
        }
        validate_custom_id(&manifest.id)?;
        let expected_id = directory
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| format!("custom:{value}"))
            .ok_or_else(|| "Managed Skill directory name is invalid.".to_string())?;
        if manifest.id != expected_id {
            return Err("Managed Skill manifest id does not match its directory.".to_string());
        }
        validate_name_and_description(&manifest.name, &manifest.description)?;
        if manifest.source_label.trim().is_empty() || manifest.source_label.len() > 160 {
            return Err("Managed Skill source label is invalid.".to_string());
        }
        if manifest.digest.len() != 64 || !manifest.digest.chars().all(|ch| ch.is_ascii_hexdigit())
        {
            return Err("Managed Skill digest is invalid.".to_string());
        }
        if normalize_string_list(manifest.editor_scopes.clone(), 16, 80)? != manifest.editor_scopes
            || normalize_string_list(manifest.required_tools.clone(), 32, 120)?
                != manifest.required_tools
        {
            return Err("Managed Skill manifest identifiers are not normalized.".to_string());
        }
        validate_manifest_files(&manifest)?;
        let mut actual_files = Vec::new();
        let mut total = 0_u64;
        scan_directory(directory, directory, 0, &mut actual_files, &mut total)?;
        actual_files.retain(|path| path != "skill.json");
        actual_files.sort();
        if actual_files != manifest.files {
            return Err("Managed Skill files do not match the captured manifest.".to_string());
        }
        if content_digest(directory, &actual_files)? != manifest.digest {
            return Err("Managed Skill content does not match its captured digest.".to_string());
        }
        Ok(manifest)
    }

    fn write_manifest(
        &self,
        directory: &Path,
        manifest: &ManagedSkillManifest,
    ) -> Result<(), String> {
        let bytes = serde_json::to_vec_pretty(manifest)
            .map_err(|_| "Managed Skill manifest could not be encoded.".to_string())?;
        safe_write::write_bytes(
            &directory.join("skill.json"),
            &self.staging_dir(),
            &bytes,
            WriteMode::Replace,
        )
    }

    fn commit_import(
        &self,
        source: &Path,
        files: &[String],
        target: &Path,
        manifest: &ManagedSkillManifest,
    ) -> Result<(), String> {
        fs::create_dir_all(self.staging_dir())
            .map_err(|error| format!("Skill staging directory could not be created: {error}"))?;
        fs::create_dir_all(self.skills_dir())
            .map_err(|error| format!("Managed Skill directory could not be created: {error}"))?;
        let staging = self.staging_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&staging)
            .map_err(|error| format!("Skill staging transaction could not start: {error}"))?;
        let result = (|| -> Result<(), String> {
            for relative in files {
                let destination = staging.join(relative);
                if let Some(parent) = destination.parent() {
                    fs::create_dir_all(parent).map_err(|error| {
                        format!("Skill staging folder could not be created: {error}")
                    })?;
                }
                fs::copy(source.join(relative), &destination)
                    .map_err(|error| format!("Skill file could not be copied: {error}"))?;
            }
            if content_digest(&staging, files)? != manifest.digest {
                return Err(
                    "The Skill source changed during import. Retry after edits are complete."
                        .to_string(),
                );
            }
            fs::write(
                staging.join("skill.json"),
                serde_json::to_vec_pretty(manifest)
                    .map_err(|_| "Skill manifest could not be encoded.".to_string())?,
            )
            .map_err(|error| format!("Skill manifest could not be staged: {error}"))?;
            let backup = self
                .staging_dir()
                .join(format!("backup-{}", Uuid::new_v4()));
            if target.exists() {
                fs::rename(target, &backup).map_err(|error| {
                    format!("Existing managed Skill could not be staged for replacement: {error}")
                })?;
            }
            match fs::rename(&staging, target) {
                Ok(()) => {
                    if backup.exists() {
                        let _ = fs::remove_dir_all(backup);
                    }
                    Ok(())
                }
                Err(error) => {
                    if backup.exists() {
                        let _ = fs::rename(&backup, target);
                    }
                    Err(format!("Managed Skill could not be committed: {error}"))
                }
            }
        })();
        if staging.exists() {
            let _ = fs::remove_dir_all(staging);
        }
        result
    }
}

impl AgentSkillMetadata {
    fn origin_string(&self) -> &'static str {
        match self.origin {
            AgentSkillOrigin::Bundled => "0",
            AgentSkillOrigin::Custom => "1",
        }
    }
}

#[derive(Default)]
struct IdeaNoteMetadata {
    implicit_invocation: bool,
    editor_scopes: Vec<String>,
    required_tools: Vec<String>,
}

fn parse_ideanote_metadata(value: Option<&YamlValue>) -> Result<IdeaNoteMetadata, String> {
    let Some(value) = value else {
        return Ok(IdeaNoteMetadata::default());
    };
    let YamlValue::Mapping(metadata) = value else {
        return Err("Skill metadata must be a YAML mapping.".to_string());
    };
    let key = YamlValue::String("ideanote".to_string());
    let Some(value) = metadata.get(&key) else {
        return Ok(IdeaNoteMetadata::default());
    };
    let YamlValue::Mapping(ideanote) = value else {
        return Err("metadata.ideanote must be a YAML mapping.".to_string());
    };
    let implicit_invocation =
        match ideanote.get(YamlValue::String("implicitInvocation".to_string())) {
            None => false,
            Some(value) => value.as_bool().ok_or_else(|| {
                "metadata.ideanote.implicitInvocation must be true or false.".to_string()
            })?,
        };
    let editor_scopes =
        yaml_string_list(ideanote.get(YamlValue::String("editorScopes".to_string())))?;
    let required_tools =
        yaml_string_list(ideanote.get(YamlValue::String("requiredTools".to_string())))?;
    Ok(IdeaNoteMetadata {
        implicit_invocation,
        editor_scopes: normalize_string_list(editor_scopes, 16, 80)?,
        required_tools: normalize_string_list(required_tools, 32, 120)?,
    })
}

fn yaml_string_list(value: Option<&YamlValue>) -> Result<Vec<String>, String> {
    match value {
        None => Ok(Vec::new()),
        Some(YamlValue::Sequence(values)) => values
            .iter()
            .map(|value| {
                value
                    .as_str()
                    .map(str::to_string)
                    .ok_or_else(|| "Skill metadata lists must contain strings.".to_string())
            })
            .collect(),
        _ => Err("Skill metadata lists must be YAML arrays.".to_string()),
    }
}

fn normalize_string_list(
    values: Vec<String>,
    maximum: usize,
    max_length: usize,
) -> Result<Vec<String>, String> {
    if values.len() > maximum {
        return Err("Skill metadata contains too many entries.".to_string());
    }
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for value in values {
        let value = value.trim();
        if value.is_empty()
            || value.len() > max_length
            || !value
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | ':' | '.'))
        {
            return Err("Skill metadata contains an invalid identifier.".to_string());
        }
        if seen.insert(value.to_string()) {
            normalized.push(value.to_string());
        }
    }
    Ok(normalized)
}

fn scan_source(root: &Path) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let mut total = 0_u64;
    scan_directory(root, root, 0, &mut files, &mut total)?;
    if !files.iter().any(|path| path == "SKILL.md") {
        return Err("The selected folder does not contain SKILL.md.".to_string());
    }
    files.sort();
    Ok(files)
}

fn scan_directory(
    root: &Path,
    directory: &Path,
    depth: usize,
    files: &mut Vec<String>,
    total: &mut u64,
) -> Result<(), String> {
    if depth > MAX_DEPTH {
        return Err("Skill folder nesting exceeds the supported depth.".to_string());
    }
    for entry in
        fs::read_dir(directory).map_err(|_| "Skill folder could not be read.".to_string())?
    {
        let entry = entry.map_err(|_| "Skill folder contains an unreadable entry.".to_string())?;
        let file_type = entry
            .file_type()
            .map_err(|_| "Skill entry type could not be inspected.".to_string())?;
        if file_type.is_symlink() {
            return Err("Skill imports cannot contain symbolic links.".to_string());
        }
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .map_err(|_| "Skill path escaped the selected folder.".to_string())?;
        validate_relative_path(relative)?;
        let display = relative.to_string_lossy().replace('\\', "/");
        if file_type.is_dir() {
            let first = relative
                .components()
                .next()
                .and_then(|part| match part {
                    Component::Normal(value) => value.to_str(),
                    _ => None,
                })
                .unwrap_or("");
            if matches!(first, "scripts" | "node_modules" | ".git" | ".github") {
                return Err(
                    "Skill scripts, dependencies, and repository metadata are not supported."
                        .to_string(),
                );
            }
            scan_directory(root, &path, depth + 1, files, total)?;
        } else if file_type.is_file() {
            let managed_manifest = display == "skill.json";
            let imported_file_count = files.iter().filter(|path| *path != "skill.json").count();
            if !managed_manifest && imported_file_count >= MAX_FILES {
                return Err("Skill import exceeds the 64-file limit.".to_string());
            }
            if !managed_manifest {
                reject_executable_or_dependency(&display)?;
            }
            let size = entry
                .metadata()
                .map_err(|_| "Skill file metadata could not be read.".to_string())?
                .len();
            if size > MAX_FILE_BYTES {
                return Err("A Skill file exceeds the 256 KiB limit.".to_string());
            }
            *total = total.saturating_add(size);
            if *total > MAX_TOTAL_BYTES {
                return Err("Skill import exceeds the 2 MiB total limit.".to_string());
            }
            files.push(display);
        }
    }
    Ok(())
}

fn validate_relative_path(path: &Path) -> Result<(), String> {
    if path.is_absolute()
        || path
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err("Skill import contains an unsafe path.".to_string());
    }
    Ok(())
}

fn reject_executable_or_dependency(path: &str) -> Result<(), String> {
    let lower = path.to_ascii_lowercase();
    let file_name = Path::new(&lower)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if matches!(
        file_name,
        "package.json"
            | "package-lock.json"
            | "pnpm-lock.yaml"
            | "yarn.lock"
            | "requirements.txt"
            | "pyproject.toml"
            | "cargo.toml"
            | "go.mod"
    ) || [
        ".sh", ".bash", ".zsh", ".fish", ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".rb", ".pl",
        ".ps1", ".command", ".exe", ".bin",
    ]
    .iter()
    .any(|extension| lower.ends_with(extension))
    {
        return Err("Skill scripts and dependency manifests are not supported.".to_string());
    }
    Ok(())
}

fn is_text_reference(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.ends_with(".md") || lower.ends_with(".txt") || lower.ends_with(".markdown")
}

fn parse_skill_document(source: &str) -> Result<(SkillFrontmatter, &str), String> {
    let source = source.strip_prefix('\u{feff}').unwrap_or(source);
    let (source, closing) = if let Some(source) = source.strip_prefix("---\n") {
        (source, "\n---\n")
    } else if let Some(source) = source.strip_prefix("---\r\n") {
        (source, "\r\n---\r\n")
    } else {
        return Err("SKILL.md must begin with YAML frontmatter.".to_string());
    };
    let (yaml, instructions) = source
        .split_once(closing)
        .ok_or_else(|| "SKILL.md frontmatter is not closed.".to_string())?;
    let frontmatter = serde_yaml_ng::from_str::<SkillFrontmatter>(yaml)
        .map_err(|_| "SKILL.md frontmatter is invalid YAML.".to_string())?;
    if instructions.trim().is_empty() {
        return Err("SKILL.md must contain instructions after frontmatter.".to_string());
    }
    Ok((frontmatter, instructions))
}

fn validate_frontmatter(frontmatter: &SkillFrontmatter) -> Result<(), String> {
    validate_name_and_description(&frontmatter.name, &frontmatter.description)?;
    if let Some(metadata) = &frontmatter.metadata {
        reject_skill_metadata_security(metadata, false)?;
    }
    if frontmatter.allowed_tools.is_some()
        || frontmatter.scripts.is_some()
        || frontmatter.dependencies.is_some()
        || frontmatter.mcp.is_some()
        || frontmatter
            .extra
            .keys()
            .any(|key| security_sensitive_key(key))
    {
        return Err(
            "Custom Skills cannot declare Tools, scripts, dependencies, or MCP.".to_string(),
        );
    }
    Ok(())
}

fn validate_name_and_description(name: &str, description: &str) -> Result<(), String> {
    if name.trim().is_empty() || name.len() > 80 || name.chars().any(char::is_control) {
        return Err("Skill name is required and must not exceed 80 characters.".to_string());
    }
    if description.trim().is_empty()
        || description.len() > 240
        || description.chars().any(char::is_control)
    {
        return Err(
            "Skill description is required and must not exceed 240 characters.".to_string(),
        );
    }
    Ok(())
}

fn safe_display_label(value: &str, fallback: &str) -> String {
    let label = value
        .chars()
        .filter(|ch| !ch.is_control())
        .take(160)
        .collect::<String>();
    let label = label.trim();
    if label.is_empty() {
        fallback.to_string()
    } else {
        label.replace(['-', '_'], " ")
    }
}

fn security_sensitive_key(key: &str) -> bool {
    let normalized = key
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect::<String>();
    [
        "tool",
        "script",
        "command",
        "dependency",
        "dependencies",
        "mcp",
        "permission",
        "capabilit",
        "executable",
        "hook",
    ]
    .iter()
    .any(|term| normalized.contains(term))
}

fn reject_skill_metadata_security(value: &YamlValue, inside_ideanote: bool) -> Result<(), String> {
    match value {
        YamlValue::Mapping(mapping) => {
            for (key, value) in mapping {
                let key = key.as_str().unwrap_or("");
                let is_ideanote = !inside_ideanote && key == "ideanote";
                let allowed_required_tools = inside_ideanote && key == "requiredTools";
                if !allowed_required_tools && security_sensitive_key(key) {
                    return Err(
                        "Custom Skill metadata cannot declare Tools, scripts, commands, permissions, dependencies, or MCP."
                            .to_string(),
                    );
                }
                reject_skill_metadata_security(value, is_ideanote)?;
            }
        }
        YamlValue::Sequence(values) => {
            for value in values {
                reject_skill_metadata_security(value, inside_ideanote)?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn validate_manifest_files(manifest: &ManagedSkillManifest) -> Result<(), String> {
    if manifest.files.is_empty() || manifest.files.len() > MAX_FILES {
        return Err("Managed Skill file list is invalid.".to_string());
    }
    let mut files = manifest.files.clone();
    files.sort();
    files.dedup();
    if files != manifest.files || !files.iter().any(|path| path == "SKILL.md") {
        return Err("Managed Skill file list is not normalized.".to_string());
    }
    for path in &files {
        validate_relative_path(Path::new(path))?;
        if path == "skill.json" {
            return Err("Managed Skill file list contains a reserved path.".to_string());
        }
        reject_executable_or_dependency(path)?;
    }
    let mut resource_ids = HashSet::new();
    let mut resource_paths = HashSet::new();
    for resource in &manifest.resources {
        if !resource.id.starts_with("ref-")
            || resource
                .id
                .strip_prefix("ref-")
                .and_then(|value| value.parse::<usize>().ok())
                .is_none_or(|value| value == 0)
            || resource.label.trim().is_empty()
            || resource.label.len() > 160
            || !resource.relative_path.starts_with("references/")
            || !is_text_reference(&resource.relative_path)
            || !files.contains(&resource.relative_path)
            || !resource_ids.insert(resource.id.clone())
            || !resource_paths.insert(resource.relative_path.clone())
        {
            return Err("Managed Skill reference metadata is invalid.".to_string());
        }
        validate_relative_path(Path::new(&resource.relative_path))?;
    }
    Ok(())
}

fn read_openai_config(root: &Path) -> Result<OpenAiConfig, String> {
    let path = root.join("agents/openai.yaml");
    if !path.exists() {
        return Ok(OpenAiConfig::default());
    }
    let source = fs::read_to_string(path)
        .map_err(|_| "agents/openai.yaml must be UTF-8 text.".to_string())?;
    let yaml: YamlValue = serde_yaml_ng::from_str(&source)
        .map_err(|_| "agents/openai.yaml is invalid YAML.".to_string())?;
    reject_security_sensitive_yaml(&yaml)?;
    serde_yaml_ng::from_str(&source).map_err(|_| "agents/openai.yaml is invalid YAML.".to_string())
}

fn reject_security_sensitive_yaml(value: &YamlValue) -> Result<(), String> {
    match value {
        YamlValue::Mapping(mapping) => {
            for (key, value) in mapping {
                if key.as_str().is_some_and(security_sensitive_key) {
                    return Err(
                        "agents/openai.yaml cannot declare Tools, scripts, commands, permissions, dependencies, or MCP."
                            .to_string(),
                    );
                }
                reject_security_sensitive_yaml(value)?;
            }
        }
        YamlValue::Sequence(values) => {
            for value in values {
                reject_security_sensitive_yaml(value)?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn content_digest(root: &Path, files: &[String]) -> Result<String, String> {
    let mut hasher = Sha256::new();
    for path in files {
        let content = fs::read(root.join(path))
            .map_err(|_| "Skill content could not be hashed.".to_string())?;
        hasher.update((path.len() as u64).to_le_bytes());
        hasher.update(path.as_bytes());
        hasher.update((content.len() as u64).to_le_bytes());
        hasher.update(content);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn slug(name: &str) -> Result<String, String> {
    let mut slug = String::new();
    let mut separator = false;
    for ch in name.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            separator = false;
        } else if !separator && !slug.is_empty() {
            slug.push('-');
            separator = true;
        }
    }
    while slug.ends_with('-') {
        slug.pop();
    }
    if slug.is_empty() || slug.len() > 64 {
        return Err("Skill name cannot produce a safe managed id.".to_string());
    }
    Ok(slug)
}

fn validate_custom_id(id: &str) -> Result<(), String> {
    let Some(value) = id.strip_prefix("custom:") else {
        return Err("Only managed custom Skill ids can be changed.".to_string());
    };
    if value.is_empty()
        || value.len() > 64
        || !value
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
    {
        return Err("Managed Skill id is invalid.".to_string());
    }
    Ok(())
}

fn metadata_from_manifest(
    manifest: &ManagedSkillManifest,
    valid: bool,
    validation_message: Option<String>,
) -> AgentSkillMetadata {
    AgentSkillMetadata {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        description: manifest.description.clone(),
        origin: AgentSkillOrigin::Custom,
        source_label: manifest.source_label.clone(),
        enabled: manifest.enabled,
        implicit_invocation: manifest.implicit_invocation,
        editor_scopes: manifest.editor_scopes.clone(),
        digest: manifest.digest.clone(),
        valid,
        validation_message,
        last_refreshed_at: Some(manifest.refreshed_at),
        resources: manifest
            .resources
            .iter()
            .map(|resource| AgentSkillResourceMetadata {
                id: resource.id.clone(),
                label: resource.label.clone(),
            })
            .collect(),
        required_tools: manifest.required_tools.clone(),
    }
}

fn now_millis() -> u64 {
    chrono::Utc::now().timestamp_millis().max(0) as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write_skill(root: &Path, name: &str, extra: &str) {
        fs::create_dir_all(root.join("references")).unwrap();
        fs::write(
            root.join("SKILL.md"),
            format!("---\nname: {name}\ndescription: A safe imported workflow\n---\nFollow the workflow carefully.\n{extra}"),
        ).unwrap();
        fs::write(
            root.join("references/guide.md"),
            "# Guide\nUse existing editor Tools.",
        )
        .unwrap();
    }

    #[test]
    fn imports_lists_updates_snapshots_refreshes_and_removes_atomically() {
        let temp = TempDir::new().unwrap();
        let source = temp.path().join("source");
        write_skill(&source, "Diagram polish", "");
        let registry = SkillRegistry::new(temp.path().join("managed"));
        let imported = registry.import(&source, None).unwrap();
        assert_eq!(imported.id, "custom:diagram-polish");
        assert_eq!(imported.resources.len(), 1);
        let updated = registry
            .update(&imported.id, true, true, vec!["ideasketch".to_string()])
            .unwrap();
        assert!(updated.implicit_invocation);
        let snapshot = registry.snapshot(&imported.id).unwrap();
        assert!(snapshot.instructions.contains("Follow the workflow"));
        assert!(snapshot.references["ref-1"].contains("Guide"));
        fs::write(source.join("references/guide.md"), "# Updated guide").unwrap();
        let refreshed = registry.import(&source, Some(&imported.id)).unwrap();
        assert_ne!(refreshed.digest, imported.digest);
        assert!(registry.remove(&imported.id).unwrap());
        assert!(!registry.remove(&imported.id).unwrap());
    }

    #[test]
    fn rejects_reserved_scripts_symlinks_and_oversized_or_malformed_skills_without_partial_state() {
        let temp = TempDir::new().unwrap();
        let registry = SkillRegistry::new(temp.path().join("managed"));
        let reserved = temp.path().join("reserved");
        write_skill(&reserved, "Markdown", "");
        assert!(registry.import(&reserved, None).is_err());

        let scripts = temp.path().join("scripts");
        write_skill(&scripts, "Unsafe", "");
        fs::write(scripts.join("run.py"), "print('no')").unwrap();
        assert!(registry.import(&scripts, None).is_err());

        let malformed = temp.path().join("malformed");
        fs::create_dir_all(&malformed).unwrap();
        fs::write(malformed.join("SKILL.md"), "no frontmatter").unwrap();
        assert!(registry.import(&malformed, None).is_err());

        let reserved_manifest = temp.path().join("reserved-manifest");
        write_skill(&reserved_manifest, "Reserved manifest", "");
        fs::write(reserved_manifest.join("skill.json"), "{}").unwrap();
        assert!(registry.import(&reserved_manifest, None).is_err());

        let disguised_tools = temp.path().join("disguised-tools");
        fs::create_dir_all(&disguised_tools).unwrap();
        fs::write(
            disguised_tools.join("SKILL.md"),
            "---\nname: Disguised tools\ndescription: Unsafe metadata\nmetadata:\n  provider:\n    toolDefinitions: [write_file]\n---\nDo work.\n",
        )
        .unwrap();
        assert!(registry.import(&disguised_tools, None).is_err());

        let invalid_reference = temp.path().join("invalid-reference");
        write_skill(&invalid_reference, "Invalid reference", "");
        fs::write(
            invalid_reference.join("references/guide.md"),
            vec![0xff; MAX_REFERENCE_BYTES + 1],
        )
        .unwrap();
        assert!(registry.import(&invalid_reference, None).is_err());
        assert_eq!(registry.list().unwrap().len(), 2);
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_symlinked_source_root_and_corrupt_managed_paths() {
        use std::os::unix::fs::symlink;

        let temp = TempDir::new().unwrap();
        let source = temp.path().join("source");
        write_skill(&source, "Safe source", "");
        let linked_source = temp.path().join("linked-source");
        symlink(&source, &linked_source).unwrap();
        let registry = SkillRegistry::new(temp.path().join("managed"));
        assert!(registry.import(&linked_source, None).is_err());

        let imported = registry.import(&source, None).unwrap();
        let managed = registry.skill_path(&imported.id).unwrap();
        let manifest_path = managed.join("skill.json");
        let mut manifest: serde_json::Value =
            serde_json::from_slice(&fs::read(&manifest_path).unwrap()).unwrap();
        manifest["resources"][0]["relativePath"] = serde_json::json!("../outside.md");
        fs::write(
            &manifest_path,
            serde_json::to_vec_pretty(&manifest).unwrap(),
        )
        .unwrap();
        let listed = registry.list().unwrap();
        let corrupt = listed.iter().find(|skill| skill.id == imported.id).unwrap();
        assert!(!corrupt.valid);
        assert!(registry.snapshot(&imported.id).is_err());
    }

    #[test]
    fn refresh_rejects_duplicate_or_reserved_names() {
        let temp = TempDir::new().unwrap();
        let first = temp.path().join("first");
        let second = temp.path().join("second");
        write_skill(&first, "First workflow", "");
        write_skill(&second, "Second workflow", "");
        let registry = SkillRegistry::new(temp.path().join("managed"));
        let first = registry.import(&first, None).unwrap();
        let second = registry.import(&second, None).unwrap();

        let replacement = temp.path().join("replacement");
        write_skill(&replacement, "First workflow", "");
        assert!(registry.import(&replacement, Some(&second.id)).is_err());
        fs::write(
            replacement.join("SKILL.md"),
            "---\nname: Markdown\ndescription: Reserved editor name\n---\nDo work.\n",
        )
        .unwrap();
        assert!(registry.import(&replacement, Some(&first.id)).is_err());
    }

    #[test]
    fn implicit_activation_is_lazy_version_checked_and_catalog_bounded() {
        let temp = TempDir::new().unwrap();
        let registry = SkillRegistry::new(temp.path().join("managed"));
        let editor_tools = vec![AgentToolDescriptor {
            name: "read_active_page".to_string(),
            description: "Read the active Page".to_string(),
            input_schema: serde_json::json!({"type": "object", "properties": {}, "additionalProperties": false}),
            requires: Vec::new(),
            ..Default::default()
        }];
        let mut imported_ids = Vec::new();
        for index in 0..=MAX_CATALOG_SKILLS {
            let source = temp.path().join(format!("source-{index}"));
            write_skill(&source, &format!("Workflow {index}"), "");
            let imported = registry.import(&source, None).unwrap();
            registry
                .update(&imported.id, true, true, vec!["ideasketch".to_string()])
                .unwrap();
            imported_ids.push((source, imported.id));
        }
        let mut turn = SkillTurnState::capture(
            &registry,
            "ideasketch",
            Some("ideasketch"),
            &[],
            &editor_tools,
        )
        .unwrap();
        let (_, omitted) = turn.catalog_prompt();
        assert_eq!(omitted, 1);

        let (source, id) = &imported_ids[0];
        fs::write(source.join("references/guide.md"), "# Refreshed").unwrap();
        registry.import(source, Some(id)).unwrap();
        let activate = AgentToolCall {
            call_id: "activate-late".to_string(),
            name: "activate_skill".to_string(),
            arguments: serde_json::json!({"skillId": id}),
        };
        let result = turn.execute_host_tool(&activate, &editor_tools).unwrap();
        assert_eq!(result["success"], false);
        assert!(result["summary"]
            .as_str()
            .unwrap()
            .contains("changed after this Turn started"));
    }

    #[test]
    fn captured_turn_state_activates_and_reads_immutable_instruction_only_snapshots() {
        let temp = TempDir::new().unwrap();
        let source = temp.path().join("source");
        write_skill(&source, "Writing guide", "");
        let registry = SkillRegistry::new(temp.path().join("managed"));
        let imported = registry.import(&source, None).unwrap();
        registry
            .update(&imported.id, true, true, vec!["ideasketch".to_string()])
            .unwrap();
        let editor_tools = vec![AgentToolDescriptor {
            name: "read_active_page".to_string(),
            description: "Read the active Page".to_string(),
            input_schema: serde_json::json!({"type": "object", "properties": {}, "additionalProperties": false}),
            requires: Vec::new(),
            ..Default::default()
        }];
        let mut turn = SkillTurnState::capture(
            &registry,
            "ideasketch",
            Some("ideasketch"),
            &[],
            &editor_tools,
        )
        .unwrap();
        assert!(turn
            .host_tools()
            .iter()
            .any(|tool| tool.name == "activate_skill"));
        let activate = AgentToolCall {
            call_id: "activate-1".to_string(),
            name: "activate_skill".to_string(),
            arguments: serde_json::json!({"skillId": imported.id}),
        };
        let result = turn.execute_host_tool(&activate, &editor_tools).unwrap();
        assert_eq!(result["success"], true);
        assert_eq!(result["persistable"], false);
        assert!(turn
            .provenance()
            .iter()
            .any(|skill| skill.activation_mode == AgentSkillActivationMode::Implicit));

        registry
            .update(&imported.id, false, false, Vec::new())
            .unwrap();
        fs::write(
            source.join("references/guide.md"),
            "# Changed outside the captured Turn",
        )
        .unwrap();
        let read = AgentToolCall {
            call_id: "reference-1".to_string(),
            name: "read_skill_reference".to_string(),
            arguments: serde_json::json!({"skillId": imported.id, "referenceId": "ref-1"}),
        };
        let result = turn.execute_host_tool(&read, &editor_tools).unwrap();
        assert!(result
            .pointer("/content/text")
            .and_then(serde_json::Value::as_str)
            .unwrap()
            .contains("Use existing editor Tools"));

        let reserved_tool = vec![AgentToolDescriptor {
            name: "activate_skill".to_string(),
            description: "Collision".to_string(),
            input_schema: serde_json::json!({"type": "object"}),
            requires: Vec::new(),
            ..Default::default()
        }];
        assert!(SkillTurnState::capture(
            &registry,
            "ideasketch",
            Some("ideasketch"),
            &[],
            &reserved_tool,
        )
        .is_err());
    }
}
