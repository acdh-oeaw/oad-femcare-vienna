<script setup lang="ts">
import { ExpandIcon, SettingsIcon, ShrinkIcon } from "lucide-vue-next";

const isFullscreen = ref(false);
const screenRef = ref<HTMLElement | null>(null);

//eslint-disable-next-line @typescript-eslint/no-explicit-any
const viewerRef = ref<any>(null);
const walkingMode = ref(false);

const toggleMode = () => {
	walkingMode.value = !walkingMode.value;
};

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
		<div class="absolute z-5 right-0 m-5 flex-row flex gap-8">
			<div class="flex items-center space-x-2">
				<Switch id="walking-mode" size="icon" class="bg-white hover:bg-neutral-200" @click="toggleMode" />
				<Label for="walking-mode" class="text-white font-medium">Walking Mode</Label>
			</div>
			<Toggle variant="color" size="icon" @click="toggleGUI">
				<SettingsIcon />
			</Toggle>
			<Button size="icon" class="bg-white hover:bg-neutral-200" @click="toggleFullscreen">
				<ExpandIcon v-if="!isFullscreen" class="text-black/90" />
				<ShrinkIcon v-else class="text-black/90" />
			</Button>
		</div>
		<VisualisationContainer v-slot="{ height, width }">
			<PharmacyViewer v-if="height && width" ref="viewerRef" :walking-mode="walkingMode" />
		</VisualisationContainer>
	</div>
</template>
