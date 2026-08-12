import { ArrowUpRight, GitBranch } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getRuntimeAppVersion,
  openOfficialAppDestination,
  type AppDestination,
  type RuntimeAppVersion,
} from "../../lib/appInfo";

function versionLabel(version: RuntimeAppVersion | undefined): string {
  if (!version) return "Reading…";
  if (version.kind === "version") return version.value;
  if (version.kind === "development") return "Development preview";
  return "Unavailable";
}

export function AboutSettings() {
  const [version, setVersion] = useState<RuntimeAppVersion>();
  const [linkError, setLinkError] = useState<string>();

  useEffect(() => {
    let active = true;
    void getRuntimeAppVersion().then((result) => {
      if (active) setVersion(result);
    });
    return () => { active = false; };
  }, []);

  const openDestination = async (destination: AppDestination) => {
    setLinkError(undefined);
    try {
      await openOfficialAppDestination(destination);
    } catch (cause) {
      setLinkError(cause instanceof Error ? cause.message : "IdeaNote could not open this link.");
    }
  };

  return (
    <section className="ideanote-about" aria-label="About IdeaNote">
      <div className="ideanote-about__identity">
        <div className="ideanote-about__mark" aria-hidden>IN</div>
        <div>
          <div className="ideanote-about__product">IdeaNote</div>
          <p>A local-first workspace for visual thinking, Markdown, and AI-assisted editing.</p>
        </div>
      </div>

      <div className="ideanote-about__version" aria-live="polite">
        <span>Version</span>
        <strong>{versionLabel(version)}</strong>
      </div>

      <div className="ideanote-about__links" aria-label="Official IdeaNote links">
        <button
          type="button"
          className="ideanote-about__link"
          aria-label="Open IdeaNote GitHub repository"
          onClick={() => { void openDestination("repository"); }}
        >
          <GitBranch aria-hidden size={15} strokeWidth={1.8} />
          <span><strong>GitHub repository</strong><small>Source code and project information</small></span>
          <ArrowUpRight aria-hidden size={14} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="ideanote-about__link"
          aria-label="Open IdeaNote release downloads"
          onClick={() => { void openDestination("releases"); }}
        >
          <ArrowUpRight aria-hidden size={15} strokeWidth={1.8} />
          <span><strong>Release downloads</strong><small>Published desktop versions</small></span>
          <ArrowUpRight aria-hidden size={14} strokeWidth={1.8} />
        </button>
      </div>

      {linkError && <div className="ideanote-about__error" role="alert">{linkError}</div>}
    </section>
  );
}
