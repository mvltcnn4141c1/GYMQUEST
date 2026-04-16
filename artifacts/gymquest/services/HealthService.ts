export type HealthSource = "apple" | "google" | "simulated" | "none";

export type HealthCheckResult = {
  status: "verified" | "no_movement" | "permission_denied" | "unavailable" | "simulated";
  hasMovement: boolean;
  source: HealthSource;
  title: string;
  detail: string;
  stepsInWindow: number;
};

export async function requestHealthPermissions(): Promise<boolean> {
  return false;
}

export function getSourceLabel(source: HealthSource): string {
  switch (source) {
    case "apple":
      return "Apple Health";
    case "google":
      return "Google Fit";
    case "simulated":
      return "Simülasyon";
    default:
      return "Sağlık";
  }
}

export async function checkRecentMovement(_opts: {
  suspicious: boolean;
}): Promise<HealthCheckResult> {
  return {
    status: "simulated",
    hasMovement: true,
    source: "simulated",
    title: "Hareket (simülasyon)",
    detail: "Yerel geliştirme ortamında sağlık verisi yok; tam XP varsayılıyor.",
    stepsInWindow: 0,
  };
}
