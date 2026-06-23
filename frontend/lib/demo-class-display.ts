import {
  CLASS_COLORS,
  CLASS_DISPLAY_LABELS,
  CLASS_GRADES,
  CLASS_LABELS,
} from "@/lib/types";

export const DEMO_CLASS_COLORS: Record<string, string> = {
  demo_grade_a: "#22c55e",
  demo_grade_b: "#16a34a",
  demo_grade_c: "#f59e0b",
  demo_grade_d: "#ef4444",
};

export const DEMO_CLASS_LABELS: Record<string, string> = {
  demo_grade_a: "Loai A",
  demo_grade_b: "Loai B",
  demo_grade_c: "Loai C",
  demo_grade_d: "Loai D",
};

export const DEMO_CLASS_GRADES: Record<string, string> = {
  demo_grade_a: "A",
  demo_grade_b: "B",
  demo_grade_c: "C",
  demo_grade_d: "D",
};

export function classColor(className: string) {
  return DEMO_CLASS_COLORS[className] || CLASS_COLORS[className] || "#ffffff";
}

export function classLabel(className: string) {
  return DEMO_CLASS_LABELS[className] || CLASS_LABELS[className] || className;
}

export function classGrade(className: string) {
  return DEMO_CLASS_GRADES[className] || CLASS_GRADES[className] || className;
}

export function classDisplayLabel(className: string) {
  return DEMO_CLASS_LABELS[className] || CLASS_DISPLAY_LABELS[className] || classLabel(className);
}
