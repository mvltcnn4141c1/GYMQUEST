export const HealthCheckResponse = {
  parse(input: unknown) {
    const obj = input as { status?: unknown };
    if (!obj || obj.status !== "ok") {
      throw new Error("Invalid health response payload");
    }
    return { status: "ok" as const };
  },
};
