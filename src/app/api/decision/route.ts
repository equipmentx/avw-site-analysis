import { NextRequest, NextResponse } from "next/server";
import { getCountry } from "@/lib/countryData";
import type { SiteAnalysisResult, AiDecision } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

// ── Rule-based decision engine (works without any AI API key) ─────────────────
function rulesDecision(
  result: SiteAnalysisResult,
  budgetUSD: number,
  exchangeRate: number
): AiDecision {
  const country     = getCountry(result.countryCode);
  const minRequired = country.minViableUSD;
  const { score, financialProjection: fp, trafficSignals, competitors, reviewInsights } = result;

  // ── Budget feasibility ──────────────────────────────────────────────────────
  const budgetGap     = minRequired - budgetUSD;
  const budgetRatio   = budgetUSD / minRequired;
  const budgetFeasible = budgetRatio >= 1.0;
  const budgetMarginal = budgetRatio >= 0.6 && budgetRatio < 1.0;

  // ── Verdict logic ───────────────────────────────────────────────────────────
  let verdict: AiDecision["verdict"];
  if (!budgetFeasible && !budgetMarginal) {
    verdict = "DO NOT INVEST";
  } else if (!budgetFeasible && budgetMarginal) {
    verdict = "PROCEED WITH CAUTION";
  } else if (score.overall >= 68) {
    verdict = "INVEST";
  } else if (score.overall >= 45) {
    verdict = "PROCEED WITH CAUTION";
  } else {
    verdict = "DO NOT INVEST";
  }

  // ── Budget analysis message ─────────────────────────────────────────────────
  let budgetAnalysis: string;
  if (budgetFeasible) {
    budgetAnalysis =
      `Budget of ${fmtUSD(budgetUSD)} is SUFFICIENT for a car wash in ${country.name}. ` +
      `Minimum viable investment is ${fmtUSD(minRequired)} (based on the 404 Excel model scaled to ${country.name} ` +
      `at ${(country.multiplier * 100).toFixed(0)}% of the US benchmark). ` +
      `Your budget covers ${(budgetRatio * 100).toFixed(0)}% of the minimum threshold.`;
  } else if (budgetMarginal) {
    budgetAnalysis =
      `Budget of ${fmtUSD(budgetUSD)} is MARGINAL for a car wash in ${country.name}. ` +
      `Minimum viable investment is ${fmtUSD(minRequired)} — you are ${fmtUSD(budgetGap)} short (${(budgetRatio * 100).toFixed(0)}% funded). ` +
      `At this level you may be limited to a self-serve or in-bay automatic format rather than a full express tunnel. ` +
      `Consider raising additional equity or revising to a smaller format.`;
  } else {
    budgetAnalysis =
      `Budget of ${fmtUSD(budgetUSD)} is INSUFFICIENT for a car wash in ${country.name}. ` +
      `The minimum viable investment is ${fmtUSD(minRequired)}, meaning you are ${fmtUSD(budgetGap)} short (${(budgetRatio * 100).toFixed(0)}% funded). ` +
      `A US-standard express tunnel requires: equipment alone ~$1.2M, construction ~$1.08M, land ~$875K. ` +
      `Even in lower-cost markets like ${country.name}, core equipment and installation represent the largest fixed cost. ` +
      `At your current budget level, a full car wash facility cannot be built. ` +
      `To proceed: either increase your investment to at least ${fmtUSD(minRequired)}, or explore a manual/hand-wash format at significantly lower entry cost.`;
  }

  // ── Green flags ─────────────────────────────────────────────────────────────
  const greenFlags: string[] = [];
  if (trafficSignals.estimatedDailyTraffic >= 8_000) greenFlags.push(`High estimated daily traffic: ${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day`);
  if (score.components.competition >= 60)            greenFlags.push(`Weak competition nearby (score ${score.components.competition}/100) — low market saturation`);
  if (score.components.opportunity >= 65)            greenFlags.push(`Strong opportunity gap: competitors have notable service weaknesses`);
  if (fp.year1EBITDA > 0)                            greenFlags.push(`Financial model shows positive Year 1 EBITDA: ${fmtUSD(fp.year1EBITDA)}`);
  if (fp.paybackYears <= 5)                          greenFlags.push(`Estimated payback period of ${fp.paybackYears} years is within industry benchmark (4-7 years)`);
  if (reviewInsights.premiumOpportunity)             greenFlags.push("Low competitor quality signals room to charge premium pricing");
  if (trafficSignals.nearbyGasStations >= 3)         greenFlags.push(`${trafficSignals.nearbyGasStations} gas stations nearby — strong arterial road traffic indicator`);
  if (budgetFeasible)                                greenFlags.push(`Budget is fully funded (${(budgetRatio * 100).toFixed(0)}% of minimum threshold)`);

  // ── Red flags ───────────────────────────────────────────────────────────────
  const redFlags: string[] = [];
  if (!budgetFeasible)                               redFlags.push(`Budget ${fmtUSD(budgetUSD)} is below minimum viable ${fmtUSD(minRequired)} — gap of ${fmtUSD(budgetGap)}`);
  if (fp.year1EBITDA <= 0)                           redFlags.push(`Year 1 EBITDA is negative (${fmtUSD(fp.year1EBITDA)}) — location may not generate enough revenue at current traffic levels`);
  if (score.components.traffic < 40)                 redFlags.push(`Low traffic score (${score.components.traffic}/100) — not enough daily cars passing the site`);
  if (score.components.competition >= 75)            redFlags.push(`High competition score (${score.components.competition}/100) — strong established players nearby`);
  if (fp.paybackYears > 8)                           redFlags.push(`Long payback period of ${fp.paybackYears} years exceeds the 7-year industry benchmark`);
  if (trafficSignals.estimatedDailyTraffic < 3_000)  redFlags.push(`Very low estimated traffic (${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day) — capture rate will be insufficient`);
  if (competitors.length >= 5)                       redFlags.push(`${competitors.length} car washes detected within 5 miles — market may be over-served`);
  if (fp.irr5Year < 10)                              redFlags.push(`5-year IRR of ~${fp.irr5Year}% is below typical 15% investment hurdle rate`);

  // ── Key factors ─────────────────────────────────────────────────────────────
  const keyFactors: string[] = [
    `Overall location score: ${score.overall}/100 (${score.grade} — ${score.verdict})`,
    `Traffic score: ${score.components.traffic}/100 | Competition: ${score.components.competition}/100 | Opportunity: ${score.components.opportunity}/100`,
    `Year 1 revenue projection: ${fmtUSD(fp.year1Revenue)} | EBITDA: ${fmtUSD(fp.year1EBITDA)}`,
    `Year 5 revenue projection: ${fmtUSD(fp.year5Revenue)} | 5-Year IRR: ~${fp.irr5Year}%`,
    `Competitors found within 5 miles: ${competitors.length} | Market saturation: ${reviewInsights.marketSaturationLevel}`,
    `Estimated daily traffic: ${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day`,
    `Country cost index: ${country.name} at ${(country.multiplier * 100).toFixed(0)}% of US benchmark`,
  ];

  // ── Calculation breakdown ───────────────────────────────────────────────────
  const calculationBreakdown =
    `BUDGET CHECK: Input budget ${fmtUSD(budgetUSD)} ÷ Country minimum ${fmtUSD(minRequired)} = ${(budgetRatio * 100).toFixed(1)}% funded. ` +
    `Country minimum = US Excel baseline $3,663,000 × ${country.name} multiplier ${(country.multiplier * 100).toFixed(0)}% × 0.41 viability factor. ` +
    `\n\nSCORE BREAKDOWN: Overall ${score.overall}/100 computed as: ` +
    `Traffic (${score.components.traffic}/100 × 25%) + Competition (${score.components.competition}/100 × 25%) + ` +
    `Opportunity (${score.components.opportunity}/100 × 20%) + Market (${score.components.market}/100 × 15%) + ` +
    `Financial (${score.components.financial}/100 × 15%) = ${score.overall}/100. ` +
    `\n\nTRAFFIC ESTIMATE: Computed from ${trafficSignals.nearbyGasStations} gas stations ×1,500 + ` +
    `${trafficSignals.nearbyGroceryStores} grocers ×900 + ${trafficSignals.nearbyFastFood} restaurants ×400 + ` +
    `${trafficSignals.nearbyShopping} shopping centers ×700 + ${trafficSignals.nearbySchools} schools ×300 = ` +
    `${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day (capped at 25,000). ` +
    `\n\nFINANCIAL MODEL (from 404.xlsx): Capture rate 2% of daily traffic × 26 days/month × $12.96 avg revenue/car. ` +
    `Year 1 revenue ${fmtUSD(fp.year1Revenue)}, EBITDA ${fmtUSD(fp.year1EBITDA)}, payback ${fp.paybackYears} years. ` +
    `\n\nVERDICT: ${verdict} — ` +
    (verdict === "INVEST"
      ? `Budget is sufficient and location fundamentals support investment.`
      : verdict === "PROCEED WITH CAUTION"
      ? `Either budget is marginal or location score is below ideal. Proceed with a detailed feasibility study.`
      : `Budget is insufficient for a viable car wash, or location fundamentals are too weak.`);

  // ── Recommendation ──────────────────────────────────────────────────────────
  let recommendation: string;
  if (verdict === "INVEST") {
    const topComplaint = reviewInsights.dominantComplaints[0]?.category ?? "service quality";
    recommendation =
      `Proceed with site acquisition and detailed engineering feasibility study. ` +
      `Differentiate on ${topComplaint.toLowerCase()} — the primary gap in this market. ` +
      `Launch with an express tunnel + unlimited membership plan to maximize revenue per car.`;
  } else if (verdict === "PROCEED WITH CAUTION") {
    recommendation = budgetMarginal
      ? `Explore raising additional equity or securing SBA/commercial financing to close the ${fmtUSD(budgetGap)} budget gap before committing. ` +
        `Alternatively, evaluate a smaller in-bay automatic format (~${fmtUSD(minRequired * 0.45)}) as a lower-risk entry point.`
      : `Commission a professional traffic study and competitor analysis before committing. ` +
        `Negotiate site control (option agreement) while conducting due diligence. ` +
        `Consider a phased opening starting with self-serve bays to validate demand.`;
  } else {
    recommendation = budgetFeasible
      ? `This location's traffic and market fundamentals do not support the investment at this time. ` +
        `Evaluate alternative sites with higher commercial density or weaker competition. ` +
        `Re-run the analysis with a different address.`
      : `Increase your investment budget to at least ${fmtUSD(minRequired)} before proceeding. ` +
        `At ${fmtUSD(budgetUSD)}, the car wash cannot be built to a standard that generates positive returns. ` +
        `Explore SBA 504 loans (10% down), equipment financing, or equity partnerships to bridge the gap.`;
  }

  // ── Decision summary ────────────────────────────────────────────────────────
  const decisionSummary =
    `This ${result.address} analysis scores ${score.overall}/100 with a ${score.verdict} verdict. ` +
    (budgetFeasible
      ? `Your budget of ${fmtUSD(budgetUSD)} is sufficient for ${country.name}.`
      : `However, your budget of ${fmtUSD(budgetUSD)} falls short of the ${fmtUSD(minRequired)} minimum required for ${country.name}.`) +
    ` ${verdict === "INVEST" ? "The location fundamentals support moving forward." : verdict === "PROCEED WITH CAUTION" ? "Proceed carefully with additional due diligence." : "This investment is not recommended at this time."}`;

  return {
    verdict,
    budgetFeasible,
    budgetUSD,
    minimumRequiredUSD: minRequired,
    budgetAnalysis,
    decisionSummary,
    keyFactors,
    redFlags,
    greenFlags,
    calculationBreakdown,
    recommendation,
    poweredBy: "rules",
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { result, budget, exchangeRate = 1 } = body as {
      result: SiteAnalysisResult;
      budget: number;
      exchangeRate?: number;
    };

    if (!result || !budget) {
      return NextResponse.json({ error: "result and budget are required" }, { status: 400 });
    }

    // Convert budget to USD using provided exchange rate
    const budgetUSD = budget / (exchangeRate || 1);

    // Rules-based engine always runs first
    const decision = rulesDecision(result, budgetUSD, exchangeRate);

    // ── AI enhancement (Claude or OpenAI) ──────────────────────────────────
    // When ANTHROPIC_API_KEY or OPENAI_API_KEY is set, Claude/GPT enriches
    // the decision with real-world market insight on top of the rules output.

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey    = process.env.OPENAI_API_KEY;

    if (anthropicKey) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey: anthropicKey });

        const aiPrompt = `You are a professional car wash investment analyst. Review this rule-based analysis and enrich it with real-world market insight. Return ONLY valid JSON with exactly these fields (no markdown fences):
{
  "decisionSummary": "string (2-3 sentences, specific to this location)",
  "recommendation": "string (concrete actionable next step)",
  "redFlags": ["string", ...],
  "greenFlags": ["string", ...]
}

ANALYSIS DATA:
Address: ${result.address}
Country: ${decision.budgetAnalysis.includes(result.countryCode) ? result.countryCode : ""}
Verdict: ${decision.verdict}
Budget: ${fmtUSD(budgetUSD)} USD | Minimum required: ${fmtUSD(decision.minimumRequiredUSD)}
Score: ${result.score.overall}/100 (${result.score.verdict})
Traffic: ${result.trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day
Competitors: ${result.competitors.length} within 5 miles, avg rating ${result.reviewInsights.avgCompetitorRating.toFixed(1)}
Year 1 Revenue: ${fmtUSD(result.financialProjection.year1Revenue)} | EBITDA: ${fmtUSD(result.financialProjection.year1EBITDA)}
Payback: ${result.financialProjection.paybackYears} years | IRR: ~${result.financialProjection.irr5Year}%
Existing red flags: ${decision.redFlags.join("; ")}
Existing green flags: ${decision.greenFlags.join("; ")}`;

        const aiRes = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          messages: [{ role: "user", content: aiPrompt }],
        });

        const raw = (aiRes.content[0] as { text: string }).text.trim()
          .replace(/^```json\s*/i, "").replace(/\s*```$/, "");
        const aiJson = JSON.parse(raw);

        if (aiJson.decisionSummary) decision.decisionSummary = aiJson.decisionSummary;
        if (aiJson.recommendation)  decision.recommendation  = aiJson.recommendation;
        if (Array.isArray(aiJson.redFlags) && aiJson.redFlags.length)   decision.redFlags   = aiJson.redFlags;
        if (Array.isArray(aiJson.greenFlags) && aiJson.greenFlags.length) decision.greenFlags = aiJson.greenFlags;
        decision.poweredBy = "claude";
      } catch {
        // Claude failed — rules output is already in decision, continue
      }
    } else if (openaiKey) {
      try {
        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o",
            max_tokens: 1200,
            response_format: { type: "json_object" },
            messages: [{
              role: "system",
              content:
                "You are a professional car wash investment analyst with 20 years of experience in real estate and retail business development. " +
                "You will be given data about a car wash investment opportunity and must return a JSON object with your analysis. " +
                "Be specific, realistic, and reference the actual location and numbers provided. " +
                "Return ONLY a valid JSON object — no markdown, no code fences, no extra text.",
            }, {
              role: "user",
              content:
                `Analyze this car wash investment opportunity and return your expert assessment as JSON.\n\n` +
                `LOCATION: ${result.address}\n` +
                `COUNTRY: ${result.countryCode}\n` +
                `INVESTMENT BUDGET: ${fmtUSD(budgetUSD)} USD\n` +
                `MINIMUM REQUIRED: ${fmtUSD(decision.minimumRequiredUSD)} USD\n` +
                `BUDGET STATUS: ${decision.budgetFeasible ? "SUFFICIENT" : "INSUFFICIENT"}\n\n` +
                `LOCATION SCORE: ${result.score.overall}/100 (${result.score.verdict})\n` +
                `- Traffic: ${result.score.components.traffic}/100\n` +
                `- Competition: ${result.score.components.competition}/100\n` +
                `- Opportunity: ${result.score.components.opportunity}/100\n` +
                `- Market Activity: ${result.score.components.market}/100\n` +
                `- Financial Viability: ${result.score.components.financial}/100\n\n` +
                `MARKET DATA:\n` +
                `- Competitors within 5 miles: ${result.competitors.length}\n` +
                `- Average competitor rating: ${result.reviewInsights.avgCompetitorRating}/5.0\n` +
                `- Market saturation: ${result.reviewInsights.marketSaturationLevel}\n` +
                `- Estimated daily traffic: ${result.trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day\n\n` +
                `FINANCIAL PROJECTIONS:\n` +
                `- Year 1 Revenue: ${fmtUSD(result.financialProjection.year1Revenue)}\n` +
                `- Year 1 EBITDA: ${fmtUSD(result.financialProjection.year1EBITDA)}\n` +
                `- Year 5 Revenue: ${fmtUSD(result.financialProjection.year5Revenue)}\n` +
                `- Payback period: ${result.financialProjection.paybackYears} years\n` +
                `- 5-Year IRR: ~${result.financialProjection.irr5Year}%\n\n` +
                `INITIAL VERDICT: ${decision.verdict}\n\n` +
                `Return this exact JSON structure:\n` +
                `{\n` +
                `  "decisionSummary": "2-3 sentences specific to this location and budget",\n` +
                `  "recommendation": "One concrete actionable next step for the investor",\n` +
                `  "redFlags": ["specific risk 1", "specific risk 2", ...],\n` +
                `  "greenFlags": ["specific positive 1", "specific positive 2", ...]\n` +
                `}`,
            }],
          }),
        });

        if (!oaiRes.ok) {
          const errBody = await oaiRes.text();
          console.error("OpenAI API error:", oaiRes.status, errBody);
        } else {
          const oaiJson = await oaiRes.json();
          const content = oaiJson.choices?.[0]?.message?.content;
          if (content) {
            // content is already a JSON string when response_format = json_object
            const aiJson = typeof content === "string" ? JSON.parse(content) : content;
            if (typeof aiJson.decisionSummary === "string" && aiJson.decisionSummary)
              decision.decisionSummary = aiJson.decisionSummary;
            if (typeof aiJson.recommendation === "string" && aiJson.recommendation)
              decision.recommendation = aiJson.recommendation;
            if (Array.isArray(aiJson.redFlags) && aiJson.redFlags.length)
              decision.redFlags = aiJson.redFlags;
            if (Array.isArray(aiJson.greenFlags) && aiJson.greenFlags.length)
              decision.greenFlags = aiJson.greenFlags;
            decision.poweredBy = "openai";
          }
        }
      } catch (oaiErr) {
        console.error("OpenAI call failed:", oaiErr);
        // Rules output stays — analysis is still complete
      }
    }

    return NextResponse.json(decision);
  } catch (err) {
    console.error("Decision error:", err);
    return NextResponse.json({ error: "Decision engine failed" }, { status: 500 });
  }
}
