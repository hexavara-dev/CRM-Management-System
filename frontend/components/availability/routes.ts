const segment = (value: string | number) => encodeURIComponent(String(value));

export function availabilityPath(projectId: string | number) {
  return `/availability/${segment(projectId)}`;
}

export function clusterPath(
  projectId: string | number,
  clusterId: string | number,
) {
  return `${availabilityPath(projectId)}/cluster/${segment(clusterId)}`;
}

export function unitPath(
  projectId: string | number,
  clusterId: string | number,
  unitId: string | number,
) {
  return `${clusterPath(projectId, clusterId)}/unit/${segment(unitId)}`;
}
