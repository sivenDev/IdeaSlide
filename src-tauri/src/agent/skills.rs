use super::types::AgentSkillMetadata;

const IDEA_SKETCH_SKILL: &str = include_str!("../../agent-skills/ideasketch/SKILL.md");

pub(crate) fn discover_skills() -> Vec<AgentSkillMetadata> {
    vec![AgentSkillMetadata {
        id: "ideasketch".to_string(),
        name: "IdeaSketch".to_string(),
        description: "Review-first tools for the active IdeaSketch document".to_string(),
    }]
}

pub(crate) fn load_skill(id: &str) -> Result<&'static str, String> {
    match id {
        "ideasketch" => Ok(IDEA_SKETCH_SKILL),
        _ => Err(format!("Unknown Agent Skill: {id}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skill_discovery_is_metadata_only() {
        let skills = discover_skills();
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].id, "ideasketch");
        assert!(!skills[0].description.contains("ideanote-change"));
    }

    #[test]
    fn active_skill_loads_full_instructions() {
        let instructions = load_skill("ideasketch").expect("skill should load");
        assert!(instructions.contains("propose_add_page"));
        assert!(!instructions.contains("```ideanote-change"));
        assert!(load_skill("unknown").is_err());
    }
}
