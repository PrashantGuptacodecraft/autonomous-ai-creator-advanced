"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function InitForm(): React.ReactElement {
  const router = useRouter();
  const [name, setName] = useState("Mira Vale");
  const [domain, setDomain] = useState("AI Systems Reliability");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const response = await fetch("/api/agent/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: { name, domain } }),
      });
      const payload = (await response.json()) as { agentId?: string; error?: string };
      if (!response.ok || !payload.agentId) {
        throw new Error(payload.error ?? "Initialization failed.");
      }
      router.push(`/agent/${encodeURIComponent(payload.agentId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Initialization failed.");
      setStatus("error");
    }
  }

  return (
    <form className="init-form" onSubmit={submit}>
      <label>
        Persona name
        <input
          value={name}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
          minLength={2}
          maxLength={80}
          required
        />
      </label>
      <label>
        AI or technology domain
        <input
          value={domain}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDomain(event.target.value)}
          minLength={2}
          maxLength={120}
          required
        />
      </label>
      <button disabled={status === "submitting"} type="submit">
        {status === "submitting" ? "Starting durable workflow…" : "Initialize autonomous creator"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <p className="form-note">
        Initialization starts the background workflow. Opening the feed never creates a post.
      </p>
    </form>
  );
}
