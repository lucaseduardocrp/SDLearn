import { z } from 'zod';
import type { ChaosResult, ChaosRun, Consensus, DebateTurn, Design, JudgeAssessment, JudgeId, Problem, RubricReport } from '../../../shared/types/entities';
import { describeDesign } from '../../../shared/engine/graph';
import { verdictFor } from '../../../shared/engine/rubric';
import type { LlmProvider } from './llm-provider';

export const judgeProfiles: Record<JudgeId, { name: string; persona: string }> = {
  rigor: {
    name: 'O Rigoroso',
    persona: 'You are "O Rigoroso", a bar-raiser staff engineer at a large tech company. You care about correctness under failure, explicit consistency guarantees, capacity math that adds up, and named failure modes. You penalize hand-waving, missing components and unexamined single points of failure. You are fair but demanding.',
  },
  pragmatic: {
    name: 'O Pragmático',
    persona: 'You are "O Pragmático", a seasoned startup CTO who has shipped systems at scale. You value simple designs that meet the stated requirements, sensible trade-offs, cost awareness and what can realistically be covered in a 45-60 minute interview. You penalize over-engineering and credit candidates who justify decisions, even if they are not exhaustive.',
  },
};

const dimensionNames = ['Requisitos e escopo', 'Arquitetura e componentes', 'Escalabilidade', 'Confiabilidade', 'Dados e consistência', 'Trade-offs'];
const score = z.coerce.number().min(0).max(100).transform(Math.round);
const textList = z.array(z.string().min(1)).max(8).default([]);

const assessmentSchema = z.object({
  score, summary: z.string().min(1), strengths: textList, weaknesses: textList,
  dimensions: z.array(z.object({ name: z.string(), score })).default([]),
});
const debateSchema = z.object({ revisedScore: score, agreements: textList, disagreements: textList, argument: z.string().min(1) });
const consensusSchema = z.object({ score, summary: z.string().min(1), keyStrengths: textList, keyImprovements: textList, nextSteps: textList });

export interface JudgeContext {
  problem: Problem;
  design: Design;
  rubric: RubricReport;
  baseline: ChaosResult;
  chaosRuns: ChaosRun[];
}

export interface PanelProgress {
  phase: 'judging' | 'debating' | 'deliberating';
  assessments?: JudgeAssessment[];
  debate?: DebateTurn[];
}

const language = 'Write every human-readable string in Brazilian Portuguese. Respond with a single JSON object and nothing else.';

export function buildBrief(context: JudgeContext): string {
  const { problem, design, rubric, baseline, chaosRuns } = context;
  const chaos = chaosRuns.slice(0, 6).map((run) => `- ${run.result.scenarioId}${run.result.targetLabel ? ` on ${run.result.targetLabel}` : ''}${run.result.magnitude ? ` (${run.result.magnitude})` : ''}: ${run.result.outcome}, ${Math.round(run.result.servedRatio * 100)}% served, ${run.result.latencyMs} ms`);
  return [
    `# Problem: ${problem.title} (${problem.difficulty})`,
    problem.statement,
    `Functional requirements:\n${problem.functionalRequirements.map((item) => `- ${item}`).join('\n')}`,
    `Non-functional requirements:\n${problem.nonFunctionalRequirements.map((item) => `- ${item}`).join('\n')}`,
    `Scale:\n${problem.scale.map((item) => `- ${item.label}: ${item.value}`).join('\n')}`,
    `# Candidate design (from the canvas)\n${describeDesign(design)}`,
    design.mermaid.trim() ? `# Candidate Mermaid diagram\n${design.mermaid.trim()}` : '',
    `# Candidate notes and trade-offs\n${design.notes.trim() || '(no notes written)'}`,
    `# Automatic analysis (deterministic simulator; treat as evidence, not as the grade)`,
    `Rubric pre-check ${rubric.score}/100:\n${rubric.checks.map((check) => `- [${check.passed ? 'x' : ' '}] ${check.label}: ${check.detail}`).join('\n')}`,
    `Baseline at peak load: ${Math.round(baseline.servedRatio * 100)}% served, estimated latency ${baseline.latencyMs} ms (budget ${baseline.latencyBudgetMs} ms). Single points of failure: ${baseline.singlePointsOfFailure.map((item) => item.label).join(', ') || 'none'}.`,
    chaos.length ? `Chaos experiments run by the candidate:\n${chaos.join('\n')}` : 'The candidate did not run chaos experiments.',
  ].filter(Boolean).join('\n\n');
}

export class JudgePanel {
  constructor(private readonly provider: LlmProvider) {}

  async run(context: JudgeContext, onProgress: (progress: PanelProgress) => Promise<void>): Promise<{ assessments: JudgeAssessment[]; debate: DebateTurn[]; consensus: Consensus }> {
    const brief = buildBrief(context);
    await onProgress({ phase: 'judging' });
    const assessments = await Promise.all((['rigor', 'pragmatic'] as JudgeId[]).map((judge) => this.assess(judge, brief)));

    await onProgress({ phase: 'debating', assessments });
    const debate = await Promise.all(assessments.map((own, index) => this.rebut(own, assessments[1 - index], brief)));

    await onProgress({ phase: 'deliberating', assessments, debate });
    const consensus = await this.deliberate(brief, assessments, debate);
    return { assessments, debate, consensus };
  }

  private async assess(judge: JudgeId, brief: string): Promise<JudgeAssessment> {
    const system = `${judgeProfiles[judge].persona}\nYou are grading a system design interview answer independently; another judge with a different philosophy grades it too. Score 0-100 where 75+ is a hire-level pass, 55-74 borderline, below 55 fail. Score each dimension (${dimensionNames.join(', ')}) 0-100. Be specific: cite components and requirements by name.\n${language}`;
    const user = `${brief}\n\nReturn JSON: {"score": int, "summary": string (2-4 sentences), "strengths": string[] (2-5), "weaknesses": string[] (2-5), "dimensions": [{"name": string, "score": int}]}`;
    const result = await this.ask(system, user, assessmentSchema);
    return { judge, score: result.score, verdict: verdictFor(result.score), summary: result.summary, strengths: result.strengths, weaknesses: result.weaknesses, dimensions: result.dimensions };
  }

  private async rebut(own: JudgeAssessment, other: JudgeAssessment, brief: string): Promise<DebateTurn> {
    const system = `${judgeProfiles[own.judge].persona}\nYou already graded this design. Now read the other judge's assessment, then defend or revise your position. Move your score only when the other judge raises evidence you missed.\n${language}`;
    const user = `${brief}\n\n# Your assessment (${own.score}/100)\n${JSON.stringify({ summary: own.summary, strengths: own.strengths, weaknesses: own.weaknesses })}\n\n# ${judgeProfiles[other.judge].name}'s assessment (${other.score}/100)\n${JSON.stringify({ summary: other.summary, strengths: other.strengths, weaknesses: other.weaknesses })}\n\nReturn JSON: {"revisedScore": int, "agreements": string[] (1-3), "disagreements": string[] (0-3), "argument": string (2-4 sentences addressed to the other judge)}`;
    const result = await this.ask(system, user, debateSchema);
    return { judge: own.judge, ...result };
  }

  private async deliberate(brief: string, assessments: JudgeAssessment[], debate: DebateTurn[]): Promise<Consensus> {
    const scores = debate.map((turn) => turn.revisedScore);
    const [low, high] = [Math.min(...scores), Math.max(...scores)];
    const system = `You are the neutral moderator of a two-judge system design panel. Produce the consensus verdict from both assessments and the debate. The final score must lie between the two revised scores (${low}-${high}). Feedback must be actionable for the candidate.\n${language}`;
    const transcript = assessments.map((item) => `${judgeProfiles[item.judge].name} (${item.score}): ${item.summary}\n+ ${item.strengths.join('\n+ ')}\n- ${item.weaknesses.join('\n- ')}`).join('\n\n');
    const rebuttals = debate.map((turn) => `${judgeProfiles[turn.judge].name} → ${turn.revisedScore}: ${turn.argument}`).join('\n');
    const user = `${brief}\n\n# Assessments\n${transcript}\n\n# Debate\n${rebuttals}\n\nReturn JSON: {"score": int, "summary": string (3-5 sentences), "keyStrengths": string[] (2-4), "keyImprovements": string[] (2-5), "nextSteps": string[] (2-4 concrete study or practice actions)}`;
    const result = await this.ask(system, user, consensusSchema);
    const finalScore = Math.min(high, Math.max(low, result.score));
    return { ...result, score: finalScore, verdict: verdictFor(finalScore) };
  }

  private async ask<T>(system: string, user: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return schema.parse(await this.provider.completeJson(system, user));
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Judge returned an invalid response.');
  }
}
