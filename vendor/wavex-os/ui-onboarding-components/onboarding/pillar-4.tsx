import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Compass } from "lucide-react";
import { wavexOsOnboardingApi } from "../../../api/wavexOsOnboarding";
import { Button } from "../../ui/button";
import { ExpandedTextInput } from "./ExpandedTextInput";
import { applyHintToOptions, consumeHint, transitionHints } from "./transition-hints";
import { CLOSE_CHANNELS, LEAD_SOURCES, SALES_MOTIONS } from "./options";
import { ChipMultiSelect, H2, P, RadioGroup } from "./primitives";
import { deriveGtmProfile, displayGtmProfile } from "./gtm-profile";

export function Pillar4({
  companyId,
  onDone,
  initial,
}: {
  companyId: string;
  onDone: () => void;
  initial?: {
    lead_sources?: string[];
    lead_source_other?: string;
    sales_motion?: string;
    sales_motion_other?: string;
    close_channel?: string;
    close_channel_other?: string;
  };
}) {
  const lsHint = consumeHint("pillar_4.lead_source");
  const smHint = consumeHint("pillar_4.sales_motion");
  const lsOptions = useMemo(() => applyHintToOptions(LEAD_SOURCES, lsHint), [lsHint]);
  const smOptions = useMemo(() => applyHintToOptions(SALES_MOTIONS, smHint), [smHint]);
  const [leadSources, setLeadSources] = useState<string[]>(
    initial?.lead_sources?.length ? initial.lead_sources : [lsOptions[0]?.v ?? "outbound_cold"],
  );
  const [lsOther, setLsOther] = useState(initial?.lead_source_other ?? "");
  const [sm, setSm] = useState<string>(initial?.sales_motion ?? smOptions[0]?.v ?? "high_touch_enterprise");
  const [smOther, setSmOther] = useState(initial?.sales_motion_other ?? "");
  const [cc, setCc] = useState<string | undefined>(initial?.close_channel ?? "mostly_phone_video");
  const [ccOther, setCcOther] = useState(initial?.close_channel_other ?? "");
  const needsClose = sm === "assisted_demo" || sm === "high_touch_enterprise";
  const lsIncludesOther = leadSources.includes("other");
  const lsOtherMissing = lsIncludesOther && lsOther.trim().length < 40;
  const smOtherMissing = sm === "other" && smOther.trim().length < 40;
  const ccOtherMissing = needsClose && cc === "other" && ccOther.trim().length < 40;
  const lsCountInvalid = leadSources.length < 1 || leadSources.length > 3;
  const resolvedProfile = useMemo(
    () => (leadSources.length > 0 && sm !== "other" ? deriveGtmProfile({ lead_sources: leadSources, sales_motion: sm }) : null),
    [leadSources, sm],
  );
  const profileDisplay = resolvedProfile ? displayGtmProfile(resolvedProfile) : null;

  const toggleLead = (v: string) => {
    setLeadSources((cur) => {
      if (cur.includes(v)) return cur.filter((x) => x !== v);
      if (cur.length >= 3) return cur;
      return [...cur, v];
    });
  };

  const submit = useMutation({
    mutationFn: () =>
      wavexOsOnboardingApi.pillar4({
        companyId,
        lead_sources: leadSources,
        lead_source_other: lsIncludesOther ? lsOther : undefined,
        sales_motion: sm,
        sales_motion_other: sm === "other" ? smOther : undefined,
        close_channel: needsClose ? cc : undefined,
        close_channel_other: needsClose && cc === "other" ? ccOther : undefined,
      }),
    onSuccess: (resp) => {
      transitionHints.current = resp.transition?.next_question_modifications ?? [];
      onDone();
    },
  });
  return (
    <>
      <H2>Pillar 4 · Go-To-Market Motion</H2>
      <P>{smHint?.hint_text_override ?? "Drives connector selection, swarm topology, and workflow sequencing."}</P>
      <ChipMultiSelect
        title="How customers find you (pick 1–3, primary first)"
        values={leadSources}
        onToggle={toggleLead}
        options={lsOptions.map((o) => ({ value: o.v, label: o.l }))}
        max={3}
      />
      {lsIncludesOther && (
        <ExpandedTextInput
          value={lsOther}
          onChange={setLsOther}
          placeholder="Describe your lead source — what specifically is working today?"
        />
      )}
      <RadioGroup
        title="Sales motion"
        value={sm}
        onChange={setSm}
        options={smOptions.map((o) => ({ value: o.v, label: o.l }))}
      />
      {sm === "other" && (
        <ExpandedTextInput
          value={smOther}
          onChange={setSmOther}
          placeholder="Describe your sales motion — who's involved, how long to close, what's the hand-off."
        />
      )}
      {needsClose && (
        <>
          <RadioGroup
            title="Close channel"
            value={cc ?? ""}
            onChange={setCc}
            options={CLOSE_CHANNELS.map((o) => ({ value: o.v, label: o.l }))}
          />
          {cc === "other" && (
            <ExpandedTextInput
              value={ccOther}
              onChange={setCcOther}
              placeholder="Describe how deals close — meeting format, decision-making dynamics."
            />
          )}
        </>
      )}
      {profileDisplay && (
        <div className="flex items-start gap-2 rounded-md border border-purple-500/30 bg-purple-500/5 p-3 text-xs text-purple-900 dark:text-purple-100">
          <Compass className="mt-0.5 size-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
          <div>
            <div className="font-medium">Looks like you're {profileDisplay.name}</div>
            <div className="text-purple-800/80 dark:text-purple-200/80">{profileDisplay.primary_agents}</div>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button
          onClick={() => submit.mutate()}
          disabled={submit.isPending || lsCountInvalid || lsOtherMissing || smOtherMissing || ccOtherMissing}
        >
          Next <ArrowRight className="ml-1 size-3.5" />
        </Button>
      </div>
    </>
  );
}
