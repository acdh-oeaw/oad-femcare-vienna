<script setup lang="ts">
import { ExpandIcon, SettingsIcon, ShrinkIcon } from "lucide-vue-next";

const isFullscreen = ref(false);
const screenRef = ref<HTMLElement | null>(null);

//eslint-disable-next-line @typescript-eslint/no-explicit-any
const viewerRef = ref<any>(null);

const toggleGUI = () => {
	viewerRef.value?.toggleGui();
};

const toggleFullscreen = () => {
	const el = screenRef.value!;

	if (!document.fullscreenElement) {
		el.requestFullscreen();
		isFullscreen.value = true;
	} else {
		document.exitFullscreen();
		isFullscreen.value = false;
	}
};
</script>

<template>
	<div ref="screenRef" class="relative h-full">
		<Button
			size="icon"
			class="absolute z-5 right-0 m-5 bg-white hover:bg-neutral-200"
			@click="toggleFullscreen"
		>
			<ExpandIcon v-if="!isFullscreen" class="text-black/90" />
			<ShrinkIcon v-else class="text-black/90" />
		</Button>
		<Toggle variant="color" size="icon" class="absolute z-5 right-14 m-5" @click="toggleGUI">
			<SettingsIcon />
		</Toggle>
		<VisualisationContainer v-slot="{ height, width }">
			<PharmacyViewer v-if="height && width" ref="viewerRef" />
		</VisualisationContainer>
	</div>
</template>
