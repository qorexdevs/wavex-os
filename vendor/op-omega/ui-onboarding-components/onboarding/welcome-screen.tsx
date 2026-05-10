/**
 * "What happens next" entry screen — shown once before Pillar 1 when the
 * operator has not yet started any pillar. Sets time + scope expectation
 * and leads with the dry-run trust commitment.
 *
 * Per audit Item K · cycle-0 follow-up.
 */

import { ArrowRight, Clock, ListChecks, ShieldCheck, Workflow } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { H2, P } from "./primitives";

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span className="flex size-5 items-center justify-center rounded-full bg-purple-500/20 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
            Ω
          </span>
          <span>Welcome to Operator Ω</span>
        </div>
        <H2>Here's what happens next</H2>
        <P>A short setup, then your revenue flywheel runs in safe mode for two weeks.</P>
      </div>

      <ol className="space-y-3">
        <li className="flex gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <ListChecks className="size-4" />
          </div>
          <div>
            <div className="font-medium">5 short sections about your company</div>
            <div className="text-xs text-muted-foreground">
              Org name + website, product state, GTM motion, and where you want updates. Most operators finish in ~5 minutes.
            </div>
          </div>
        </li>
        <li className="flex gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300">
            <Workflow className="size-4" />
          </div>
          <div>
            <div className="font-medium">We generate your plans for review</div>
            <div className="text-xs text-muted-foreground">
              Connectors, agent roster, workflows, KPI baselines. You see and approve each one. ~3 minutes.
            </div>
          </div>
        </li>
        <li className="flex gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-400">
            <Clock className="size-4" />
          </div>
          <div>
            <div className="font-medium">Total time: ~10–15 minutes</div>
            <div className="text-xs text-muted-foreground">
              You can save and come back at any step.
            </div>
          </div>
        </li>
      </ol>

      <section className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="size-3.5" /> Dry-run promise · 14 days
        </div>
        <div className="text-sm">
          For the first 14 days after setup, every external action your Swarm wants to take is{" "}
          <strong>held for your explicit approval</strong>. Nothing posts to Telegram, sends an email,
          spends an ad dollar, or writes to your tools without you saying yes. You stay in control while
          the system learns your business.
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={onStart}>
          Get Started <ArrowRight className="ml-1 size-3.5" />
        </Button>
      </div>
    </Card>
  );
}
