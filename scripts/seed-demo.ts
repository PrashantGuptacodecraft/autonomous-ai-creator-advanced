import { compilePersona } from "@/lib/editorial/persona";
import {
  attachWorkflowRun,
  createAgent,
  prepareAgentForWorkflow,
} from "@/lib/db/repository";
import { getConfig } from "@/lib/config";

async function main(): Promise<void> {
  const input = { name: "Mira Vale", domain: "AI Systems Reliability" };
  const persona = compilePersona(input);
  const agentId = await createAgent(input, persona, getConfig().EVALUATION_WINDOW_HOURS);
  await prepareAgentForWorkflow(agentId);
  await attachWorkflowRun(agentId, "local_demo_workflow");
  console.log(`Demo agent created: ${agentId}`);
  console.log(`Dashboard: http://localhost:3000/agent/${agentId}`);
  console.log("This seed creates dashboard data only. Use POST /api/agent/init to start the durable workflow.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
