/**
 * Two-Phase Simplex Linear Programming Solver
 * Solves:
 *   Minimize c^T x
 *   subject to:
 *     A_ub * x <= b_ub
 *     A_eq * x == b_eq
 *     lb <= x <= ub
 */

export interface LPProblem {
  c: number[]; // Objective coefficients to minimize
  A_ub?: number[][]; // Inequality matrix: A_ub * x <= b_ub
  b_ub?: number[];
  A_eq?: number[][]; // Equality matrix: A_eq * x == b_eq
  b_eq?: number[];
  bounds: { lower: number; upper: number }[]; // Variable bounds
}

export interface LPSolution {
  status: 'optimal' | 'infeasible' | 'unbounded';
  x: number[];
  fun: number;
}

export function solveLP(problem: LPProblem): LPSolution {
  const n = problem.c.length;
  const A_ub = problem.A_ub || [];
  const b_ub = problem.b_ub || [];
  const A_eq = problem.A_eq || [];
  const b_eq = problem.b_eq || [];
  const bounds = problem.bounds;

  // Transform problem:
  // For variables with lower bound lb > 0: let x' = x - lb => x = x' + lb, with 0 <= x' <= ub - lb
  // For upper bounds: add constraint x' <= ub - lb
  const shift = bounds.map((b) => b.lower);
  const effectiveUpper = bounds.map((b) => b.upper - b.lower);

  // We convert to standard form:
  // minimize c'^T x'
  // subject to:
  //   A_all * x' (<= or ==) b_all
  //   x' >= 0
  const constr_A: number[][] = [];
  const constr_b: number[] = [];
  const constr_type: ('<=' | '>=' | '==')[] = [];

  // 1. Shifted inequality constraints A_ub * x <= b_ub => A_ub * x' <= b_ub - A_ub * shift
  for (let i = 0; i < A_ub.length; i++) {
    let offset = 0;
    const row = [...A_ub[i]];
    for (let j = 0; j < n; j++) {
      offset += row[j] * shift[j];
    }
    constr_A.push(row);
    constr_b.push(b_ub[i] - offset);
    constr_type.push('<=');
  }

  // 2. Upper bounds as <= constraints: x'_j <= effectiveUpper[j]
  for (let j = 0; j < n; j++) {
    if (Number.isFinite(effectiveUpper[j])) {
      const row = new Array(n).fill(0);
      row[j] = 1;
      constr_A.push(row);
      constr_b.push(effectiveUpper[j]);
      constr_type.push('<=');
    }
  }

  // 3. Shifted equality constraints A_eq * x == b_eq => A_eq * x' == b_eq - A_eq * shift
  for (let i = 0; i < A_eq.length; i++) {
    let offset = 0;
    const row = [...A_eq[i]];
    for (let j = 0; j < n; j++) {
      offset += row[j] * shift[j];
    }
    constr_A.push(row);
    constr_b.push(b_eq[i] - offset);
    constr_type.push('==');
  }

  const m = constr_A.length;
  // Ensure b >= 0 by multiplying row by -1 if b < 0 (for == only, for <= it changes direction to >=)
  // For <= with negative b, we convert to >= by multiplying by -1, but let's standardize:
  const normalized_A: number[][] = [];
  const normalized_b: number[] = [];
  const normalized_type: ('<=' | '>=' | '==')[] = [];

  for (let i = 0; i < m; i++) {
    let row = [...constr_A[i]];
    let bi = constr_b[i];
    let type = constr_type[i];

    if (bi < -1e-9) {
      row = row.map((v) => -v);
      bi = -bi;
      type = type === '<=' ? '>=' : '==';
    }
    normalized_A.push(row);
    normalized_b.push(Math.abs(bi) < 1e-12 ? 0 : bi);
    normalized_type.push(type);
  }

  // Now build tableau for 2-phase simplex
  // Variables:
  // x'_1 .. x'_n
  // slacks for <= (s_i >= 0, +1)
  // surplus for >= (s_i >= 0, -1)
  // artificial for >= and == (a_i >= 0, +1)

  let slackCount = 0;
  let artificialCount = 0;
  for (let i = 0; i < m; i++) {
    if (normalized_type[i] === '<=') {
      slackCount++;
    } else if (normalized_type[i] === '>=') {
      slackCount++; // surplus
      artificialCount++;
    } else if (normalized_type[i] === '==') {
      artificialCount++;
    }
  }

  const totalVars = n + slackCount + artificialCount;
  // Tableau layout:
  // rows: m rows (0..m-1) + Phase 1 obj row (m) + Phase 2 obj row (m+1)
  // cols: totalVars + RHS col (totalVars)
  const tableau: number[][] = Array.from({ length: m + 2 }, () =>
    new Array(totalVars + 1).fill(0)
  );

  let currentSlack = 0;
  let currentArt = 0;
  const basis: number[] = new Array(m).fill(-1);

  for (let i = 0; i < m; i++) {
    // Copy original vars
    for (let j = 0; j < n; j++) {
      tableau[i][j] = normalized_A[i][j];
    }
    tableau[i][totalVars] = normalized_b[i];

    if (normalized_type[i] === '<=') {
      const sIdx = n + currentSlack;
      tableau[i][sIdx] = 1;
      basis[i] = sIdx;
      currentSlack++;
    } else if (normalized_type[i] === '>=') {
      const sIdx = n + currentSlack;
      tableau[i][sIdx] = -1; // surplus
      currentSlack++;

      const aIdx = n + slackCount + currentArt;
      tableau[i][aIdx] = 1;
      basis[i] = aIdx;
      currentArt++;
    } else if (normalized_type[i] === '==') {
      const aIdx = n + slackCount + currentArt;
      tableau[i][aIdx] = 1;
      basis[i] = aIdx;
      currentArt++;
    }
  }

  // Phase 2 objective in row m+1:
  // minimize sum c_j * x'_j => row m+1 has c_j
  for (let j = 0; j < n; j++) {
    tableau[m + 1][j] = problem.c[j];
  }

  const EPS = 1e-9;

  // Phase 1 (if artificials exist)
  if (artificialCount > 0) {
    // Phase 1 objective: minimize sum of artificial variables
    // w = sum a_i => w - sum a_i = 0
    // In canonical form with basis, subtract all rows with artificial basic variables:
    for (let i = 0; i < m; i++) {
      if (basis[i] >= n + slackCount) {
        for (let j = 0; j <= totalVars; j++) {
          tableau[m][j] -= tableau[i][j];
        }
      }
    }

    // Run simplex on tableau row m
    simplexPivot(tableau, basis, m, totalVars, m);

    // Check Phase 1 optimal value (tableau[m][totalVars])
    // The objective is to drive this to 0. Since tableau stores -w in RHS, RHS should be 0.
    if (Math.abs(tableau[m][totalVars]) > 1e-4) {
      return { status: 'infeasible', x: [], fun: Infinity };
    }

    // Drive artificial variables out of the basis if any remain with 0 RHS
    for (let i = 0; i < m; i++) {
      if (basis[i] >= n + slackCount) {
        let pivotCol = -1;
        for (let j = 0; j < n + slackCount; j++) {
          if (Math.abs(tableau[i][j]) > EPS) {
            pivotCol = j;
            break;
          }
        }
        if (pivotCol !== -1) {
          pivot(tableau, basis, m, totalVars, i, pivotCol);
        }
      }
    }
  }

  // Prepare Phase 2:
  // Canonicalize Phase 2 objective row (m+1) with respect to current basis
  for (let i = 0; i < m; i++) {
    const basicVar = basis[i];
    const coef = tableau[m + 1][basicVar];
    if (Math.abs(coef) > EPS) {
      for (let j = 0; j <= totalVars; j++) {
        tableau[m + 1][j] -= coef * tableau[i][j];
      }
    }
  }

  // Run Phase 2 simplex on row m+1, ignoring artificial columns
  simplexPivot(tableau, basis, m, n + slackCount, m + 1);

  // Extract solution x'
  const xPrime = new Array(n).fill(0);
  for (let i = 0; i < m; i++) {
    if (basis[i] < n) {
      xPrime[basis[i]] = Math.max(0, tableau[i][totalVars]);
    }
  }

  // Shift back to x = x' + shift
  const x = xPrime.map((xp, j) => xp + shift[j]);

  let totalObj = 0;
  for (let j = 0; j < n; j++) {
    totalObj += problem.c[j] * x[j];
  }

  return {
    status: 'optimal',
    x,
    fun: totalObj,
  };
}

function simplexPivot(
  tableau: number[][],
  basis: number[],
  m: number,
  numCols: number,
  objRow: number
) {
  const EPS = 1e-9;
  const MAX_ITER = 3000;
  let iter = 0;

  while (iter++ < MAX_ITER) {
    // Find entering column: min reduced cost < -EPS
    let enteringCol = -1;
    let minReducedCost = -EPS;

    // Bland's rule / steepest edge:
    for (let j = 0; j < numCols; j++) {
      if (tableau[objRow][j] < minReducedCost) {
        minReducedCost = tableau[objRow][j];
        enteringCol = j;
      }
    }

    if (enteringCol === -1) {
      // Optimal!
      break;
    }

    // Find leaving row via min ratio test
    let leavingRow = -1;
    let minRatio = Infinity;

    for (let i = 0; i < m; i++) {
      const a_ij = tableau[i][enteringCol];
      if (a_ij > EPS) {
        const ratio = Math.max(0, tableau[i][tableau[0].length - 1]) / a_ij;
        if (ratio < minRatio - EPS) {
          minRatio = ratio;
          leavingRow = i;
        } else if (Math.abs(ratio - minRatio) <= EPS) {
          // Bland's rule: prefer smaller basic index
          if (leavingRow === -1 || basis[i] < basis[leavingRow]) {
            leavingRow = i;
          }
        }
      }
    }

    if (leavingRow === -1) {
      // Unbounded
      break;
    }

    pivot(tableau, basis, m, tableau[0].length - 1, leavingRow, enteringCol);
  }
}

function pivot(
  tableau: number[][],
  basis: number[],
  m: number,
  totalCols: number,
  pivotRow: number,
  pivotCol: number
) {
  const pivotVal = tableau[pivotRow][pivotCol];
  basis[pivotRow] = pivotCol;

  for (let j = 0; j <= totalCols; j++) {
    tableau[pivotRow][j] /= pivotVal;
  }

  const numRows = tableau.length;
  for (let i = 0; i < numRows; i++) {
    if (i !== pivotRow) {
      const factor = tableau[i][pivotCol];
      if (Math.abs(factor) > 1e-12) {
        for (let j = 0; j <= totalCols; j++) {
          tableau[i][j] -= factor * tableau[pivotRow][j];
        }
      }
    }
  }
}
