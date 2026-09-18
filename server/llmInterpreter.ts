import { GoogleGenAI, Type } from '@google/genai';
import { BatterySpec, DirectiveInterpretation, HourInput } from '../src/types.ts';
import { validateAndSanitizeDirectives } from './guardrails.ts';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

/**
 * Parses time strings like "1 PM", "noon", "midnight", "2 AM", "13:00", "3 PM" to 0..23 integer
 */
function parseTimeHour(timeStr: string): number | null {
  const s = timeStr.trim().toLowerCase();
  if (s === 'noon' || s === '12 noon' || s === '12 pm') return 12;
  if (s === 'midnight' || s === '12 am' || s === '0:00' || s === '00:00') return 0;

  const match24 = s.match(/^(\d{1,2})(?::00)?$/);
  if (match24) {
    const val = parseInt(match24[1], 10);
    if (val >= 0 && val <= 23) return val;
  }

  const match12 = s.match(/^(\d{1,2})(?::00)?\s*(am|pm)$/);
  if (match12) {
    let val = parseInt(match12[1], 10);
    const meridiem = match12[2];
    if (meridiem === 'pm' && val < 12) val += 12;
    if (meridiem === 'am' && val === 12) val = 0;
    return val;
  }

  const wordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
  };
  const wordMatch = s.match(/^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(am|pm)?$/);
  if (wordMatch) {
    let val = wordMap[wordMatch[1]];
    const meridiem = wordMatch[2];
    if (meridiem === 'pm' && val < 12) val += 12;
    if (meridiem === 'am' && val === 12) val = 0;
    return val;
  }

  return null;
}

/**
 * Extracts a whole-hour interval [start, end) where start is included and end is excluded.
 */
function extractHourWindow(text: string): number[] {
  // Try pattern: "from X until Y", "between X and Y", "from X to Y", "X-Y PM"
  const regexList = [
    /(?:from|between)\s+([0-9a-zA-Z:]+(?:\s*(?:am|pm))?)\s+(?:until|to|and)\s+([0-9a-zA-Z:]+(?:\s*(?:am|pm))?)/i,
    /([0-9]{1,2})\s*-\s*([0-9]{1,2})\s*(am|pm)/i,
    /([0-9]{1,2}):00\s*(?:and|to|until)\s*([0-9]{1,2}):00/i,
  ];

  for (const regex of regexList) {
    const m = text.match(regex);
    if (m) {
      if (regex === regexList[1]) {
        let start = parseInt(m[1], 10);
        let end = parseInt(m[2], 10);
        const meridiem = m[3].toLowerCase();
        if (meridiem === 'pm') {
          if (start < 12) start += 12;
          if (end < 12) end += 12;
        }
        if (start < end && start >= 0 && end <= 24) {
          const hours: number[] = [];
          for (let h = start; h < end; h++) hours.push(h);
          return hours;
        }
      } else {
        let startStr = m[1].trim();
        let endStr = m[2].trim();

        // If end has am/pm but start doesn't, infer am/pm for start (unless start is noon or midnight)
        const endMeridiemMatch = endStr.match(/(am|pm)$/i);
        if (
          endMeridiemMatch &&
          !startStr.match(/(am|pm)$/i) &&
          !startStr.toLowerCase().includes('noon') &&
          !startStr.toLowerCase().includes('midnight')
        ) {
          startStr = `${startStr} ${endMeridiemMatch[1]}`;
        }

        let start = parseTimeHour(startStr);
        let end = parseTimeHour(endStr);

        // Special case: e.g. "from one until three" in afternoon
        if (start !== null && end !== null) {
          if (start < 6 && text.toLowerCase().includes('noon') || text.toLowerCase().includes('afternoon')) {
            start += 12;
            end += 12;
          }
          if (start < end) {
            const hours: number[] = [];
            for (let h = start; h < end; h++) hours.push(h);
            return hours;
          }
        }
      }
    }
  }

  return [];
}

/**
 * Fallback semantic interpreter when LLM API is unavailable or returns an error.
 */
export function fallbackSemanticInterpret(
  notes: string[],
  battery: BatterySpec
): DirectiveInterpretation[] {
  return notes.map((note, index) => {
    const text = note.toLowerCase();

    // Distractor detection (cafeteria, library, sports, seminar, club, etc.)
    const isExplicitDistractor =
      text.includes('cafeteria') ||
      text.includes('sports office') ||
      text.includes('registration deadline') ||
      text.includes('book-return') ||
      text.includes('library') ||
      text.includes('club notices') ||
      text.includes('student affairs') ||
      text.includes('seminar room') ||
      text.includes('menu changes') ||
      text.includes('booking was moved') ||
      text.includes('classes') ||
      text.includes('exam');

    const hasEnergyTerms =
      text.includes('solar') ||
      text.includes('pv') ||
      text.includes('rooftop') ||
      text.includes('battery') ||
      text.includes('charger') ||
      text.includes('charging') ||
      text.includes('discharge') ||
      text.includes('grid') ||
      text.includes('feeder') ||
      text.includes('transformer') ||
      text.includes('substation');

    if (isExplicitDistractor || !hasEnergyTerms) {
      return {
        note_index: index,
        applies: false,
        directive_type: 'no_op',
        structured_adjustment: null,
        explanation: "This note does not affect today's 24-hour energy schedule.",
      };
    }

    const hours = extractHourWindow(note);

    // 1. Solar reduction
    if (text.includes('solar') || text.includes('pv production') || text.includes('rooftop')) {
      let factor = 1.0;
      // Check e.g. "80% reduction" => factor = 0.2
      const redMatch = text.match(/([0-9]{1,3})%\s+reduction/i);
      if (redMatch) {
        const pct = parseFloat(redMatch[1]);
        factor = Math.round((1 - pct / 100) * 100) / 100;
      } else {
        // Check "to about 20%" or "to roughly 25%" or "treated as roughly 25%" or "25%"
        const toMatch = text.match(/(?:to|leave|treated as|is|equals?|at)(?:\s+about|\s+roughly)?\s+([0-9]{1,3})%/i);
        if (toMatch) {
          factor = parseFloat(toMatch[1]) / 100;
        } else if (text.includes('half') || text.includes('one-half')) {
          factor = 0.5;
        } else if (text.includes('one-fifth')) {
          factor = 0.2;
        } else if (text.includes('one-fourth') || text.includes('quarter')) {
          factor = 0.25;
        } else {
          const directPct = text.match(/([0-9]{1,3})%/);
          if (directPct) {
            factor = parseFloat(directPct[1]) / 100;
          }
        }
      }

      return {
        note_index: index,
        applies: true,
        directive_type: 'solar_reduction',
        structured_adjustment: {
          hours,
          factor,
        },
        explanation: `Solar availability is reduced to ${(factor * 100).toFixed(0)}% during the stated hours.`,
      };
    }

    // 2. Minimum battery reserve
    if (
      (text.includes('reserve') || text.includes('in the battery') || text.includes('stored in the battery') || text.includes('remain in the battery')) &&
      (text.includes('least') || text.includes('keep') || text.includes('minimum') || text.includes('require'))
    ) {
      let minKwh = battery.minimum_energy_kwh;
      const kwhMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*kwh/i);
      if (kwhMatch) {
        minKwh = parseFloat(kwhMatch[1]);
      } else {
        const pctMatch = text.match(/([0-9]{1,3})%\s*(?:of\s+(?:the\s+)?battery\s+capacity)?/i);
        if (pctMatch) {
          const pct = parseFloat(pctMatch[1]);
          minKwh = (pct / 100) * battery.capacity_kwh;
        }
      }

      return {
        note_index: index,
        applies: true,
        directive_type: 'minimum_battery_reserve',
        structured_adjustment: {
          hours,
          minimum_energy_kwh: minKwh,
        },
        explanation: `At least ${minKwh} kWh must remain in the battery during the reserve window.`,
      };
    }

    // 3. No charge window
    if (
      (text.includes('charger') || text.includes('charging') || text.includes('charge')) &&
      (text.includes('isolated') ||
        text.includes('unavailable') ||
        text.includes('disabled') ||
        text.includes('do not charge') ||
        text.includes('outage') ||
        text.includes('cannot charge'))
    ) {
      return {
        note_index: index,
        applies: true,
        directive_type: 'no_charge_window',
        structured_adjustment: {
          hours,
        },
        explanation: 'Battery charging is disabled during the stated maintenance/inspection window.',
      };
    }

    // 4. No discharge window
    if (
      text.includes('discharge') &&
      (text.includes('must not discharge') ||
        text.includes('do not discharge') ||
        text.includes('cannot discharge') ||
        text.includes('disabled') ||
        text.includes('unavailable'))
    ) {
      return {
        note_index: index,
        applies: true,
        directive_type: 'no_discharge_window',
        structured_adjustment: {
          hours,
        },
        explanation: 'Battery discharge is disabled during the stated window.',
      };
    }

    // 5. Max grid window
    if (
      text.includes('grid') ||
      text.includes('feeder') ||
      text.includes('transformer') ||
      text.includes('substation')
    ) {
      let maxGrid = 0;
      const kwhMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*kwh/i);
      if (kwhMatch) {
        maxGrid = parseFloat(kwhMatch[1]);
      }

      return {
        note_index: index,
        applies: true,
        directive_type: 'max_grid_window',
        structured_adjustment: {
          hours,
          max_grid_kwh: maxGrid,
        },
        explanation: `Grid import is capped at ${maxGrid} kWh during the grid constraint window.`,
      };
    }

    return {
      note_index: index,
      applies: false,
      directive_type: 'no_op',
      structured_adjustment: null,
      explanation: "This note does not affect today's 24-hour energy schedule.",
    };
  });
}

/**
 * Interpret operator notes using Gemini LLM with deterministic guardrail verification and fallback.
 */
export async function interpretOperatorNotes(
  notes: string[],
  battery: BatterySpec,
  hours: HourInput[]
): Promise<{ interpretations: DirectiveInterpretation[]; method: 'llm' | 'fallback'; rawResponse?: string }> {
  if (notes.length === 0) {
    return {
      interpretations: [],
      method: 'llm',
    };
  }

  const client = getAIClient();

  if (client) {
    // List of reliable flash models in preference order
    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];

    for (const modelName of candidateModels) {
      try {
        const prompt = `You are the GridWise Campus Energy Operator Directive Interpreter.
You must interpret ${notes.length} natural language notes from campus operators for a 24-hour schedule (hours 0 to 23).
Battery parameters: capacity_kwh=${battery.capacity_kwh}, minimum_energy_kwh=${battery.minimum_energy_kwh}.

Supported Directive Types:
1. "solar_reduction":
   - Required structured_adjustment: {"hours": [...], "factor": number}
   - IMPORTANT: factor is the USABLE FRACTION REMAINING between 0.0 and 1.0. Example: an 80% reduction means factor = 0.20! "drop to about 20%" means factor = 0.20. "leave about half" means factor = 0.50.
2. "minimum_battery_reserve":
   - Required structured_adjustment: {"hours": [...], "minimum_energy_kwh": number}
   - If stated as a percentage like "50% of capacity", convert to kWh: 0.50 * ${battery.capacity_kwh} = ${(0.5 * battery.capacity_kwh)}.
3. "no_charge_window":
   - Required structured_adjustment: {"hours": [...]}
   - Battery charging is unavailable / prohibited during these hours.
4. "no_discharge_window":
   - Required structured_adjustment: {"hours": [...]}
   - Battery discharging is unavailable / prohibited during these hours.
5. "max_grid_window":
   - Required structured_adjustment: {"hours": [...], "max_grid_kwh": number}
   - Grid import may not exceed stated amount during specific hours.
6. "no_op":
   - For notes that do not affect the 24-hour schedule (e.g. cafeteria menu, library hours, sports registration, seminars, general campus news).
   - Must have: applies = false, directive_type = "no_op", structured_adjustment = null.

TIME CONVENTION:
- Whole-hour intervals [start, end) where start hour is INCLUDED and end hour is EXCLUDED.
- "1 PM to 3 PM" -> hours [13, 14]
- "noon until 2 PM" -> hours [12, 13]
- "2 AM until 5 AM" -> hours [2, 3, 4]
- "6 PM until 9 PM" -> hours [18, 19, 20]
- "6 PM until 8 PM" -> hours [18, 19]
- "6 PM until 10 PM" -> hours [18, 19, 20, 21]
- "7 PM until 9 PM" -> hours [19, 20]
- "7 PM until 10 PM" -> hours [19, 20, 21]
- "10 AM until noon" -> hours [10, 11]
- "11 AM until 1 PM" -> hours [11, 12]
- "11 AM and 2 PM" -> hours [11, 12, 13]
- "2 PM until 4 PM" -> hours [14, 15]
- "5 PM until 7 PM" -> hours [17, 18]
- Hours must be unique integers 0..23 in ascending order!

RULES:
- Return exactly one entry for each operator note, in note_index order (0 to ${notes.length - 1}).
- applies must be true for all non-no_op directives, and false only for no_op.

Operator Notes:
${notes.map((n, i) => `[Note ${i}]: "${n}"`).join('\n')}

Output JSON array of objects with: note_index, applies, directive_type, structured_adjustment, explanation.`;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM call timed out after 12000ms')), 12000)
        );

        const generatePromise = client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);

        const text = response.text || '';
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          // clean possible markdown code fences
          const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleaned);
        }

        if (Array.isArray(parsed)) {
          const guardrail = validateAndSanitizeDirectives(parsed, notes.length, battery);
          if (guardrail.valid || guardrail.sanitizedInterpretations.length === notes.length) {
            return {
              interpretations: guardrail.sanitizedInterpretations,
              method: 'llm',
              rawResponse: text,
            };
          }
        }
      } catch (err: unknown) {
        // Continue to next candidate model or fallback
      }
    }
  }

  // Deterministic fallback path
  const fallback = fallbackSemanticInterpret(notes, battery);
  const guardrail = validateAndSanitizeDirectives(fallback, notes.length, battery);
  return {
    interpretations: guardrail.sanitizedInterpretations,
    method: 'fallback',
  };
}
