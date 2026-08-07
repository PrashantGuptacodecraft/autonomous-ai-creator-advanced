import { sleep } from "workflow";
import { getConfig } from "@/lib/config";
import {
  getAgentContext,
  markAgentCompleted,
  setNextCycleAt,
} from "@/lib/db/repository";
import { runEditorialCycle } from "@/lib/editorial/cycle";

export interface AutonomousWorkflowInput {
  agentId: string;
  maxCycles: number;
}

async function planCycle(agentId: string, cycleNumber: number) {
  "use step";
  const context = await getAgentContext(agentId);
  if (!context) return { continue: false, delaySeconds: 0, reason: "Unknown agent" };
  if (context.agent.status !== "ACTIVE") {
    return { continue: false, delaySeconds: 0, reason: `Agent is ${context.agent.status}` };
  }
  if (new Date(context.agent.evaluation_ends_at).getTime() <= Date.now()) {
    await markAgentCompleted(agentId);
    return { continue: false, delaySeconds: 0, reason: "Evaluation window ended" };
  }

  const config = getConfig();
  const delaySeconds = cycleNumber === 0
    ? config.FIRST_CYCLE_DELAY_SECONDS
    : context.agent.next_cycle_at
      ? Math.max(
          0,
          Math.ceil((new Date(context.agent.next_cycle_at).getTime() - Date.now()) / 1000),
        )
      : config.MIN_CYCLE_DELAY_SECONDS;
  if (cycleNumber === 0) {
    await setNextCycleAt(agentId, new Date(Date.now() + delaySeconds * 1000));
  }
  return { continue: true, delaySeconds, reason: "Cycle planned" };
}

async function executeCycle(agentId: string, cycleNumber: number) {
  "use step";
  return runEditorialCycle(agentId, cycleNumber);
}

async function completeAgent(agentId: string) {
  "use step";
  await markAgentCompleted(agentId);
}

export async function autonomousCreatorWorkflow(input: AutonomousWorkflowInput) {
  "use workflow";
  for (let cycleNumber = 0; cycleNumber < input.maxCycles; cycleNumber += 1) {
    const plan = await planCycle(input.agentId, cycleNumber);
    if (!plan.continue) return { completed: true, reason: plan.reason, cycles: cycleNumber };
    if (plan.delaySeconds > 0) {
      await sleep(`${plan.delaySeconds} seconds`);
    }
    await executeCycle(input.agentId, cycleNumber);
  }
  await completeAgent(input.agentId);
  return { completed: true, reason: "Maximum autonomous cycles completed", cycles: input.maxCycles };
}
