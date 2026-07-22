const MATERIAL_VARS: Record<string, { color: string; soft: string }> = {
  denim: { color: '--material-denim', soft: '--material-denim-soft' },
  chino: { color: '--material-chino', soft: '--material-chino-soft' },
  leather: { color: '--material-leather', soft: '--material-leather-soft' },
};

export function getMaterialVars(category?: string) {
  const match = category ? MATERIAL_VARS[category.toLowerCase()] : undefined;
  return {
    color: `var(${match?.color ?? '--foreground'})`,
    soft: `var(${match?.soft ?? '--secondary'})`,
  };
}
