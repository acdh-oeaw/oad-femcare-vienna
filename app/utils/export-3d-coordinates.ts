import type { HotspotData, WallData } from "@/components/pharmacy-viewer.vue";

/** For exporting hotspots after creating them */
export function exportHotspots(hotspotData: Array<HotspotData>) {
	const json = JSON.stringify(hotspotData, null, 2);

	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = "pharmacy-hotspots.json";
	a.click();

	URL.revokeObjectURL(url);
}

/** For exporting walls after creating them */
export function exportWalls(wallParamsList: Array<WallData>) {
	const json = JSON.stringify(wallParamsList, null, 2);

	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = "walls.json";
	a.click();

	URL.revokeObjectURL(url);
}
