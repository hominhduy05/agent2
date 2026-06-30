export type Grade = 'A' | 'B' | 'C' | 'D' | null;

export const GRADE_RULES = {
  A: 3,

  B: 2,

  C: 1,

  D: 0,
};

export function getGrade(item: any): 'A' | 'B' | 'C' | 'D' {
  const finalGrade = String(item?.final_grade ?? '').toLowerCase();

  if (finalGrade) {
    if (finalGrade.includes('grade_a')) return 'A';

    if (finalGrade.includes('grade_b')) return 'B';

    if (finalGrade.includes('grade_c')) return 'C';

    if (finalGrade.includes('grade_d')) return 'D';
  }

  const className = String(item?.class_name ?? '').toLowerCase();

  if (className) {
    if (
      className.includes('ripe') ||
      className.includes('mature') ||
      className.includes('demo_grade_a')
    )
      return 'A';

    if (className.includes('semi') || className.includes('demo_grade_b'))
      return 'B';

    if (className.includes('green') || className.includes('demo_grade_c'))
      return 'C';
  }

  const weight = Number(item?.weight_kg ?? 0);

  if (weight >= GRADE_RULES.A) return 'A';

  if (weight >= GRADE_RULES.B) return 'B';

  if (weight >= GRADE_RULES.C) return 'C';

  return 'D';
}

export function calculateFinalGrade(grades: Grade[]): Grade {
  const valid = grades.filter((g): g is Exclude<Grade, null> => g !== null);

  if (valid.length === 0) return null;

  if (valid.includes('D')) return 'D';

  const count: Record<'A' | 'B' | 'C', number> = {
    A: 0,

    B: 0,

    C: 0,
  };

  valid.forEach((g) => {
    if (g !== 'D') count[g]++;
  });

  const majorityThreshold = Math.floor(valid.length / 2) + 1;
  const majority = (['A', 'B', 'C'] as const).find(
    (grade) => count[grade] >= majorityThreshold
  );
  if (majority) return majority;

  return (['C', 'B', 'A'] as const).find((grade) => count[grade] > 0) ?? null;
}
