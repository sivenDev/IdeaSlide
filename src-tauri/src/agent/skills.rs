use sha2::{Digest, Sha256};

use super::types::{AgentSkillMetadata, AgentSkillOrigin, AgentSkillResourceMetadata};

const IDEA_SKETCH_SKILL: &str = include_str!("../../agent-skills/ideasketch/SKILL.md");
const MARKDOWN_SKILL: &str = include_str!("../../agent-skills/markdown/SKILL.md");
const MARKDOWN_GFM_REFERENCE: &str =
    include_str!("../../agent-skills/markdown/references/gfm-editing.md");

pub(crate) struct BundledSkill {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    instructions: &'static str,
    references: &'static [&'static str],
}

pub(crate) const BUNDLED_SKILLS: &[BundledSkill] = &[
    BundledSkill {
        id: "ideasketch",
        name: "IdeaSketch",
        description: "Bounded direct editor tools for the active IdeaSketch document",
        instructions: IDEA_SKETCH_SKILL,
        references: &[],
    },
    BundledSkill {
        id: "markdown",
        name: "Markdown",
        description: "Bounded reads and native range edits for the active Markdown document",
        instructions: MARKDOWN_SKILL,
        references: &[MARKDOWN_GFM_REFERENCE],
    },
];

fn digest(skill: &BundledSkill) -> String {
    let mut hasher = Sha256::new();
    hasher.update((skill.instructions.len() as u64).to_le_bytes());
    hasher.update(skill.instructions.as_bytes());
    for reference in skill.references {
        hasher.update((reference.len() as u64).to_le_bytes());
        hasher.update(reference.as_bytes());
    }
    format!("{:x}", hasher.finalize())
}

pub(crate) fn discover_skills() -> Vec<AgentSkillMetadata> {
    BUNDLED_SKILLS
        .iter()
        .map(|skill| AgentSkillMetadata {
            id: skill.id.to_string(),
            name: skill.name.to_string(),
            description: skill.description.to_string(),
            origin: AgentSkillOrigin::Bundled,
            source_label: "Bundled with IdeaNote".to_string(),
            enabled: true,
            implicit_invocation: false,
            editor_scopes: vec![skill.id.to_string()],
            digest: digest(skill),
            valid: true,
            validation_message: None,
            last_refreshed_at: None,
            resources: skill
                .references
                .iter()
                .enumerate()
                .map(|(index, _)| AgentSkillResourceMetadata {
                    id: format!("ref-{}", index + 1),
                    label: format!("Bundled reference {}", index + 1),
                })
                .collect(),
            required_tools: Vec::new(),
        })
        .collect()
}

pub(crate) fn load_skill(id: &str) -> Result<String, String> {
    let skill = BUNDLED_SKILLS
        .iter()
        .find(|skill| skill.id == id)
        .ok_or_else(|| format!("Unknown Agent Skill: {id}"))?;
    let mut instructions = skill.instructions.to_string();
    for reference in skill.references {
        instructions.push_str("\n\nBUNDLED REFERENCE:\n");
        instructions.push_str(reference);
    }
    Ok(instructions)
}

pub(crate) fn load_bundled_reference(id: &str, reference_id: &str) -> Result<String, String> {
    let skill = BUNDLED_SKILLS
        .iter()
        .find(|skill| skill.id == id)
        .ok_or_else(|| format!("Unknown Agent Skill: {id}"))?;
    let index = reference_id
        .strip_prefix("ref-")
        .and_then(|value| value.parse::<usize>().ok())
        .and_then(|value| value.checked_sub(1))
        .ok_or_else(|| "Unknown Skill reference.".to_string())?;
    skill
        .references
        .get(index)
        .map(|value| (*value).to_string())
        .ok_or_else(|| "Unknown Skill reference.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skill_discovery_is_metadata_only() {
        let skills = discover_skills();
        assert_eq!(skills.len(), 2);
        assert_eq!(skills[0].id, "ideasketch");
        assert_eq!(skills[1].id, "markdown");
        assert!(!skills[0].description.contains("ideanote-change"));
    }

    #[test]
    fn active_skill_loads_full_instructions() {
        let instructions = load_skill("ideasketch").expect("skill should load");
        assert!(instructions.contains("add_page"));
        assert!(!instructions.contains("propose_add_page"));
        assert!(!instructions.contains("```ideanote-change"));
        let markdown = load_skill("markdown").expect("Markdown Skill should load");
        assert!(markdown.contains("read_markdown_range"));
        assert!(markdown.contains("GFM Editing Reference"));
        assert!(load_skill("unknown").is_err());
    }
}
