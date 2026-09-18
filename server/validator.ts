import {
  BatterySpec,
  DirectiveInterpretation,
  HourlyPlanEntry,
  HourInput,
  MaxGridWindowAdjustment,
  MinimumBatteryReserveAdjustment,
  NoChargeWindowAdjustment,
  NoDischargeWindowAdjustment,
  ReplayVerificationResult,
  SolarReductionAdjustment,
} from '../src/types.ts';

const TOLERANCE = 0.01;

export function verifyPlan(
  hours: HourInput[],
  battery: BatterySpec,
  directives: DirectiveInterpretation[],
  hourlyPlan: HourlyPlanEntry[],
  reportedTotalGridKwh?: number,
  reportedTotalCostBdt?: number,
  reportedPeakGridKwh?: number
): ReplayVerificationResult {
  const violations: string[] = [];
  let energyBalanceValid = true;
  let batteryBoundsValid = true;
  let rateLimitsValid = true;
  let solarUsageValid = true;
  let neutralityValid = true;
  let directivesValid = true;

  if (hourlyPlan.length !== 24) {
    violations.push(`hourly_plan must contain exactly 24 hours, received ${hourlyPlan.length}`);
  }

  // Calculate effective solar
  const effectiveSolar = hours.map((h) => h.solar_kwh);
  const activeMinReserve = new Array(24).fill(battery.minimum_energy_kwh);
  const noChargeHours = new Set<number>();
  const noDischargeHours = new Set<number>();
  const maxGridMap = new Map<number, number>();

  for (const d of directives) {
    if (d.applies && d.structured_adjustment) {
      if (d.directive_type === 'solar_reduction') {
        const adj = d.structured_adjustment as SolarReductionAdjustment;
        for (const h of adj.hours) {
          if (h >= 0 && h < 24) {
            effectiveSolar[h] = effectiveSolar[h] * adj.factor;
          }
        }
      } else if (d.directive_type === 'minimum_battery_reserve') {
        const adj = d.structured_adjustment as MinimumBatteryReserveAdjustment;
        for (const h of adj.hours) {
          if (h >= 0 && h < 24) {
            activeMinReserve[h] = Math.max(activeMinReserve[h], adj.minimum_energy_kwh);
          }
        }
      } else if (d.directive_type === 'no_charge_window') {
        const adj = d.structured_adjustment as NoChargeWindowAdjustment;
        for (const h of adj.hours) {
          noChargeHours.add(h);
        }
      } else if (d.directive_type === 'no_discharge_window') {
        const adj = d.structured_adjustment as NoDischargeWindowAdjustment;
        for (const h of adj.hours) {
          noDischargeHours.add(h);
        }
      } else if (d.directive_type === 'max_grid_window') {
        const adj = d.structured_adjustment as MaxGridWindowAdjustment;
        for (const h of adj.hours) {
          const prev = maxGridMap.get(h) ?? Infinity;
          maxGridMap.set(h, Math.min(prev, adj.max_grid_kwh));
        }
      }
    }
  }

  let prevEnergy = battery.initial_energy_kwh;
  let recalculatedTotalGridKwh = 0;
  let recalculatedTotalCostBdt = 0;
  let recalculatedPeakGridKwh = 0;

  for (let i = 0; i < hourlyPlan.length; i++) {
    const p = hourlyPlan[i];
    const h = p.hour;
    const input = hours[h];

    if (h !== i) {
      violations.push(`Hour out of order: index ${i} has hour ${h}`);
    }

    recalculatedTotalGridKwh += p.grid_kwh;
    recalculatedTotalCostBdt += p.grid_kwh * input.tariff_bdt_per_kwh;
    if (p.grid_kwh > recalculatedPeakGridKwh) {
      recalculatedPeakGridKwh = p.grid_kwh;
    }

    // Solar usage check
    if (p.solar_used_kwh < -TOLERANCE || p.solar_used_kwh > effectiveSolar[h] + TOLERANCE) {
      solarUsageValid = false;
      violations.push(
        `Hour ${h}: solar_used_kwh (${p.solar_used_kwh}) exceeds effective solar (${effectiveSolar[h]})`
      );
    }

    // Battery action and rate limits
    const chg = p.battery_action === 'charge' ? p.battery_kwh : 0;
    const dis = p.battery_action === 'discharge' ? p.battery_kwh : 0;

    if (p.battery_action === 'idle' && p.battery_kwh !== 0) {
      rateLimitsValid = false;
      violations.push(`Hour ${h}: idle action must have battery_kwh = 0, got ${p.battery_kwh}`);
    }

    if (chg > battery.max_charge_kwh_per_hour + TOLERANCE) {
      rateLimitsValid = false;
      violations.push(
        `Hour ${h}: charge amount ${chg} exceeds max charge limit ${battery.max_charge_kwh_per_hour}`
      );
    }
    if (dis > battery.max_discharge_kwh_per_hour + TOLERANCE) {
      rateLimitsValid = false;
      violations.push(
        `Hour ${h}: discharge amount ${dis} exceeds max discharge limit ${battery.max_discharge_kwh_per_hour}`
      );
    }

    // Directives checks
    if (noChargeHours.has(h) && chg > TOLERANCE) {
      directivesValid = false;
      violations.push(`Hour ${h}: charged ${chg} kWh during no_charge_window`);
    }
    if (noDischargeHours.has(h) && dis > TOLERANCE) {
      directivesValid = false;
      violations.push(`Hour ${h}: discharged ${dis} kWh during no_discharge_window`);
    }
    const gridCap = maxGridMap.get(h);
    if (gridCap !== undefined && p.grid_kwh > gridCap + TOLERANCE) {
      directivesValid = false;
      violations.push(
        `Hour ${h}: grid import ${p.grid_kwh} exceeds max_grid_window cap ${gridCap}`
      );
    }

    // Battery state transition
    let expectedEnergy = prevEnergy;
    if (p.battery_action === 'charge') expectedEnergy += p.battery_kwh;
    if (p.battery_action === 'discharge') expectedEnergy -= p.battery_kwh;

    if (Math.abs(p.battery_energy_after_kwh - expectedEnergy) > TOLERANCE) {
      batteryBoundsValid = false;
      violations.push(
        `Hour ${h}: battery_energy_after_kwh (${p.battery_energy_after_kwh}) does not match transition (${expectedEnergy})`
      );
    }

    // Battery bounds
    const minReserve = activeMinReserve[h];
    if (p.battery_energy_after_kwh < minReserve - TOLERANCE) {
      batteryBoundsValid = false;
      directivesValid = false;
      violations.push(
        `Hour ${h}: battery energy ${p.battery_energy_after_kwh} below reserve ${minReserve}`
      );
    }
    if (p.battery_energy_after_kwh > battery.capacity_kwh + TOLERANCE) {
      batteryBoundsValid = false;
      violations.push(
        `Hour ${h}: battery energy ${p.battery_energy_after_kwh} exceeds capacity ${battery.capacity_kwh}`
      );
    }

    // Energy balance: grid_kwh + solar_used_kwh + battery_discharge_kwh = demand_kwh + battery_charge_kwh
    const leftSide = p.grid_kwh + p.solar_used_kwh + dis;
    const rightSide = input.demand_kwh + chg;
    if (Math.abs(leftSide - rightSide) > TOLERANCE) {
      energyBalanceValid = false;
      violations.push(
        `Hour ${h}: energy balance failed (supply: ${leftSide.toFixed(2)} vs demand: ${rightSide.toFixed(2)})`
      );
    }

    prevEnergy = p.battery_energy_after_kwh;
  }

  // End-of-day neutrality check
  if (hourlyPlan.length === 24) {
    const finalEnergy = hourlyPlan[23].battery_energy_after_kwh;
    if (Math.abs(finalEnergy - battery.initial_energy_kwh) > TOLERANCE) {
      neutralityValid = false;
      violations.push(
        `End-of-day neutrality failed: final energy ${finalEnergy} != initial ${battery.initial_energy_kwh}`
      );
    }
  }

  recalculatedTotalGridKwh = Math.round(recalculatedTotalGridKwh * 100) / 100;
  recalculatedTotalCostBdt = Math.round(recalculatedTotalCostBdt * 100) / 100;
  recalculatedPeakGridKwh = Math.round(recalculatedPeakGridKwh * 100) / 100;

  if (reportedTotalGridKwh !== undefined) {
    if (Math.abs(reportedTotalGridKwh - recalculatedTotalGridKwh) > TOLERANCE) {
      violations.push(
        `Reported total_grid_kwh (${reportedTotalGridKwh}) != recalculated (${recalculatedTotalGridKwh})`
      );
    }
  }
  if (reportedTotalCostBdt !== undefined) {
    if (Math.abs(reportedTotalCostBdt - recalculatedTotalCostBdt) > TOLERANCE) {
      violations.push(
        `Reported total_cost_bdt (${reportedTotalCostBdt}) != recalculated (${recalculatedTotalCostBdt})`
      );
    }
  }
  if (reportedPeakGridKwh !== undefined) {
    if (Math.abs(reportedPeakGridKwh - recalculatedPeakGridKwh) > TOLERANCE) {
      violations.push(
        `Reported peak_grid_kwh (${reportedPeakGridKwh}) != recalculated (${recalculatedPeakGridKwh})`
      );
    }
  }

  const valid =
    violations.length === 0 &&
    energyBalanceValid &&
    batteryBoundsValid &&
    rateLimitsValid &&
    solarUsageValid &&
    neutralityValid &&
    directivesValid;

  return {
    valid,
    energyBalanceValid,
    batteryBoundsValid,
    rateLimitsValid,
    solarUsageValid,
    neutralityValid,
    directivesValid,
    recalculatedTotalGridKwh,
    recalculatedTotalCostBdt,
    recalculatedPeakGridKwh,
    violations,
  };
}
