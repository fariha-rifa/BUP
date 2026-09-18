import {
  BatterySpec,
  DirectiveInterpretation,
  DirectiveType,
  StructuredAdjustment,
} from '../src/types.ts';

const ALLOWED_DIRECTIVE_TYPES: Set<DirectiveType> = new Set([
  'solar_reduction',
  'minimum_battery_reserve',
  'no_charge_window',
  'no_discharge_window',
  'max_grid_window',
  'no_op',
]);

export interface GuardrailResult {
  valid: boolean;
  sanitizedInterpretations: DirectiveInterpretation[];
  errors: string[];
}

export function validateAndSanitizeDirectives(
  rawInterpretations: unknown[],
  operatorNotesCount: number,
  battery: BatterySpec
): GuardrailResult {
  const errors: string[] = [];
  const sanitized: DirectiveInterpretation[] = [];

  if (!Array.isArray(rawInterpretations)) {
    return {
      valid: false,
      sanitizedInterpretations: Array.from({ length: operatorNotesCount }, (_, i) => ({
        note_index: i,
        applies: false,
        directive_type: 'no_op',
        structured_adjustment: null,
        explanation: 'Defaulted to no_op due to invalid raw interpretation array.',
      })),
      errors: ['rawInterpretations is not an array'],
    };
  }

  // Check coverage
  const seenIndices = new Set<number>();

  for (let i = 0; i < operatorNotesCount; i++) {
    const raw = rawInterpretations.find(
      (entry) => typeof entry === 'object' && entry !== null && (entry as { note_index?: number }).note_index === i
    ) as Partial<DirectiveInterpretation> | undefined;

    if (!raw) {
      errors.push(`Missing interpretation for note_index ${i}`);
      sanitized.push({
        note_index: i,
        applies: false,
        directive_type: 'no_op',
        structured_adjustment: null,
        explanation: 'Defaulted to no_op because note interpretation was missing.',
      });
      continue;
    }

    seenIndices.add(i);

    let dType = raw.directive_type as DirectiveType;
    if (!ALLOWED_DIRECTIVE_TYPES.has(dType)) {
      errors.push(`Invalid directive_type "${dType}" at note_index ${i}; fallback to no_op`);
      dType = 'no_op';
    }

    let applies = Boolean(raw.applies);
    if (dType === 'no_op') {
      applies = false;
    } else {
      applies = true;
    }

    let adj: StructuredAdjustment = null;

    if (dType !== 'no_op' && raw.structured_adjustment) {
      const rawAdj = raw.structured_adjustment as unknown as Record<string, unknown>;

      // Validate hours
      let hoursArr: number[] = [];
      if (Array.isArray(rawAdj.hours)) {
        const uniqueSet = new Set<number>();
        for (const h of rawAdj.hours) {
          const num = Math.floor(Number(h));
          if (Number.isInteger(num) && num >= 0 && num <= 23) {
            uniqueSet.add(num);
          }
        }
        hoursArr = Array.from(uniqueSet).sort((a, b) => a - b);
      }

      if (hoursArr.length === 0) {
        errors.push(`Note ${i}: directive ${dType} has empty or invalid hours array`);
        // If hours are invalid, directive cannot apply
        dType = 'no_op';
        applies = false;
        adj = null;
      } else if (dType === 'solar_reduction') {
        let factor = Number(rawAdj.factor);
        if (isNaN(factor) || factor < 0 || factor > 1) {
          errors.push(`Note ${i}: solar_reduction factor ${rawAdj.factor} must be between 0 and 1`);
          factor = Math.min(1, Math.max(0, isNaN(factor) ? 1 : factor));
        }
        adj = { hours: hoursArr, factor };
      } else if (dType === 'minimum_battery_reserve') {
        let minEnergy = Number(rawAdj.minimum_energy_kwh);
        if (isNaN(minEnergy) || minEnergy < 0) {
          errors.push(`Note ${i}: invalid minimum_energy_kwh ${rawAdj.minimum_energy_kwh}`);
          minEnergy = battery.minimum_energy_kwh;
        }
        minEnergy = Math.min(minEnergy, battery.capacity_kwh);
        adj = { hours: hoursArr, minimum_energy_kwh: minEnergy };
      } else if (dType === 'max_grid_window') {
        let maxGrid = Number(rawAdj.max_grid_kwh);
        if (isNaN(maxGrid) || maxGrid < 0) {
          errors.push(`Note ${i}: invalid max_grid_kwh ${rawAdj.max_grid_kwh}`);
          maxGrid = 0;
        }
        adj = { hours: hoursArr, max_grid_kwh: maxGrid };
      } else if (dType === 'no_charge_window') {
        adj = { hours: hoursArr };
      } else if (dType === 'no_discharge_window') {
        adj = { hours: hoursArr };
      }
    } else {
      dType = 'no_op';
      applies = false;
      adj = null;
    }

    sanitized.push({
      note_index: i,
      applies,
      directive_type: dType,
      structured_adjustment: adj,
      explanation: typeof raw.explanation === 'string' && raw.explanation.trim()
        ? raw.explanation.trim()
        : dType === 'no_op'
        ? "This note does not affect today's energy schedule."
        : `Interpreted as ${dType}.`,
    });
  }

  // Ensure returned in ascending note_index order
  sanitized.sort((a, b) => a.note_index - b.note_index);

  return {
    valid: errors.length === 0,
    sanitizedInterpretations: sanitized,
    errors,
  };
}
